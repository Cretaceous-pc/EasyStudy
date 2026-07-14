import { api } from './api';
import type { ApiResponse } from '../types/api';
import type { AuthResponse, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, UserInfo } from '../types/auth';

/** 用户登录 */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await api.post<ApiResponse<AuthResponse>>('/api/auth/login', data);
  return res.data.data;
}

/** 用户注册 */
export async function register(data: RegisterRequest): Promise<{ user_id: number; username: string; display_name: string; role: string }> {
  const res = await api.post<ApiResponse<{ user_id: number; username: string; display_name: string; role: string }>>('/api/auth/register', data);
  return res.data.data;
}

/** 刷新 Token */
export async function refreshToken(): Promise<{ access_token: string; expires_in: number }> {
  const res = await api.post<ApiResponse<{ access_token: string; expires_in: number }>>('/api/auth/refresh');
  return res.data.data;
}

/** 忘记密码 - 发送验证码 */
export async function forgotPassword(data: ForgotPasswordRequest): Promise<void> {
  await api.post<ApiResponse<null>>('/api/auth/forgot-password', data);
}

/** 重置密码 */
export async function resetPassword(data: ResetPasswordRequest): Promise<void> {
  await api.post<ApiResponse<null>>('/api/auth/reset-password', data);
}

/** 获取当前用户信息 */
export async function getMe(): Promise<UserInfo> {
  const res = await api.get<ApiResponse<UserInfo>>('/api/auth/me');
  return res.data.data;
}
