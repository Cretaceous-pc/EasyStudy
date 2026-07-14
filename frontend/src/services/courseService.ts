import { api } from './api';
import type { ApiResponse, PageResponse } from '../types/api';
import type { Course, CourseDetail, CourseEnrollment } from '../types/course';

/** 课程列表 */
export async function getCourseList(params?: {
  page?: number;
  page_size?: number;
  subject?: string;
  status?: string;
}): Promise<PageResponse<Course>> {
  const res = await api.get<ApiResponse<PageResponse<Course>>>('/api/courses', { params });
  return res.data.data;
}

/** 课程详情 */
export async function getCourseDetail(courseId: number): Promise<CourseDetail> {
  const res = await api.get<ApiResponse<CourseDetail>>(`/api/courses/${courseId}`);
  return res.data.data;
}

/** 创建课程（教师/管理员） */
export async function createCourse(data: {
  title: string;
  description?: string;
  subject: string;
}): Promise<{ course_id: number; title: string; status: string; created_at: string }> {
  const res = await api.post<ApiResponse<{ course_id: number; title: string; status: string; created_at: string }>>('/api/courses', data);
  return res.data.data;
}

/** 更新课程（教师/管理员） */
export async function updateCourse(
  courseId: number,
  data: { title?: string; description?: string; status?: string }
): Promise<{ course_id: number; updated_at: string }> {
  const res = await api.put<ApiResponse<{ course_id: number; updated_at: string }>>(`/api/courses/${courseId}`, data);
  return res.data.data;
}

/** 选课（学生） */
export async function enrollCourse(courseId: number): Promise<void> {
  await api.post(`/api/courses/${courseId}/enroll`);
}

/** 退课 */
export async function unenrollCourse(courseId: number): Promise<void> {
  await api.delete(`/api/courses/${courseId}/enroll`);
}

/** 课程学生列表（教师） */
export async function getCourseStudents(
  courseId: number,
  params?: { page?: number; page_size?: number }
): Promise<PageResponse<{ user_id: number; display_name: string; enrolled_at: string; progress_percent: number; last_active_at: string }>> {
  const res = await api.get<ApiResponse<PageResponse<{ user_id: number; display_name: string; enrolled_at: string; progress_percent: number; last_active_at: string }>>>(`/api/courses/${courseId}/students`, { params });
  return res.data.data;
}

/** 我已选课程列表 */
export async function getMyEnrollments(): Promise<CourseEnrollment[]> {
  const res = await api.get<ApiResponse<CourseEnrollment[]>>('/api/courses/enrolled');
  return res.data.data;
}
