// ── 学习路径相关类型 ───────────────────────────
// 替代旧的 types/path.ts，扩展支持树状 DAG 图 + 问卷

import type { Node, Edge } from '@xyflow/react';

// ── 节点状态 & 类型（与后端对齐） ──
export type PathNodeStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type PathItemType = 'chapter' | 'resource' | 'exercise' | 'review';

// ── 节点详情（弹窗展示） ──
export interface NodeDetail {
  description: string;
  learningPoints: string[];
  resources: NodeResource[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  /** LLM 生成的教学正文（500-2000 字） */
  teachContent: string;
}

export interface NodeResource {
  title: string;
  url?: string;
  type: 'video' | 'article' | 'exercise' | 'book';
}

// ── 树节点（业务数据） ──
export interface TreeNode {
  id: string;
  /** 后端学习路径节点的数据库主键，用于状态更新 API */
  backendItemId: number;
  title: string;
  summary: string;
  itemType: PathItemType;
  itemRefId: number | null;
  status: PathNodeStatus;
  estimatedMinutes: number;
  /** 前置节点 id 列表 */
  dependencies: string[];
  /** dagre 计算的树深度 */
  depth: number;
  /** 弹窗详情 */
  detail: NodeDetail;
}

// ── 学习路径 ──
export interface LearningPath {
  id: string;
  courseId: number;
  courseTitle: string;
  nodes: TreeNode[];
  overallProgress: number;
  createdAt: string;
  updatedAt: string;
}

// ── 问卷 ──
export interface QuestionnaireAnswers {
  /** 学习的目的 */
  purpose: 'exam' | 'career' | 'interest' | 'research' | 'other';
  /** 预计每天学习时间 */
  dailyStudyTime: '<30min' | '30min-1h' | '1-2h' | '>2h';
  /** 期望深度 */
  depth: 'overview' | 'practical' | 'systematic' | 'expert';
  /** 当前水平 */
  level: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
  /** 想学习的具体内容（自由文本，最重要） */
  topic: string;
}

// ── React Flow 桥接类型 ──
/** 自定义节点 data */
export interface PathNodeData {
  node: TreeNode;
  isSelected: boolean;
  /** 是否因前置依赖未完成而被锁定 */
  locked: boolean;
  onSelect: (id: string) => void;
}

export type PathFlowNode = Node<PathNodeData>;
export type PathFlowEdge = Edge;
