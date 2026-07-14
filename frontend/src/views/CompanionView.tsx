import { useRef, useState, useEffect, useCallback, memo } from 'react';
import { RobotOutlined, PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { useLayoutStore, useChatStore, useCourseStore } from '../stores';
import * as materialService from '../services/materialService';
import MessageList from '../components/chat/MessageList';
import ChatInput from '../components/chat/ChatInput';
import ResourceGenModal from '../components/resources/ResourceGenModal';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import MermaidDiagram from '../components/chat/MermaidDiagram';
import { preprocessMermaid } from '../utils/mermaidPreprocessor';
import gsap from 'gsap';

export default function CompanionView() {
  const { currentFile, splitterRatio, setSplitterRatio, saveScrollPosition, getScrollPosition } = useLayoutStore();
  const {
    messages, streamingContent, isStreaming, currentConversationId, currentMaterialId,
    enterCourseware, newCoursewareSession, isLoadingMessages, error,
  } = useChatStore();
  const { enrolledCourses, activeCourseId } = useCourseStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const upperRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const prevFileId = useRef<number | null>(null);
  const splitterRatioRef = useRef(splitterRatio);
  const [isDragging, setIsDragging] = useState(false);
  const [docContent, setDocContent] = useState<string>('');
  const [docLoading, setDocLoading] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);

  // Keep ref in sync with store (for non-drag updates)
  useEffect(() => {
    splitterRatioRef.current = splitterRatio;
  }, [splitterRatio]);

  // 获取当前激活课程 ID（不用 0 回退，避免 falsy 阻断按钮）
  const courseId = activeCourseId ?? enrolledCourses[0]?.course_id ?? null;

  // GSAP: 课件区入场动画
  useEffect(() => {
    if (!currentFile) return;
    const tl = gsap.timeline();
    if (upperRef.current) {
      tl.fromTo(upperRef.current, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' }, 0);
    }
    if (chatAreaRef.current) {
      tl.fromTo(chatAreaRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.15);
    }
  }, [currentFile?.id]);

  // 课件/资源切换 → 加载内容 + 自动加载/创建会话
  useEffect(() => {
    if (!currentFile || courseId == null) return;

    const isNewFile = currentFile.id !== prevFileId.current;
    if (isNewFile) {
      prevFileId.current = currentFile.id;

      // 资源类型：直接使用预加载内容，无需 API 请求
      if (currentFile.fileType === 'resource' && currentFile.resourceContent) {
        setDocContent(currentFile.resourceContent);
        setDocLoading(false);
      } else {
        setDocLoading(true);
        materialService.getMaterialContent(currentFile.id)
          .then((data) => {
            setDocContent(data.content || '# 暂无内容\n\n该课件内容正在准备中...');
          })
          .catch(() => {
            setDocContent('# 加载失败\n\n无法加载课件内容，请检查网络连接。');
          })
          .finally(() => setDocLoading(false));
      }
    }

    // 仅在课件切换时重新加载/创建会话（避免覆盖用户手动操作）
    if (isNewFile) {
      enterCourseware(courseId, currentFile.id);
    }
  }, [currentFile?.id, courseId, enterCourseware]);

  const [sessionErr, setSessionErr] = useState<string | null>(null);

  // "新会话" 按钮
  const handleNewSession = async () => {
    if (!currentFile || courseId == null) return;
    setSessionErr(null);
    try {
      await newCoursewareSession(courseId, currentFile.id);
      // 检查是否有错误（API 层面）
      const err = useChatStore.getState().error;
      if (err) setSessionErr(err);
    } catch (e) {
      setSessionErr((e as Error).message || '创建新会话失败');
    }
  };

  // Restore scroll position when file changes
  useEffect(() => {
    if (!currentFile || !upperRef.current) return;
    const saved = getScrollPosition(currentFile.id);
    if (saved) {
      requestAnimationFrame(() => {
        upperRef.current!.scrollTop = saved;
      });
    }
  }, [currentFile?.id]);

  // Save scroll position before unmount
  useEffect(() => {
    return () => {
      if (currentFile && upperRef.current) {
        saveScrollPosition(currentFile.id, upperRef.current.scrollTop);
      }
    };
  }, [currentFile?.id]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startY = e.clientY;
    const startRatio = splitterRatioRef.current;
    const containerHeight = containerRef.current!.clientHeight;

    const onMove = (ev: MouseEvent) => {
      const deltaY = ev.clientY - startY;
      const newRatio = Math.min(0.85, Math.max(0.3, startRatio + deltaY / containerHeight));
      splitterRatioRef.current = newRatio;
      // 直接操作 DOM，避免每次 mousemove 都触发 React re-render
      if (upperRef.current) {
        upperRef.current.style.height = `${newRatio * 100}%`;
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setIsDragging(false);
      // 仅在拖拽结束时同步一次到 store
      setSplitterRatio(splitterRatioRef.current);
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [setSplitterRatio]);

  return (
    <div ref={containerRef} className="flex flex-col flex-1 overflow-hidden">
      {/* Upper: Document */}
      <div
        ref={upperRef}
        className="overflow-y-auto"
        style={{
          height: `${splitterRatio * 100}%`,
          padding: '32px 52px',
          maxWidth: 900,
          margin: '0 auto',
          width: '100%',
          scrollbarWidth: 'none',
        }}
      >
        <nav className="mb-4.5" style={{ fontSize: 11, color: 'var(--stone-gray)', fontFamily: 'var(--font-sans)' }}>
          {currentFile?.courseTitle || '课程'} / {currentFile?.chapter || '章节'} / 课件正文
        </nav>
        <h1
          className="pb-3 mb-5"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 26,
            fontWeight: 500,
            color: 'var(--near-black)',
            borderBottom: '1px solid var(--border-cream)',
            letterSpacing: '-0.3px',
            lineHeight: 1.25,
          }}
        >
          {currentFile?.title || '课件标题'}
        </h1>
        {docLoading ? (
          <div className="flex items-center justify-center gap-2" style={{ padding: '48px 0', color: 'var(--stone-gray)', fontSize: 13 }}>
            <LoadingOutlined style={{ fontSize: 14 }} />
            加载课件内容...
          </div>
        ) : (
          <DocContent content={docContent} />
        )}
      </div>

      {/* Resizer — 白亮色 4px 加粗手柄 */}
      <div
        className="flex-shrink-0 relative flex items-center justify-center"
        style={{
          height: 6,
          background: 'var(--border-warm)',
          cursor: 'row-resize',
          borderTop: `2px solid ${isDragging ? 'var(--accent)' : 'var(--border-cream)'}`,
          borderBottom: `2px solid ${isDragging ? 'var(--accent)' : 'var(--border-cream)'}`,
          transition: 'border-color 0.2s',
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          if (isDragging) return;
          e.currentTarget.style.borderTopColor = 'var(--border-warm)';
          e.currentTarget.style.borderBottomColor = 'var(--border-warm)';
        }}
        onMouseLeave={(e) => {
          if (isDragging) return;
          e.currentTarget.style.borderTopColor = 'var(--border-cream)';
          e.currentTarget.style.borderBottomColor = 'var(--border-cream)';
        }}
      >
        {/* 手柄 — 橙色 6px */}
        <div
          style={{
            width: isDragging ? 96 : 64,
            height: 6,
            background: 'var(--accent)',
            borderRadius: 3,
            transition: 'all 0.2s',
          }}
        />
        {/* 扩大点击区域 */}
        <div
          className="absolute"
          style={{ top: -8, bottom: -8, left: 0, right: 0 }}
        />
      </div>

      {/* Lower: AI Companion */}
      <div
        ref={chatAreaRef}
        className="flex flex-col flex-1 overflow-hidden min-h-0 relative"
        style={{ background: 'var(--parchment)' }}
      >
        {/* Gradient fade */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none z-2"
          style={{
            height: 24,
            background: 'linear-gradient(to bottom, var(--parchment), transparent)',
          }}
        />

        <div className="flex flex-col flex-1 min-h-0" style={{ maxWidth: 780, margin: '0 auto', width: '100%' }}>
          {/* Context Line */}
          <div
            className="flex items-center justify-between"
            style={{
              padding: '6px 20px 2px',
              fontSize: 11,
              color: 'var(--stone-gray)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <RobotOutlined style={{ fontSize: 10, color: 'var(--warm-silver)' }} />
              <span>AI 已绑定</span>
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{currentFile?.title || ''}</span>
              {currentConversationId && messages.length > 0 && (
                <span style={{ color: 'var(--stone-gray)' }}>
                  · {messages.length} 条消息
                </span>
              )}
            </div>
            {/* "新会话" 按钮：仅在已有消息时显示 */}
            {currentConversationId && messages.length > 0 && (
              <button
                onClick={handleNewSession}
                disabled={isLoadingMessages}
                className="border-none cursor-pointer flex items-center gap-1"
                style={{
                  fontSize: 10,
                  color: 'var(--stone-gray)',
                  background: 'transparent',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontFamily: 'var(--font-sans)',
                  opacity: isLoadingMessages ? 0.5 : 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--stone-gray)'; }}
                title="为当前课件创建新的对话线程"
              >
                <PlusOutlined style={{ fontSize: 9 }} />
                新会话
              </button>
            )}
          </div>

          {/* 新会话错误提示 */}
          {sessionErr && (
            <div
              className="flex items-center gap-1.5"
              style={{
                padding: '2px 20px',
                fontSize: 10,
                color: '#b55738',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span>⚠</span>
              <span>创建新会话失败：{sessionErr.slice(0, 60)}</span>
              <button
                onClick={() => setSessionErr(null)}
                className="border-none cursor-pointer"
                style={{
                  fontSize: 9,
                  color: 'var(--stone-gray)',
                  background: 'transparent',
                  marginLeft: 'auto',
                }}
              >
                关闭
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full" style={{ color: 'var(--stone-gray)', fontSize: 13 }}>
                加载对话中...
              </div>
            ) : messages.length === 0 ? (
              <div
                className="flex items-center justify-center"
                style={{
                  padding: '32px 20px',
                  color: 'var(--stone-gray)',
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  textAlign: 'center',
                }}
              >
                开始学习这一章吧，有什么问题可以直接问我。
              </div>
            ) : (
              <MessageList
                messages={messages}
                streamingContent={streamingContent}
                isStreaming={isStreaming}
                variant="companion"
                courseId={courseId}
                materialId={currentFile?.id}
              />
            )}
          </div>

          {/* Ghost Input */}
          <ChatInput
            variant="ghost"
            context={{ currentChapter: currentFile?.title }}
            materialId={currentFile?.id}
            onResourceGen={() => setShowResourceModal(true)}
          />
        </div>
      </div>

      <ResourceGenModal
        open={showResourceModal}
        onClose={() => setShowResourceModal(false)}
        contextContent={docContent}
      />
    </div>
  );
}

const DocContent = memo(function DocContent({ content }: { content: string }) {
  const processedContent = preprocessMermaid(content);
  
  return (
    <div style={{ fontSize: 14, color: 'var(--olive-gray)', lineHeight: 1.75, fontFamily: 'var(--font-sans)' }}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
        components={{
          p: ({ children }) => <p style={{ marginBottom: 14 }}>{children}</p>,
          strong: ({ children }) => <strong style={{ color: 'var(--near-black)', fontWeight: 500 }}>{children}</strong>,
          code: ({ children, className }) => {
            const isInline = !className;
            const language = className?.replace('language-', '') || '';
            if (language === 'mermaid') {
              return <MermaidDiagram chart={String(children)} />;
            }
            if (isInline) {
              return (
                <code
                  style={{
                    background: 'var(--parchment)',
                    color: '#b55738',
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12.5,
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
            <ul style={{ paddingLeft: 18, marginBottom: 14, fontSize: 13, lineHeight: 1.8, color: 'var(--olive-gray)' }}>
              {children}
            </ul>
          ),
          li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
          h1: ({ children }) => (
            <h1 style={{ fontSize: 22, fontWeight: 500, margin: '18px 0 12px', color: 'var(--near-black)', fontFamily: 'var(--font-serif)' }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 18, fontWeight: 500, margin: '16px 0 10px', color: 'var(--near-black)', fontFamily: 'var(--font-serif)' }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 15, fontWeight: 500, margin: '12px 0 8px', color: 'var(--near-black)' }}>
              {children}
            </h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
