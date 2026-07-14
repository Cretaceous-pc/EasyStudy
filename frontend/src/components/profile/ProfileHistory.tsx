import { HistoryOutlined } from '@ant-design/icons';
import type { ProfileSnapshot } from '../../types/profile';

interface ProfileHistoryProps {
  history: ProfileSnapshot[];
}

export default function ProfileHistory({ history }: ProfileHistoryProps) {
  if (!history.length) return null;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--ivory)',
        border: '1px solid var(--border-cream)',
        boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <HistoryOutlined style={{ fontSize: 14, color: 'var(--stone-gray)' }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--stone-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}
        >
          画像历史
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {history.map((snap, idx) => (
          <div
            key={snap.id}
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{
              background: 'var(--parchment)',
              borderLeft: '3px solid var(--accent-light)',
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: 'var(--accent-light)',
                color: 'var(--accent)',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {history.length - idx}
            </div>
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--near-black)',
                  marginBottom: 2,
                }}
              >
                {snap.summary}
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: 11, color: 'var(--stone-gray)' }}>
                <span>触发：{snap.trigger}</span>
                <span>·</span>
                <span>{formatDate(snap.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
