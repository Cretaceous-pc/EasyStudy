export type CourseStatus = 'draft' | 'published' | 'archived';

export interface Course {
  course_id: number;
  title: string;
  description?: string;
  subject: string;
  cover_url?: string;
  teacher_name: string;
  status: CourseStatus;
  student_count: number;
  created_at: string;
}

/**
 * 把后端返回的 status 字符串归一到 CourseStatus。
 * 后端 DTO 中 status 是普通 String，新建课程接口的返回类型在 TS 侧也只是
 * string；直接赋值会破坏窄联合类型并使后续状态判断失效。
 */
export function normalizeCourseStatus(status: unknown): CourseStatus {
  return status === 'published' || status === 'archived' ? status : 'draft';
}

export interface CourseDetail extends Course {
  teacher: {
    user_id: number;
    display_name: string;
  };
  materials_count: number;
  chapters: string[];
  updated_at: string;
}

/**
 * 我已选课程条目。
 *
 * 注意: 后端 GET /api/courses/enrolled 返回的是 List<CourseDto>
 * （CourseService.getEnrolledCourses 直接把 CourseDto 列表返回，
 *   仅把 created_at 覆盖为选课时间），因此字段与 Course 一致，
 *   不含 progress_percent。原类型定义声明了
 *   { course_id, title, progress_percent, enrolled_at } 与真实响应不符，
 *   导致 courseStore 中的映射被类型检查判为非法 —— 类型定义已按实际响应更正。
 */
export interface CourseEnrollment extends Course {}

