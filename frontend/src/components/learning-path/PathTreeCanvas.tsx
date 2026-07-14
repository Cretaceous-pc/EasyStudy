import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { buildFlowGraph } from '../../utils/dagreLayout';
import PathTreeNode from './PathTreeNode';
import NodeTeachModal from './NodeTeachModal';
import type { TreeNode, PathNodeStatus } from '../../types/learningPath';

// ── 小地图样式 ──
const MINIMAP_STYLE: React.CSSProperties = {
  background: 'var(--ivory)',
  border: '1px solid var(--border-cream)',
  borderRadius: 8,
};

// ── 自定义节点类型 ──
const NODE_TYPES = {
  pathNode: PathTreeNode,
};

interface Props {
  nodes: TreeNode[];
  onStatusChange: (nodeId: string, status: PathNodeStatus) => void;
}

/**
 * React Flow 画布：树状 DAG 可视化
 * 使用受控模式（nodes/edges 作为 props），因为节点不可拖拽。
 */
export default function PathTreeCanvas({ nodes, onStatusChange }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const hasCentered = useRef(false);

  // ── 构建 React Flow 数据 ──
  const { flowNodes, flowEdges } = useMemo(() => {
    const { flowNodes: raw, flowEdges } = buildFlowGraph(nodes);

    // 预计算每个节点的锁定状态：pending 且存在未完成的依赖
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const isLocked = (n: TreeNode): boolean => {
      if (n.status !== 'pending') return false;
      return n.dependencies.some((depId) => {
        const dep = nodeMap.get(depId);
        return dep && dep.status !== 'completed';
      });
    };

    // 注入 onSelect + isSelected + locked
    const enriched = raw.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === selectedNodeId,
        locked: isLocked(nodeMap.get(n.id)!),
        onSelect: (id: string) => setSelectedNodeId((prev) => (prev === id ? null : id)),
      },
    }));
    return { flowNodes: enriched, flowEdges };
  }, [nodes, selectedNodeId]);

  // ── 选中节点 ──
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
    },
    [],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // ── 计算画布高度 ──
  const canvasHeight = useMemo(() => {
    let max = 0;
    for (const n of nodes) max = Math.max(max, n.depth);
    return Math.max(500, (max + 2) * 160);
  }, [nodes]);

  // ── 默认视角居中于顶端节点（仅首次渲染时执行一次） ──
  useEffect(() => {
    if (!rfInstance.current || flowNodes.length === 0 || hasCentered.current) return;
    hasCentered.current = true;
    // 找到根节点（depth = 0），取其平均位置作为初始中心
    const roots = flowNodes.filter((n) => (n.data.node as TreeNode).depth === 0);
    if (roots.length === 0) return;
    const avgX = roots.reduce((s, n) => s + n.position.x, 0) / roots.length + NODE_WIDTH / 2;
    const minY = Math.min(...roots.map((n) => n.position.y));
    // 中心在根节点下方偏移，使根节点出现在视口上部偏中
    rfInstance.current.setCenter(avgX, minY + 180, { zoom: 1, duration: 300 });
  }, [flowNodes]);

  // 节点尺寸常量（与 dagreLayout.ts 保持一致）
  const NODE_WIDTH = 140;

  return (
    <div className="flex-1 min-h-0 relative" style={{ height: canvasHeight }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={(instance) => { rfInstance.current = instance; }}
        nodeTypes={NODE_TYPES as any}
        minZoom={0.3}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--parchment)' }}
      >
        <Background color="var(--border-cream)" gap={24} />
        <Controls
          style={{
            background: 'var(--ivory)',
            border: '1px solid var(--border-cream)',
            borderRadius: 8,
          }}
        />
        <MiniMap
          style={MINIMAP_STYLE}
          nodeColor={(node) => {
            const data = node.data as any;
            const status = data?.node?.status as PathNodeStatus | undefined;
            switch (status) {
              case 'completed': return '#5b8c5a';
              case 'in_progress': return '#c96442';
              default: return '#b0aea5';
            }
          }}
          maskColor="rgba(42,27,24,0.06)"
        />
      </ReactFlow>

      {/* 节点教学弹窗 */}
      <NodeTeachModal
        node={selectedNode}
        visible={selectedNode !== null}
        onClose={() => setSelectedNodeId(null)}
        onStatusChange={(status) => {
          if (selectedNode) onStatusChange(selectedNode.id, status);
        }}
      />
    </div>
  );
}
