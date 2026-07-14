import { api } from './api';
import type { ApiResponse, PageResponse } from '../types/api';
import type { Resource, ResourceType } from '../types/resource';

/** 资源列表 */
export async function getResourceList(params: {
  course_id: number;
  resource_type?: ResourceType;
  topic?: string;
  page?: number;
  page_size?: number;
}): Promise<PageResponse<{ resource_id: number; resource_type: string; title: string; topic: string; is_validated: boolean; created_at: string }>> {
  const res = await api.get<ApiResponse<PageResponse<{ resource_id: number; resource_type: string; title: string; topic: string; is_validated: boolean; created_at: string }>>>('/api/ai/resources', { params });
  return res.data.data;
}

/** 资源详情 */
export async function getResourceDetail(resourceId: number): Promise<{
  resource_id: number;
  resource_type: string;
  title: string;
  topic: string;
  content: Record<string, unknown>;
  source_chunks: Array<{ material_id: number; chapter: string; section: string; title: string }>;
  is_validated: boolean;
  status: string;
  created_at: string;
}> {
  const res = await api.get<ApiResponse<{
    resource_id: number;
    resource_type: string;
    title: string;
    topic: string;
    content: Record<string, unknown>;
    source_chunks: Array<{ material_id: number; chapter: string; section: string; title: string }>;
    is_validated: boolean;
    status: string;
    created_at: string;
  }>>(`/api/ai/resources/${resourceId}`);
  return res.data.data;
}

/** 资源生成 SSE URL（由 useSSE hook 处理） */
export const RESOURCE_GENERATE_URL = '/api/ai/resources/generate';
