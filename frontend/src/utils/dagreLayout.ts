import { graphlib, layout } from '@dagrejs/dagre';
import type { TreeNode, PathFlowNode, PathFlowEdge } from '../types/learningPath';

// ── dagre 布局配置 ──
const DAGRE_CONFIG = {
  rankdir: 'TB' as const,    // 从上到下
  nodesep: 80,               // 同层节点水平间距
  ranksep: 120,              // 层级垂直间距
  marginx: 60,
  marginy: 60,
};

// ── React Flow 节点尺寸 ──
const NODE_WIDTH = 140;
const NODE_HEIGHT = 80;

/**
 * 将业务 TreeNode[] 转换为 React Flow 的 Node[] + Edge[]
 * 使用 dagre 计算布局坐标
 */
export function buildFlowGraph(nodes: TreeNode[]): {
  flowNodes: PathFlowNode[];
  flowEdges: PathFlowEdge[];
} {
  if (nodes.length === 0) return { flowNodes: [], flowEdges: [] };

  const g = new graphlib.Graph({ multigraph: false, compound: false });
  g.setGraph(DAGRE_CONFIG);
  g.setDefaultEdgeLabel(() => ({}));

  // 注册节点（指定尺寸供 dagre 计算）
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // 注册边（dependencies → 当前节点）
  const edgeSet = new Set<string>();
  for (const node of nodes) {
    for (const depId of node.dependencies) {
      const edgeKey = `${depId}->${node.id}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        g.setEdge(depId, node.id);
      }
    }
  }

  // 执行布局
  layout(g);

  // 构建 React Flow nodes
  const flowNodes: PathFlowNode[] = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      type: 'pathNode',
      position: {
        x: (pos?.x ?? 0) - NODE_WIDTH / 2,
        y: pos?.y ?? 0,
      },
      data: {
        node,
        isSelected: false,
        locked: false,
        onSelect: () => {}, // 由调用方注入
      },
      draggable: false,
      selectable: true,
    };
  });

  // 构建 React Flow edges（利用已去重的 edgeSet）
  const flowEdges: PathFlowEdge[] = [];
  for (const key of edgeSet) {
    const [source, target] = key.split('->');
    flowEdges.push({
      id: `${source}-${target}`,
      source,
      target,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: 'var(--border-cream)',
        strokeWidth: 2,
      },
    });
  }

  return { flowNodes, flowEdges };
}

/**
 * 计算树的最大深度（用于设置画布高度）
 */
export function getMaxDepth(nodes: TreeNode[]): number {
  let max = 0;
  for (const n of nodes) {
    if (n.depth > max) max = n.depth;
  }
  return max;
}

/**
 * 为节点计算 depth（拓扑排序层级）
 */
export function assignDepths(nodes: TreeNode[]): TreeNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, n.dependencies.length);
    adj.set(n.id, []);
  }
  for (const n of nodes) {
    for (const dep of n.dependencies) {
      const list = adj.get(dep);
      if (list) list.push(n.id);
    }
  }

  // Kahn's algorithm for topological sort, tracking depth
  const queue: string[] = [];
  const depth = new Map<string, number>();

  for (const n of nodes) {
    if (inDegree.get(n.id) === 0) {
      queue.push(n.id);
      depth.set(n.id, 0);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depth.get(current) ?? 0;
    for (const neighbor of adj.get(current) ?? []) {
      const newDepth = currentDepth + 1;
      depth.set(neighbor, Math.max(depth.get(neighbor) ?? 0, newDepth));
      const d = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, d);
      if (d === 0) queue.push(neighbor);
    }
  }

  // 孤岛节点 depth = 0
  return nodes.map((n) => ({
    ...n,
    depth: depth.get(n.id) ?? 0,
  }));
}
