import type { GenerationProgress } from '../../types/resource';

interface Props {
  progress: GenerationProgress | null;
}

const phaseLabels: Record<string, string> = {
  planning: '正在规划...',
  generating: '生成资源中...',
  validating: '质量校验中...',
  done: '生成完成',
};

const phaseOrder = ['planning', 'generating', 'validating', 'done'];

export default function GenerationProgressBar({ progress }: Props) {
  if (!progress) return null;

  const currentPhaseIndex = phaseOrder.indexOf(progress.status);
  const percent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div
      className="rounded-xl p-5 mb-5"
      style={{
        background: 'var(--ivory)',
        border: '1px solid var(--border-cream)',
        boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
      }}
    >
      {/* 阶段标签 */}
      <div className="flex items-center justify-between mb-3">
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--near-black)',
            fontFamily: 'var(--font-serif)',
          }}
        >
          {phaseLabels[progress.status] || progress.message}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--stone-gray)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {progress.current}/{progress.total}
        </span>
      </div>

      {/* 进度条 */}
      <div
        className="w-full h-1.5 rounded-full overflow-hidden mb-3"
        style={{ background: 'var(--warm-sand)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            background: 'var(--accent)',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      {/* 阶段指示器 */}
      <div className="flex items-center gap-2">
        {phaseOrder.map((phase, idx) => {
          const isActive = idx === currentPhaseIndex;
          const isDone = idx < currentPhaseIndex;
          return (
            <div key={phase} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: isDone
                    ? 'var(--accent)'
                    : isActive
                    ? 'var(--accent)'
                    : 'var(--warm-sand)',
                  opacity: isActive ? 1 : isDone ? 0.5 : 1,
                  boxShadow: isActive ? '0 0 0 3px rgba(201,100,66,0.15)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
              {idx < phaseOrder.length - 1 && (
                <div
                  className="w-8 h-px"
                  style={{
                    background: isDone ? 'var(--accent)' : 'var(--border-cream)',
                    opacity: isDone ? 0.4 : 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 当前任务消息 */}
      {progress.message && currentPhaseIndex < 0 && (
        <div
          className="mt-3 pt-3"
          style={{
            borderTop: '1px solid var(--border-cream)',
            fontSize: 12,
            color: 'var(--olive-gray)',
          }}
        >
          {progress.message}
        </div>
      )}
    </div>
  );
}
