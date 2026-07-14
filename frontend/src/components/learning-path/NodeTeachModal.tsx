import { memo } from 'react';
import { Button, Tag } from 'antd';
import {
  CheckCircleOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type { TreeNode, PathNodeStatus } from '../../types/learningPath';
import AppModal from '../shared/AppModal';
import { preprocessMermaid } from '../../utils/mermaidPreprocessor';
import MermaidDiagram from '../chat/MermaidDiagram';

interface Props {
  node: TreeNode | null;
  visible: boolean;
  onClose: () => void;
  onStatusChange: (status: PathNodeStatus) => void;
}

/** 难度中文 + 颜色 */
const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  beginner: { label: '入门', color: '#5b8c5a' },
  intermediate: { label: '进阶', color: '#c96442' },
  advanced: { label: '困难', color: '#8b3a3a' },
};

/**
 * 节点教学弹窗
 * 居中 Modal，展示 LLM 生成的 Markdown 教学内容 + 底部双按钮
 */
export default function NodeTeachModal({ node, visible, onClose, onStatusChange }: Props) {
  if (!node) return null;

  const diff = DIFFICULTY_CONFIG[node.detail.difficulty] ?? DIFFICULTY_CONFIG.beginner;
  const teachContent = node.detail.teachContent || node.detail.description;

  return (
    <AppModal
      open={visible}
      onCancel={onClose}
      width="66vw"
      styles={{
        body: { padding: '24px 32px 20px', maxHeight: '75vh', overflowY: 'auto' },
      }}
      title={
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="truncate"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--near-black)',
            }}
          >
            {node.title}
          </span>
          <Tag style={{ fontSize: 10, border: 'none', background: diff.color + '18', color: diff.color, margin: 0 }}>
            {diff.label}
          </Tag>
        </div>
      }
    >
      {/* Markdown 渲染的教学正文 */}
      <TeachContent md={teachContent} />

      {/* 分隔 + 底部按钮 */}
      <div
        className="flex items-center justify-end gap-3"
        style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-cream)' }}
      >
        <Button
          onClick={onClose}
          style={{
            fontSize: 13,
            borderColor: 'var(--border-cream)',
            color: 'var(--olive-gray)',
          }}
        >
          稍后完成
        </Button>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => {
            onStatusChange('completed');
            onClose();
          }}
          style={{
            fontSize: 13,
            background: 'var(--accent)',
            borderColor: 'var(--accent)',
          }}
        >
          我已了解
        </Button>
      </div>
    </AppModal>
  );
}

/** Markdown 渲染组件，与 CompanionView 使用相同配置 */
const TeachContent = memo(function TeachContent({ md }: { md: string }) {
  const processed = preprocessMermaid(md);

  return (
    <div style={{ fontSize: 14, color: 'var(--olive-gray)', lineHeight: 1.85, fontFamily: 'var(--font-sans)' }}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight] as any}
        components={{
          h1: ({ children }) => (
            <h1 style={{ fontSize: 20, fontWeight: 500, margin: '18px 0 10px', color: 'var(--near-black)', fontFamily: 'var(--font-serif)', borderBottom: '1px solid var(--border-cream)', paddingBottom: 6 }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 17, fontWeight: 500, margin: '16px 0 10px', color: 'var(--near-black)', fontFamily: 'var(--font-serif)' }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 15, fontWeight: 500, margin: '12px 0 8px', color: 'var(--near-black)' }}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 style={{ fontSize: 14, fontWeight: 500, margin: '10px 0 6px', color: 'var(--charcoal-warm)' }}>
              {children}
            </h4>
          ),
          p: ({ children }) => <p style={{ marginBottom: 14 }}>{children}</p>,
          strong: ({ children }) => (
            <strong style={{ color: 'var(--near-black)', fontWeight: 500 }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{
              margin: '12px 0', padding: '10px 16px',
              borderLeft: '3px solid var(--accent)',
              background: 'var(--accent-light)',
              borderRadius: '0 6px 6px 0',
              color: 'var(--olive-gray)', fontSize: 13.5,
            }}>
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-cream)', margin: '20px 0' }} />
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            const language = className?.replace('language-', '') || '';
            if (language === 'mermaid') {
              return <MermaidDiagram chart={String(children)} />;
            }
            if (isInline) {
              return (
                <code style={{
                  background: 'var(--parchment)', color: '#b55738',
                  padding: '1px 5px', borderRadius: 3,
                  fontFamily: 'var(--font-mono)', fontSize: 12.5,
                }}>
                  {children}
                </code>
              );
            }
            return (
              <pre style={{
                background: 'var(--ivory)',
                border: '1px solid var(--border-cream)',
                borderRadius: 8, padding: '12px 16px',
                overflowX: 'auto', fontFamily: 'var(--font-mono)',
                fontSize: 12.5, lineHeight: 1.8,
              }}>
                <code>{children}</code>
              </pre>
            );
          },
          ul: ({ children }) => (
            <ul style={{ paddingLeft: 18, marginBottom: 14, fontSize: 13, lineHeight: 1.8, color: 'var(--olive-gray)' }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{ paddingLeft: 18, marginBottom: 14, fontSize: 13, lineHeight: 1.8, color: 'var(--olive-gray)' }}>
              {children}
            </ol>
          ),
          li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: 'var(--olive-gray)' }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr style={{ borderBottom: '1px solid var(--border-cream)' }}>{children}</tr>
          ),
          th: ({ children }) => (
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: 'var(--near-black)', background: 'var(--parchment)', fontSize: 12 }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ padding: '8px 12px' }}>{children}</td>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt} style={{ maxWidth: '100%', borderRadius: 8, margin: '12px 0' }} />
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
              {children}
            </a>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
});
