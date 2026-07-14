import { api } from './api';
import type { ApiResponse } from '../types/api';
import type { QuestionnaireAnswers } from '../types/learningPath';

// ── 后端返回的原始节点格式 ──
interface PathItemRaw {
  item_id: number;
  seq_order: number;
  item_type: string;
  item_ref_id: number | null;
  title: string;
  summary: string;
  description: string;
  estimated_minutes: number;
  dependencies: number[];
  status: string;
  completed_at: string | null;
  teach_content?: string;
  // LLM 生成的详情扩展
  detail?: {
    description: string;
    learning_points: string[];
    resources: { title: string; url?: string; type: string }[];
    difficulty: string;
  };
}

interface PathRaw {
  path_id: number;
  items: PathItemRaw[];
  generated_at: string;
}

// ── API ──

/** 获取当前学习路径 */
export async function getLearningPath(params: {
  
}): Promise<PathRaw | null> {
  const res = await api.get<ApiResponse<PathRaw | null>>('/api/ai/path', { params });
  return res.data.data;
}

/** 生成/刷新学习路径（含问卷）— 超时 120s 匹配 LangGraph 全链路 */
export async function generateLearningPath(data: {
  course_id: number;
  force_regenerate?: boolean;
  questionnaire?: QuestionnaireAnswers;
}): Promise<PathRaw> {
  const res = await api.post<ApiResponse<PathRaw>>('/api/ai/path/generate', data, {
    timeout: 180000, // 3 分钟，匹配全链路超时
  });
  return res.data.data;
}

/** 更新路径节点状态 */
export async function updatePathItemStatus(
  itemId: number,
  data: { status: string }
): Promise<{ item_id: number; status: string; completed_at: string | null }> {
  const res = await api.put<ApiResponse<{ item_id: number; status: string; completed_at: string | null }>>(
    `/api/ai/path/items/${itemId}/status`,
    data
  );
  return res.data.data;
}
