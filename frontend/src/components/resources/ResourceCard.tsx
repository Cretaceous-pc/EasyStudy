import { useState } from 'react';
import { Button } from 'antd';
import { useLayoutStore, useCourseStore, useResourceStore } from '../../stores';
import AppModal from '../shared/AppModal';
import { api } from '../../services/api';
import {
  FileTextOutlined,
  PartitionOutlined,
  EditOutlined,
  CodeOutlined,
  ReadOutlined,
  ExpandOutlined,
  ShrinkOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import type { Resource, ResourceType } from '../../types/resource';

interface Props {
  resource: Resource;
}

const typeConfig: Record<
  ResourceType,
  { icon: any; label: string; color: string; bg: string }
> = {
  document: {
    icon: FileTextOutlined,
    label: '知识点总结',
    color: '#c96442',
    bg: '#e8d4c8',
  },
  mermaid: {
    icon: PartitionOutlined,
    label: '思维导图',
    color: '#5b8c5a',
    bg: '#d4e4d4',
  },
  exercise_set: {
    icon: EditOutlined,
    label: '练习题',
    color: '#d4a017',
    bg: '#f0e6c8',
  },
  code_case: {
    icon: CodeOutlined,
    label: '代码案例',
    color: '#4a7c9b',
    bg: '#d0e0ec',
  },
  reading_material: {
    icon: ReadOutlined,
    label: '拓展阅读',
    color: '#8b6f8b',
    bg: '#e4d8e4',
  },
};

/** 从 content 中提取纯文本（用于预览截断） */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    if (typeof obj.markdown === 'string') return obj.markdown;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.mermaid_code === 'string') return obj.mermaid_code;
    return JSON.stringify(obj).slice(0, 200);
  }
  return '';
}

/** 从 content 中提取 Markdown 文本（用于 ReactMarkdown 渲染） */
function extractMarkdown(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    if (typeof obj.markdown === 'string') return obj.markdown;
    if (typeof obj.mermaid_code === 'string') return '```mermaid\n' + obj.mermaid_code + '\n```';
    return JSON.stringify(obj, null, 2);
  }
  return '';
}

export default function ResourceCard({ resource }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const config = typeConfig[resource.resource_type];
  const Icon = config.icon;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/api/ai/resources/${resource.id}/download`, {
        responseType: 'blob',
      });
      const blob = res.data as Blob;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${resource.title || 'resource'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('下载失败:', err);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await api.delete(`/api/ai/resources/${resource.id}`);
      // 刷新资源列表
      const { activeCourseId } = useCourseStore.getState();
      if (activeCourseId) {
        useResourceStore.getState().fetchResources({ course_id: activeCourseId });
      }
    } catch (err) {
      console.error('删除失败:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenAsCourseware = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { setCurrentFile, setActiveView } = useLayoutStore.getState();
    const { activeCourseId, currentCourse } = useCourseStore.getState();
    const courseId = activeCourseId ?? 0;
    const courseTitle = currentCourse?.title ?? '';
    const md = extractMarkdown(resource.content);

    setCurrentFile({
      id: parseInt(resource.id, 10) || 0,
      title: resource.title,
      chapter: resource.topic || 'AI生成',
      section: '',
      fileType: 'resource',
      fileUrl: '',
      courseId,
      courseTitle,
      resourceContent: md,
    });
    setActiveView('chat');
  };

  return (
    <div
      className="rounded-xl overflow-hidden cursor-pointer"
      style={{
        background: 'var(--ivory)',
        border: '1px solid var(--border-cream)',
        boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(42,27,24,0.06)';
        e.currentTarget.style.borderColor = 'var(--border-warm)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(42,27,24,0.03)';
        e.currentTarget.style.borderColor = 'var(--border-cream)';
      }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: config.bg, color: config.color }}
            >
              <Icon style={{ fontSize: 15 }} />
            </div>
            <div>
              <div
                className="inline-block rounded px-1.5 py-0.5 mb-1"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  background: config.bg,
                  color: config.color,
                }}
              >
                {config.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--near-black)',
                  lineHeight: 1.3,
                }}
              >
                {resource.title}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleOpenAsCourseware}
              className="w-7 h-7 flex items-center justify-center rounded-md border-none cursor-pointer flex-shrink-0"
              style={{
                background: 'var(--parchment)',
                color: 'var(--stone-gray)',
                fontSize: 12,
                transition: 'all 0.2s',
              }}
              title="课件模式查看"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-light)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--parchment)';
                e.currentTarget.style.color = 'var(--stone-gray)';
              }}
            >
              📖
            </button>
            <button
              onClick={handleDownload}
              className="w-7 h-7 flex items-center justify-center rounded-md border-none cursor-pointer flex-shrink-0"
              style={{
                background: 'var(--parchment)',
                color: 'var(--stone-gray)',
                fontSize: 12,
                transition: 'all 0.2s',
              }}
              title="下载 Markdown"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-light)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--parchment)';
                e.currentTarget.style.color = 'var(--stone-gray)';
              }}
            >
              <DownloadOutlined />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md border-none cursor-pointer flex-shrink-0"
              style={{
                background: 'var(--parchment)',
                color: 'var(--stone-gray)',
                fontSize: 12,
                transition: 'all 0.2s',
              }}
              title={expanded ? '收起' : '展开'}
            >
              {expanded ? <ShrinkOutlined /> : <ExpandOutlined />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md border-none cursor-pointer flex-shrink-0"
              style={{
                background: 'var(--parchment)',
                color: 'var(--stone-gray)',
                fontSize: 12,
                transition: 'all 0.2s',
              }}
              title="删除资源"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fce4e4';
                e.currentTarget.style.color = '#b55738';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--parchment)';
                e.currentTarget.style.color = 'var(--stone-gray)';
              }}
            >
              <DeleteOutlined />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div
          className="flex items-center gap-3"
          style={{ fontSize: 11, color: 'var(--stone-gray)' }}
        >
          <span>主题：{resource.topic}</span>
          <span>·</span>
          <span>{formatDate(resource.created_at)}</span>
        </div>
      </div>

      {/* Content preview (collapsed) */}
      {!expanded && (
        <div
          className="px-4 pb-4"
          style={{
            fontSize: 12,
            color: 'var(--olive-gray)',
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {extractText(resource.content).slice(0, 120).replace(/[#*`\n]/g, ' ')}...
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div
          className="px-4 pb-4"
          style={{
            borderTop: '1px solid var(--border-cream)',
            paddingTop: 12,
          }}
        >
          <div
            className="resource-markdown"
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: 'var(--olive-gray)',
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
              components={{
                h1: ({ children }) => (
                  <h1
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 18,
                      fontWeight: 500,
                      color: 'var(--near-black)',
                      margin: '16px 0 8px',
                    }}
                  >
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 15,
                      fontWeight: 500,
                      color: 'var(--near-black)',
                      margin: '14px 0 6px',
                    }}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--charcoal-warm)',
                      margin: '10px 0 4px',
                    }}
                  >
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p style={{ margin: '8px 0' }}>{children}</p>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        background: 'var(--warm-sand)',
                        padding: '1px 4px',
                        borderRadius: 3,
                        color: 'var(--accent)',
                      }}
                    >
                      {children}
                    </code>
                  ) : (
                    <pre
                      style={{
                        background: 'var(--near-black)',
                        color: '#e8e6dc',
                        padding: 12,
                        borderRadius: 8,
                        overflowX: 'auto',
                        fontSize: 12,
                        lineHeight: 1.8,
                      }}
                    >
                      <code>{children}</code>
                    </pre>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote
                    style={{
                      borderLeft: '3px solid var(--accent-light)',
                      paddingLeft: 12,
                      margin: '8px 0',
                      color: 'var(--stone-gray)',
                      fontStyle: 'italic',
                    }}
                  >
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 12,
                      margin: '8px 0',
                    }}
                  >
                    {children}
                  </table>
                ),
                th: ({ children }) => (
                  <th
                    style={{
                      borderBottom: '1px solid var(--border-warm)',
                      padding: '6px 8px',
                      textAlign: 'left',
                      fontWeight: 500,
                      color: 'var(--near-black)',
                    }}
                  >
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td
                    style={{
                      borderBottom: '1px solid var(--border-cream)',
                      padding: '6px 8px',
                      color: 'var(--olive-gray)',
                    }}
                  >
                    {children}
                  </td>
                ),
              }}
            >
              {extractMarkdown(resource.content)}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <AppModal
          open
          onCancel={() => setShowDeleteConfirm(false)}
          width={360}
          closable={false}
          footer={
            <div className="flex gap-3">
              <Button block onClick={() => setShowDeleteConfirm(false)}
                style={{ fontSize: 13, borderColor: 'var(--border-cream)', color: 'var(--stone-gray)' }}>
                取消
              </Button>
              <Button block onClick={handleDelete} disabled={deleting} loading={deleting}
                style={{ fontSize: 13, background: '#b55738', borderColor: '#b55738', color: '#fff' }}>
                {deleting ? '删除中...' : '确认删除'}
              </Button>
            </div>
          }
          styles={{ body: { padding: '8px 24px 0' } }}
        >
          <div className="flex flex-col items-center">
            <ExclamationCircleOutlined style={{ fontSize: 36, color: '#b55738', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--near-black)', marginBottom: 4, fontFamily: 'var(--font-serif)' }}>
              确认删除
            </div>
            <div style={{ fontSize: 12, color: 'var(--stone-gray)', marginBottom: 8, fontFamily: 'var(--font-sans)', textAlign: 'center', lineHeight: 1.6 }}>
              确定要删除「{resource.title}」吗？<br />删除后无法恢复。
            </div>
          </div>
        </AppModal>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
