import { api } from './api';
import type { ApiResponse } from '../types/api';
import type { Material, MaterialContent } from '../types/material';

/** 课程资料列表 */
export async function getMaterialList(params: {
  course_id: number;
  material_type?: string;
  chapter?: string;
}): Promise<Material[]> {
  const res = await api.get<ApiResponse<Material[]>>('/api/materials', { params });
  return res.data.data;
}

/** 获取资料 MD 内容 */
export async function getMaterialContent(materialId: number): Promise<MaterialContent> {
  const res = await api.get<ApiResponse<MaterialContent>>(`/api/materials/${materialId}/content`);
  return res.data.data;
}

/** 上传课程资料（教师） */
export async function uploadMaterial(formData: FormData): Promise<{
  material_id: number;
  title: string;
  file_url: string;
  material_type: string;
  processing_status: string;
  created_at: string;
}> {
  const res = await api.post<ApiResponse<{
    material_id: number;
    title: string;
    file_url: string;
    material_type: string;
    processing_status: string;
    created_at: string;
  }>>('/api/materials/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

/** 删除资料（教师） */
export async function deleteMaterial(materialId: number): Promise<void> {
  await api.delete(`/api/materials/${materialId}`);
}
