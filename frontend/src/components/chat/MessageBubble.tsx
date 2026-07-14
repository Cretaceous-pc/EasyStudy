import { useState } from 'react';
import { RobotOutlined, SoundOutlined, LoadingOutlined, CopyOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type { Message } from '../../types/chat';
import { api } from '../../services/api';
import { useChatStore } from '../../stores/chatStore';
import MermaidDiagram from './MermaidDiagram';
import { preprocessMermaid } from '../../utils/mermaidPreprocessor';

interface MessageBubbleProps {
  message: Message;
  index: number;
  variant: 'default' | 'companion';
  isStreaming?: boolean;
  /** 重新生成所需的课程 ID */
  courseId?: number;
  /** 课件 ID（CompanionView 中） */
  materialId?: number;
}

export default function MessageBubble({ message, index, variant, isStreaming, courseId, materialId }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [ttsLoading, setTtsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const regenerateMessage = useChatStore((s) => s.regenerateMessage);
  const storeIsStreaming = useChatStore((s) => s.isStreaming);

  const handleRegenerate = async () => {
    if (regenerating || storeIsStreaming || !courseId) return;
    setRegenerating(true);
    try {
      await regenerateMessage(index, courseId, materialId);
    } finally {
      setRegenerating(false);
    }
  };

  const handleTTS = async () => {
    if (ttsLoading || !message.content) return;
    setTtsLoading(true);
    try {
      const res = await api.post('/api/ai/tts/synthesize', {
        text: message.content,
      });
      const audioUrl = res.data?.data?.audio_url;
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play();
      }
    } catch {
      // TTS 静默失败
    } finally {
      setTtsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：选中文本
      const el = document.getElementById(`msg-${index}`);
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  return (
    <div
      id={`msg-${index}`}
      className="flex"
      style={{
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        padding: variant === 'companion' ? '14px 20px' : '12px 16px',
        borderBottom: variant === 'companion' ? '1px solid rgba(240,238,230,0.6)' : '1px solid rgba(240,238,230,0.6)',
        animation: isStreaming ? 'none' : 'msgFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {!isUser && variant === 'companion' && (
        <div
          className="flex-shrink-0 flex items-center justify-center mr-2.5"
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: 'var(--accent-light)',
            color: 'var(--accent)',
            fontSize: 10,
            marginTop: 2,
          }}
        >
          <RobotOutlined />
        </div>
      )}

      <div
        style={{
          maxWidth: '82%',
          wordBreak: 'break-word',
          ...(isUser
            ? {
                textAlign: 'right',
                padding: '8px 14px',
                borderRadius: '14px',
                borderBottomRightRadius: 4,
                background: 'rgba(201,100,66,0.06)',
                border: '1px solid rgba(201,100,66,0.15)',
              }
            : variant === 'companion'
            ? {
                padding: '10px 14px',
                color: 'var(--olive-gray)',
                background: 'var(--ivory)',
                borderRadius: 8,
                border: '1px solid var(--border-cream)',
              }
            : {
                padding: '12px 16px',
                color: 'var(--near-black)',
                background: 'var(--ivory)',
                borderRadius: 10,
                border: '1px solid var(--border-cream)',
              }),
          fontSize: 13.5,
          lineHeight: 1.65,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {isUser ? (
          message.content
        ) : (
          <div>
            <MarkdownContent content={message.content} />
            {!isStreaming && message.content && (
              <div className="flex items-center gap-1 mt-2 pt-1.5" style={{ borderTop: '1px solid var(--border-cream)' }}>
                <ActionBtn icon={<CopyOutlined />} label={copied ? '已复制' : '复制'} onClick={handleCopy} active={copied} />
                <ActionBtn icon={<SoundOutlined />} label={ttsLoading ? '合成中...' : '朗读'} onClick={handleTTS} loading={ttsLoading} />
                <ActionBtn
                  icon={<ReloadOutlined />}
                  label={regenerating ? '生成中...' : '重新生成'}
                  onClick={handleRegenerate}
                  loading={regenerating}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, active, loading,
}: {
  icon: React.ReactNode; label: string; onClick?: () => void;
  active?: boolean; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="border-none cursor-pointer flex items-center gap-1"
      style={{
        fontSize: 10,
        color: active ? 'var(--accent)' : 'var(--stone-gray)',
        background: 'transparent',
        padding: '2px 6px',
        borderRadius: 4,
        fontFamily: 'var(--font-sans)',
        opacity: loading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--accent)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--stone-gray)'; }}
    >
      {loading ? <LoadingOutlined style={{ fontSize: 10 }} /> : icon}
      <span>{label}</span>
    </button>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // 预处理 Mermaid 图表：自动包裹到 ```mermaid 代码块
  const processedContent = preprocessMermaid(content);
  
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
      components={{
        p: ({ children }) => <p style={{ margin: '0 0 10px 0' }}>{children}</p>,
        strong: ({ children }) => (
          <strong style={{ color: 'var(--near-black)', fontWeight: 500 }}>{children}</strong>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          const language = className?.replace('language-', '') || '';

          // Mermaid 图表：使用 MermaidDiagram 渲染
          if (language === 'mermaid') {
            return <MermaidDiagram chart={String(children)} />;
          }

          if (isInline) {
            return (
              <code
                style={{
                  background: 'rgba(201,100,66,0.07)',
                  color: '#b55738',
                  padding: '1px 5px',
                  borderRadius: 3,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
              >
                {children}
              </code>
            );
          }
          return (
            <pre
              style={{
                background: 'var(--ivory)',
                border: '1px solid var(--border-cream)',
                borderRadius: 8,
                padding: '12px 16px',
                overflowX: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                lineHeight: 1.8,
              }}
            >
              <code>{children}</code>
            </pre>
          );
        },
        ul: ({ children }) => (
          <ul style={{ paddingLeft: 18, marginBottom: 10, fontSize: 13, lineHeight: 1.8, color: 'var(--olive-gray)' }}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol style={{ paddingLeft: 18, marginBottom: 10, fontSize: 13, lineHeight: 1.8, color: 'var(--olive-gray)' }}>
            {children}
          </ol>
        ),
        li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
        h1: ({ children }) => (
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: '16px 0 10px', color: 'var(--near-black)', fontFamily: 'var(--font-serif)' }}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: '14px 0 8px', color: 'var(--near-black)', fontFamily: 'var(--font-serif)' }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: 15, fontWeight: 500, margin: '12px 0 6px', color: 'var(--near-black)' }}>
            {children}
          </h3>
        ),
        blockquote: ({ children }) => (
          <blockquote
            style={{
              borderLeft: '3px solid var(--accent)',
              margin: '10px 0',
              padding: '8px 14px',
              background: 'var(--ivory)',
              borderRadius: '0 8px 8px 0',
            }}
          >
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
