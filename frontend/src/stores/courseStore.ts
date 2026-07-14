import { create } from 'zustand';
import type { Course, CourseDetail, CourseEnrollment } from '../types/course';
import * as courseService from '../services/courseService';

interface CourseStore {
  enrolledCourses: Course[];
  allCourses: Course[];
  currentCourse: CourseDetail | null;
  activeCourseId: number | null;
  isLoading: boolean;
  error: string | null;

  // 同步 setter（内部使用）
  setEnrolledCourses: (courses: Course[]) => void;
  setAllCourses: (courses: Course[]) => void;
  setCurrentCourse: (course: CourseDetail | null) => void;
  setActiveCourseId: (id: number | null) => void;
  addEnrolledCourse: (course: Course) => void;

  // 异步 API action
  fetchAllCourses: (params?: { page?: number; page_size?: number; subject?: string }) => Promise<void>;
  fetchEnrolledCourses: () => Promise<void>;
  fetchCourseDetail: (courseId: number) => Promise<void>;
  enrollCourse: (courseId: number) => Promise<void>;
  unenrollCourse: (courseId: number) => Promise<void>;
  /** 切换到指定课程（设置 activeCourseId + 拉详情） */
  switchToCourse: (courseId: number) => Promise<void>;
}

export const useCourseStore = create<CourseStore>((set, get) => ({
  enrolledCourses: [],
  allCourses: [],
  currentCourse: null,
  activeCourseId: null,
  isLoading: false,
  error: null,

  setEnrolledCourses: (courses) => set({ enrolledCourses: courses }),
  setAllCourses: (courses) => set({ allCourses: courses }),
  setCurrentCourse: (course) => set({ currentCourse: course }),
  setActiveCourseId: (id) => set({ activeCourseId: id }),
  addEnrolledCourse: (course) =>
    set((s) => ({ enrolledCourses: [...s.enrolledCourses, course] })),

  // ── 异步 API action ──

  fetchAllCourses: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const data = await courseService.getCourseList(params);
      set({ allCourses: data.items, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message });
    }
  },

  fetchEnrolledCourses: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await courseService.getMyEnrollments();
      // CourseEnrollment 包含 course_id + 课程基本信息，映射为 Course 格式
      const courses: Course[] = data.map((enrollment) => ({
        course_id: enrollment.course_id,
        title: enrollment.title ?? '',
        description: enrollment.description ?? '',
        subject: enrollment.subject ?? '',
        teacher_name: enrollment.teacher_name ?? '',
        cover_url: enrollment.cover_url,
        student_count: enrollment.student_count ?? 0,
        status: enrollment.status ?? 'active',
        created_at: enrollment.enrolled_at ?? '',
        updated_at: '',
      }));
      set({ enrolledCourses: courses, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message });
    }
  },

  fetchCourseDetail: async (courseId) => {
    set({ isLoading: true, error: null });
    try {
      const detail = await courseService.getCourseDetail(courseId);
      set({ currentCourse: detail, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message });
    }
  },

  enrollCourse: async (courseId) => {
    set({ error: null });
    try {
      await courseService.enrollCourse(courseId);
      // refresh enrolled list
      await get().fetchEnrolledCourses();
      // 自动切换到这个课程
      await get().switchToCourse(courseId);
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  switchToCourse: async (courseId) => {
    set({ activeCourseId: courseId });
    await get().fetchCourseDetail(courseId);
  },

  unenrollCourse: async (courseId) => {
    set({ error: null });
    try {
      await courseService.unenrollCourse(courseId);
      set((s) => ({
        enrolledCourses: s.enrolledCourses.filter((c) => c.course_id !== courseId),
      }));
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },
}));
