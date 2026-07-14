import { api } from './api';
import type { ApiResponse } from '../types/api';
import type { Conversation, Message } from '../types/chat';

/** 对话列表 */
export async function getConversations(params: {
  course_id?: number;
  page?: number;
  page_size?: number;
}): Promise<{ items: Conversation[]; total: number }> {
  const res = await api.get<ApiResponse<{ items: Conversation[]; total: number }>>('/api/ai/chat/conversations', { params });
  return res.data.data;
}

/** 对话历史 */
export async function getMessages(
  conversationId: number,
  params?: { before_id?: number; limit?: number }
): Promise<{ items: Message[]; has_more: boolean }> {
  const res = await api.get<ApiResponse<{ items: Message[]; has_more: boolean }>>(
    `/api/ai/chat/conversations/${conversationId}/messages`,
    { params }
  );
  return res.data.data;
}

/** 发送消息（SSE 流式，由 useSSE hook 处理，此处仅导出 URL） */
export const CHAT_SEND_URL = '/api/ai/chat/send';

/** 获取指定课件的活跃会话 */
export async function getConversationByMaterial(
  courseId: number,
  materialId: number,
): Promise<{ exists: boolean; conversation: Conversation | null }> {
  const res = await api.get<ApiResponse<{ exists: boolean; conversation: Conversation | null }>>(
    '/api/ai/chat/conversations/by-material',
    { params: { course_id: courseId, material_id: materialId } }
  );
  return res.data.data;
}

/** 对同一课件创建新会话（旧会话归档） */
export async function createNewSession(
  courseId: number,
  materialId: number,
): Promise<{ conversation_id: number; title: string }> {
  const res = await api.post<ApiResponse<{ conversation_id: number; title: string }>>(
    '/api/ai/chat/conversations/new',
    { course_id: courseId, material_id: materialId }
  );
  return res.data.data;
}

/** 删除（归档）会话 */
export async function deleteConversation(conversationId: number): Promise<void> {
  try {
    const res = await api.delete<ApiResponse<{ code: number; message: string }>>(`/api/ai/chat/conversations/${conversationId}`);
    const result = res.data.data || res.data;
    if (result?.code && result.code !== 0) {
      throw new Error(result.message || '删除失败');
    }
  } catch (e: any) {
    // 统一错误消息：区分网络错误和业务错误
    if (e instanceof Error && e.message) {
      throw e;
    }
    if (e?.response?.status === 405) {
      throw new Error('服务暂不支持删除，请先部署最新后端');
    }
    if (e?.response?.status === 404) {
      throw new Error('会话不存在或已被删除');
    }
    if (e?.response?.status === 403) {
      throw new Error('无权删除此会话');
    }
    if (e?.code === 'ERR_NETWORK') {
      throw new Error('网络连接失败，请检查服务是否启动');
    }
    throw new Error('删除失败：' + (e?.message || '未知错误'));
  }
}
