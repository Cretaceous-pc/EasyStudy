import { api } from './api';
import type { ApiResponse, PageResponse } from '../types/api';
import type { User, UserListQuery } from '../types/user';

/** 用户列表（管理员） */
export async function getUserList(params?: UserListQuery): Promise<PageResponse<User>> {
  const res = await api.get<ApiResponse<PageResponse<User>>>('/api/users', { params });
  return res.data.data;
}

/** 启用/禁用用户（管理员） */
export async function updateUserStatus(
  userId: number,
  data: { is_enabled: boolean }
): Promise<void> {
  await api.put(`/api/users/${userId}/status`, data);
}
