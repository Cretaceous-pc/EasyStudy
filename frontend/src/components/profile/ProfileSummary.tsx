interface ProfileSummaryProps {
  summary: string;
}

export default function ProfileSummary({ summary }: ProfileSummaryProps) {
  if (!summary) return null;

  return (
    <div
      className="rounded-xl p-4 mb-6"
      style={{
        background: 'var(--ivory)',
        border: '1px solid var(--border-cream)',
        boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--stone-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: 8,
        }}
      >
        AI 画像摘要
      </div>
      <p
        style={{
          fontSize: 13,
          color: 'var(--olive-gray)',
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {summary}
      </p>
    </div>
  );
}
