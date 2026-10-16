import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  BookOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  SyncOutlined,
  LockOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import type { PathNodeData, PathNodeStatus, PathItemType } from '../../types/learningPath';

// ── 状态样式配置 ──
const STATUS_STYLE: Record<PathNodeStatus, { ring: string; icon: React.ReactNode }> = {
  completed:     { ring: '#5b8c5a', icon: <CheckCircleOutlined style={{ fontSize: 14 }} /> },
  in_progress:   { ring: '#c96442', icon: <PlayCircleOutlined style={{ fontSize: 14 }} /> },
  pending:       { ring: '#b0aea5', icon: <ClockCircleOutlined style={{ fontSize: 14 }} /> },
  skipped:       { ring: '#87867f', icon: <MinusCircleOutlined style={{ fontSize: 14 }} /> },
};

// ── 类型图标 ──
const TYPE_ICON: Record<PathItemType, React.ReactNode> = {
  chapter:  <BookOutlined />,
  exercise: <ExperimentOutlined />,
  resource: <FileTextOutlined />,
  review:   <SyncOutlined />,
};

// ── 难度标签 ──
const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '困难',
};

/**
 * React Flow 自定义节点
 * 形状：圆形图标 + 外圈状态环 + 底部标题
 */
const PathTreeNode = memo(({ data, selected }: NodeProps & { data: PathNodeData }) => {
  const { node, isSelected, locked, onSelect } = data;
  const isActuallyLocked = locked;
  const statusStyle = STATUS_STYLE[node.status];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止冒泡到 React Flow onNodeClick，避免选中后立即反选
    onSelect(node.id);
  };

  return (
    <div
      className="flex flex-col items-center cursor-pointer select-none"
      style={{ width: 140 }}
      onClick={handleClick}
    >
      {/* React Flow 连接点（隐藏，由 dagre 边自动连接） */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ visibility: 'hidden' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ visibility: 'hidden' }}
      />

      {/* 圆形节点主体 */}
      <div
        className="flex items-center justify-center rounded-full relative transition-transform duration-200"
        style={{
          width: 52,
          height: 52,
          background:
            isSelected
              ? 'var(--accent-light)'
              : isActuallyLocked
              ? 'var(--warm-sand)'
              : 'var(--ivory)',
          border: `2.5px solid ${
            isSelected ? 'var(--accent)' : statusStyle.ring
          }`,
          color:
            isActuallyLocked
              ? 'var(--stone-gray)'
              : isSelected
              ? 'var(--accent)'
              : statusStyle.ring,
          boxShadow: isSelected
            ? '0 0 0 4px rgba(201,100,66,0.15)'
            : '0 2px 8px rgba(42,27,24,0.06)',
          transform: isSelected ? 'scale(1.12)' : 'scale(1)',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.transform = 'scale(1.08)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.transform = 'scale(1)';
          }
        }}
      >
        {isActuallyLocked ? (
          <LockOutlined style={{ fontSize: 16 }} />
        ) : (
          TYPE_ICON[node.itemType]
        )}
      </div>

      {/* 标题 */}
      <span
        className="text-center mt-1.5 px-1"
        style={{
          fontSize: 11,
          fontWeight: isSelected ? 600 : 400,
          color: isActuallyLocked ? 'var(--stone-gray)' : 'var(--near-black)',
          lineHeight: 1.3,
          maxWidth: 130,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={node.title}
      >
        {node.title}
      </span>

      {/* 难度小标签 */}
      {!isActuallyLocked && (
        <span
          className="rounded px-1.5 py-0.5 mt-0.5"
          style={{
            fontSize: 9,
            background: 'var(--warm-sand)',
            color: 'var(--olive-gray)',
          }}
        >
          {DIFFICULTY_LABEL[node.detail.difficulty] ?? node.detail.difficulty}
        </span>
      )}
    </div>
  );
});

PathTreeNode.displayName = 'PathTreeNode';

export default PathTreeNode;
