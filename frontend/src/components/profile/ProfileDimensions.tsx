import type { ProfileDimension } from '../../types/profile';
import { SectionLabel } from './ProfileRadar';

interface ProfileDimensionsProps {
  dimensions: ProfileDimension[];
  isEditing: boolean;
  onDimensionChange: (key: string, value: number) => void;
}

export default function ProfileDimensions({
  dimensions,
  isEditing,
  onDimensionChange,
}: ProfileDimensionsProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--ivory)',
        border: '1px solid var(--border-cream)',
        boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
      }}
    >
      <SectionLabel>维度详情</SectionLabel>
      <div className="flex flex-col gap-3">
        {dimensions.map((dim) => (
          <DimensionRow
            key={dim.key}
            dim={dim}
            isEditing={isEditing}
            onChange={(v) => onDimensionChange(dim.key, v)}
          />
        ))}
      </div>
    </div>
  );
}

function DimensionRow({
  dim,
  isEditing,
  onChange,
}: {
  dim: ProfileDimension;
  isEditing: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--near-black)' }}>
          {dim.label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent)',
            fontWeight: 500,
          }}
        >
          {dim.rawValue ?? dim.value}
        </span>
      </div>

      <div
        className="w-full h-1.5 rounded-full overflow-hidden mb-1"
        style={{ background: 'var(--warm-sand)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${dim.value}%`,
            background: 'var(--accent)',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      {isEditing && (
        <input
          type="range"
          min={0}
          max={100}
          value={dim.value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: 'var(--accent)', height: 4, cursor: 'pointer' }}
        />
      )}

      {dim.description && (
        <p style={{ fontSize: 11, color: 'var(--stone-gray)', margin: '4px 0 0' }}>
          {dim.description}
        </p>
      )}
    </div>
  );
}
