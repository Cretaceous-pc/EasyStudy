import { api } from './api';
import type { ApiResponse } from '../types/api';

/** 获取当前课程画像 */
export async function getProfile(params: { course_id: number }): Promise<{
  student_id: number;
  course_id: number;
  profile: Record<string, unknown>;
  version: number;
  last_updated_at: string;
}> {
  const res = await api.get<ApiResponse<{
    student_id: number;
    course_id: number;
    profile: Record<string, unknown>;
    version: number;
    last_updated_at: string;
  }>>('/api/ai/profile', { params });
  return res.data.data;
}

/** 手动更新画像维度 */
export async function updateProfile(data: {
  course_id: number;
  updates: Record<string, { value: unknown; label?: string }>;
}): Promise<{ profile: Record<string, unknown>; version: number }> {
  const res = await api.post<ApiResponse<{ profile: Record<string, unknown>; version: number }>>('/api/ai/profile/update', data);
  return res.data.data;
}

/** 画像变更历史 */
export async function getProfileHistory(params: {
  limit?: number;
}): Promise<{
  snapshots: Array<{
    version: number;
    profile: Record<string, unknown>;
    trigger: string;
    snapshot_at: string;
  }>;
}> {
  const res = await api.get<ApiResponse<{
    snapshots: Array<{
      version: number;
      profile: Record<string, unknown>;
      trigger: string;
      snapshot_at: string;
    }>;
  }>>('/api/ai/profile/history', { params });
  return res.data.data;
}

/** 冷启动检查（首次选课后触发画像冷启动对话） */
export async function coldStartProfile(data: {
  course_id: number;
}): Promise<{ need_cold_start: boolean; conversation_id?: number }> {
  const res = await api.post<ApiResponse<{ need_cold_start: boolean; conversation_id?: number }>>('/api/ai/profile/cold-start', data);
  return res.data.data;
}

/** 问卷初始化画像（注册后或重置后填写） */
export async function initProfile(data: {
  course_id: number;
  answers: Record<string, string | string[]>;
}): Promise<{ profile: Record<string, unknown>; version: number }> {
  const res = await api.post<ApiResponse<{ profile: Record<string, unknown>; version: number }>>('/api/ai/profile/init', data);
  return res.data.data;
}

/** 重置画像（清空所有维度数据） */
export async function resetProfile(data: { course_id: number }): Promise<void> {
  await api.post('/api/ai/profile/reset', null, { params: data });
}
