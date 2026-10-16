import { create } from 'zustand';
import { notification } from 'antd';
import type {
  LearningPath,
  TreeNode,
  PathNodeStatus,
  QuestionnaireAnswers,
  NodeDetail,
} from '../types/learningPath';
import * as learningPathService from '../services/learningPathService';
import { useCourseStore } from './courseStore';
import { assignDepths } from '../utils/dagreLayout';

// ── localStorage 键 ──
const QUESTIONNAIRE_KEY = 'easystudy_questionnaire';

function loadQuestionnaire(): { has: boolean; data: QuestionnaireAnswers | null } {
  try {
    const raw = localStorage.getItem(QUESTIONNAIRE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as QuestionnaireAnswers;
      // 基本校验：至少 topic 字段存在
      if (data && typeof data.topic === 'string') {
        return { has: true, data };
      }
    }
  } catch { /* ignore corrupt data */ }
  return { has: false, data: null };
}

function saveQuestionnaire(answers: QuestionnaireAnswers): void {
  try {
    localStorage.setItem(QUESTIONNAIRE_KEY, JSON.stringify(answers));
  } catch { /* storage full or unavailable */ }
}

function clearQuestionnaire(): void {
  try {
    localStorage.removeItem(QUESTIONNAIRE_KEY);
  } catch { /* ignore */ }
}

// ── 后端原始数据 → TreeNode 映射 ──
function mapRawToTreeNode(raw: {
  item_id: number;
  seq_order: number;
  item_type: string;
  item_ref_id: number | null;
  title: string;
  summary?: string;
  description?: string;
  estimated_minutes: number;
  dependencies: number[];
  status: string;
  teach_content?: string;
  detail?: {
    description: string;
    learning_points: string[];
    resources: { title: string; url?: string; type: string }[];
    difficulty: string;
  };
}): TreeNode {
  return {
    id: String(raw.seq_order),
    backendItemId: raw.item_id,
    title: raw.title,
    summary: raw.summary ?? raw.description?.slice(0, 60) ?? '',
    itemType: (raw.item_type ?? 'chapter') as TreeNode['itemType'],
    itemRefId: raw.item_ref_id ?? null,
    status: (raw.status || 'pending') as PathNodeStatus,
    estimatedMinutes: raw.estimated_minutes ?? 30,
    dependencies: (raw.dependencies ?? []).map(String),
    depth: 0,
    detail: {
      description: raw.detail?.description ?? raw.description ?? '',
      learningPoints: raw.detail?.learning_points ?? [],
      resources: (raw.detail?.resources ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        type: r.type as NodeDetail['resources'][0]['type'],
      })),
      difficulty: (raw.detail?.difficulty ?? 'beginner') as NodeDetail['difficulty'],
      teachContent: raw.teach_content ?? '',
    },
  };
}

// ── Store 接口 ──
interface LearningPathStore {
  // 问卷（全局仅一次）
  hasQuestionnaire: boolean;
  questionnaire: QuestionnaireAnswers | null;
  submitQuestionnaire: (answers: QuestionnaireAnswers, forceRegenerate?: boolean) => Promise<void>;

  // 路径数据
  path: LearningPath | null;
  isLoading: boolean;
  error: string | null;

  // API actions
  fetchPath: (courseId: number) => Promise<void>;
  generatePath: (courseId: number, forceRegenerate?: boolean) => Promise<void>;
  updateNodeStatus: (nodeId: string, status: PathNodeStatus) => Promise<void>;

  // UI 状态
  selectedNodeId: string | null;
  selectNode: (nodeId: string | null) => void;

  // 同步 setter
  setLoading: (val: boolean) => void;
}

export const useLearningPathStore = create<LearningPathStore>((set, get) => {
  const stored = loadQuestionnaire();

  return {
  // ── 问卷 ──
  hasQuestionnaire: stored.has,
  questionnaire: stored.data,

  submitQuestionnaire: async (answers, forceRegenerate = false) => {
    set({ questionnaire: answers, hasQuestionnaire: true });
    saveQuestionnaire(answers);

    const courseId =
      useCourseStore.getState().activeCourseId ??
      useCourseStore.getState().enrolledCourses[0]?.course_id ??
      1;

    // 路径生成完全基于问卷答案
    await get().generatePath(courseId, forceRegenerate);

    const key = `path-gen-${Date.now()}`;
    const isRegen = forceRegenerate;
    notification.success({
      key,
      message: isRegen ? '学习路径已更新' : '学习路径已生成',
      description: isRegen
        ? '已根据新偏好重新定制了学习路径与教学内容'
        : 'AI 已为你定制了个性化学习路径与教学内容',
      placement: 'bottomRight',
      duration: 0,
      btn: (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => notification.destroy(key)}
            style={{
              padding: '4px 14px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--border-cream)',
              background: 'transparent',
              color: 'var(--olive-gray)',
              cursor: 'pointer',
            }}
          >
            稍后查看
          </button>
          <button
            onClick={() => {
              notification.destroy(key);
            }}
            style={{
              padding: '4px 14px',
              fontSize: 12,
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            知道了
          </button>
        </div>
      ),
    });
  },

  // ── 路径 ──
  path: null,
  isLoading: false,
  error: null,

  fetchPath: async (courseId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await learningPathService.getLearningPath({ course_id: courseId });
      if (data && data.items.length > 0) {
        const courseTitle =
          useCourseStore.getState()
            .enrolledCourses.find((c) => c.course_id === courseId)?.title ?? '';

        let nodes: TreeNode[] = data.items.map(mapRawToTreeNode);
        nodes = assignDepths(nodes);

        const completed = nodes.filter((n) => n.status === 'completed').length;
        const path: LearningPath = {
          id: String(data.path_id),
          courseId,
          courseTitle,
          nodes,
          overallProgress: nodes.length > 0 ? Math.round((completed / nodes.length) * 100) : 0,
          createdAt: data.generated_at ?? '',
          updatedAt: data.generated_at ?? '',
        };
        set({ path, isLoading: false, hasQuestionnaire: true }); // 已有路径，自动恢复问卷状态
        clearQuestionnaire(); // 问卷已消费，清理 localStorage
      } else {
        set({ path: null, isLoading: false });
      }
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message });
    }
  },

  generatePath: async (courseId, forceRegenerate = false) => {
    const { questionnaire } = get();
    set({ isLoading: true, error: null });
    let generated = false;
    try {
      await learningPathService.generateLearningPath({
        course_id: courseId,
        force_regenerate: forceRegenerate,
        questionnaire: questionnaire ?? undefined,
      });
      generated = true;
      await get().fetchPath(courseId);
    } catch (e) {
      // 若生成已成功仅刷新失败：清空旧路径，强制展示空状态+重试按钮
      if (generated) {
        set({ path: null, isLoading: false, error: '路径已生成，但加载失败，请重试' });
      } else {
        set({ isLoading: false, error: (e as Error).message });
      }
    }
  },

  updateNodeStatus: async (nodeId, status) => {
    const prevPath = get().path;
    if (prevPath) {
      const newNodes = prevPath.nodes.map((n) =>
        n.id === nodeId ? { ...n, status } : n
      );
      const completed = newNodes.filter((n) => n.status === 'completed').length;
      set({
        path: {
          ...prevPath,
          nodes: newNodes,
          overallProgress: Math.round((completed / newNodes.length) * 100),
          updatedAt: new Date().toISOString(),
        },
        error: null, // 清除之前的错误
      });
    }

    try {
      const node = prevPath?.nodes.find((n) => n.id === nodeId);
      if (node?.backendItemId) {
        await learningPathService.updatePathItemStatus(node.backendItemId, { status });
      }
    } catch (e) {
      set({ path: prevPath, error: (e as Error).message });
    }
  },

  // ── UI 状态 ──
  selectedNodeId: null,
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  // ── 同步 setter ──
  setLoading: (val) => set({ isLoading: val }),
}; });
