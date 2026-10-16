import { NodeIndexOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';

interface Props {
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
  onRetry: () => void;
}

/**
 * 无路径时占位
 */
export default function PathEmptyState({ isLoading, error, onGenerate, onRetry }: Props) {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{
          background: 'var(--ivory)',
          border: `1px solid ${error ? '#b55738' : 'var(--border-cream)'}`,
        }}
      >
        {error ? (
          <CloseCircleOutlined style={{ fontSize: 24, color: '#b55738' }} />
        ) : isLoading ? (
          <LoadingOutlined style={{ fontSize: 24, color: 'var(--accent)' }} spin />
        ) : (
          <NodeIndexOutlined style={{ fontSize: 24, color: 'var(--warm-silver)' }} />
        )}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--near-black)',
          marginBottom: 6,
        }}
      >
        {error ? '加载失败' : isLoading ? '正在生成学习路径' : '暂无学习路径'}
      </div>
      <p
        style={{
          fontSize: 13,
          color: error ? '#b55738' : 'var(--stone-gray)',
          marginBottom: 16,
          maxWidth: 320,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        {error
          ? error.length > 80 ? error.slice(0, 80) + '...' : error
          : isLoading
          ? 'AI 正在根据你的偏好生成个性化学习路径和教学内容，请稍候...'
          : 'AI 根据你的学习画像和课程目标，自动生成树状知识图谱。每个节点配有 AI 生成的教学内容，支持章节展开、节点自由探索。你可以按推荐路径循序渐进，也可以跳转到任意节点深度学习，学习进度实时追踪。'}
      </p>
      {error ? (
        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="px-5 py-2 rounded-lg border cursor-pointer font-medium"
            style={{
              fontSize: 13,
              color: 'var(--olive-gray)',
              background: 'transparent',
              borderColor: 'var(--border-cream)',
            }}
          >
            重试加载
          </button>
          <button
            onClick={onGenerate}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg border-none cursor-pointer font-medium"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 13,
              transition: 'all 0.2s',
              boxShadow: '0 1px 3px rgba(201,100,66,0.25)',
            }}
          >
            {isLoading ? '生成中...' : '重新生成'}
          </button>
        </div>
      ) : (
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="px-5 py-2 rounded-lg border-none cursor-pointer font-medium"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13,
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px rgba(201,100,66,0.25)',
          }}
        >
          {isLoading ? '生成中...' : '生成学习路径'}
        </button>
      )}
    </div>
  );
}
