import type { ReactNode } from 'react';

interface ActionButtonProps {
  icon?: ReactNode;
  label: string;
  primary?: boolean;
  onClick: () => void;
}

export default function ActionButton({ icon, label, primary, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border-none cursor-pointer"
      style={{
        fontSize: 12,
        fontWeight: 500,
        background: primary ? 'var(--accent)' : 'var(--parchment)',
        color: primary ? '#fff' : 'var(--olive-gray)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: primary ? '0 1px 3px rgba(201,100,66,0.2)' : 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = primary ? 'var(--accent-hover)' : 'var(--warm-sand)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = primary ? 'var(--accent)' : 'var(--parchment)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}
