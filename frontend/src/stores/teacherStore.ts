import { create } from 'zustand';
import { normalizeCourseStatus } from '../types/course';
import type { Course } from '../types/course';
import type { Material } from '../types/material';
import * as courseService from '../services/courseService';
import * as materialService from '../services/materialService';

interface TeacherStore {
  myCourses: Course[];
  courseMaterials: Material[];
  selectedCourseId: number | null;
  uploadProgress: number;
  isUploading: boolean;
  isLoading: boolean;
  error: string | null;

  // 同步 setter
  setMyCourses: (courses: Course[]) => void;
  addCourse: (course: Course) => void;
  updateCourse: (courseId: number, updates: Partial<Course>) => void;
  removeCourse: (courseId: number) => void;
  setCourseMaterials: (materials: Material[]) => void;
  addMaterial: (material: Material) => void;
  removeMaterial: (materialId: number) => void;
  setSelectedCourseId: (id: number | null) => void;
  setUploadProgress: (progress: number) => void;
  setIsUploading: (uploading: boolean) => void;

  // 异步 API action
  fetchMyCourses: () => Promise<void>;
  fetchCourseMaterials: (courseId: number) => Promise<void>;
  createCourse: (data: { title: string; description?: string; subject: string }) => Promise<Course | null>;
  updateCourseAPI: (courseId: number, data: { title?: string; description?: string; status?: string }) => Promise<void>;
  removeCourseAPI: (courseId: number) => Promise<void>;
  uploadMaterial: (formData: FormData) => Promise<void>;
  deleteMaterial: (materialId: number) => Promise<void>;
}

export const useTeacherStore = create<TeacherStore>((set, get) => ({
  myCourses: [],
  courseMaterials: [],
  selectedCourseId: null,
  uploadProgress: 0,
  isUploading: false,
  isLoading: false,
  error: null,

  // ── 同步 setter ──

  setMyCourses: (courses) => set({ myCourses: courses }),
  addCourse: (course) =>
    set((s) => ({ myCourses: [...s.myCourses, course] })),
  updateCourse: (courseId, updates) =>
    set((s) => ({
      myCourses: s.myCourses.map((c) =>
        c.course_id === courseId ? { ...c, ...updates } : c
      ),
    })),
  removeCourse: (courseId) =>
    set((s) => ({
      myCourses: s.myCourses.filter((c) => c.course_id !== courseId),
    })),
  setCourseMaterials: (materials) => set({ courseMaterials: materials }),
  addMaterial: (material) =>
    set((s) => ({ courseMaterials: [...s.courseMaterials, material] })),
  removeMaterial: (materialId) =>
    set((s) => ({
      courseMaterials: s.courseMaterials.filter(
        (m) => m.material_id !== materialId
      ),
    })),
  setSelectedCourseId: (id) => set({ selectedCourseId: id }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  setIsUploading: (uploading) => set({ isUploading: uploading }),

  // ── 异步 API action ──

  fetchMyCourses: async () => {
    set({ isLoading: true, error: null });
    try {
      // 教师视角：获取自己创建的课程
      const data = await courseService.getCourseList({ page_size: 100 });
      set({ myCourses: data.items, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message });
    }
  },

  fetchCourseMaterials: async (courseId) => {
    set({ isLoading: true, error: null });
    try {
      // materialService.getMaterialList 返回的是 Material[]（后端
      // GET /api/materials 直接返回数组）。原实现取 data.items，
      // 恒为 undefined，视图层 .map() 会抛 TypeError 导致白屏。
      const data = await materialService.getMaterialList({ course_id: courseId });
      set({ courseMaterials: data ?? [], selectedCourseId: courseId, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message });
    }
  },

  createCourse: async (data) => {
    set({ error: null });
    try {
      const result = await courseService.createCourse(data);
      const newCourse: Course = {
        course_id: result.course_id,
        title: result.title,
        description: data.description ?? '',
        subject: data.subject,
        teacher_name: '',
        student_count: 0,
        status: normalizeCourseStatus(result.status),
        created_at: result.created_at,
      };
      set((s) => ({ myCourses: [...s.myCourses, newCourse] }));
      return newCourse;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    }
  },

  updateCourseAPI: async (courseId, data) => {
    set({ error: null });
    try {
      await courseService.updateCourse(courseId, data);
      // API 成功后更新本地 store。
      // 注意 status 来自自由字符串，需要归一化后再写回，否则会把非法字面量
      // 塞进 Course.status（窄联合类型），使后续判断全部落空。
      // 注意: updateCourse 接口的入参 status 是自由 string，而 Course.status 是
      // 窄联合类型。直接展开 data 会把 string 塞进 Course，故只挑取类型安全的字段，
      // 并对 status 做归一化。
      const patch: Partial<Course> = {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      };
      if (data.status !== undefined) patch.status = normalizeCourseStatus(data.status);
      set((s) => ({
        myCourses: s.myCourses.map((c) =>
          c.course_id === courseId ? { ...c, ...patch } : c
        ),
      }));
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  removeCourseAPI: async (courseId) => {
    set({ error: null });
    try {
      // 目前后端没有 DELETE /api/courses/{id}，使用 updateCourse 状态设为 archived
      await courseService.updateCourse(courseId, { status: 'archived' });
      set((s) => ({
        myCourses: s.myCourses.filter((c) => c.course_id !== courseId),
      }));
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  uploadMaterial: async (formData) => {
    set({ isUploading: true, uploadProgress: 0, error: null });
    try {
      const result = await materialService.uploadMaterial(formData);
      const newMaterial: Material = {
        material_id: result.material_id,
        title: result.title,
        file_url: result.file_url,
        material_type: result.material_type as Material['material_type'],
        processing_status: result.processing_status,
        created_at: result.created_at,
        course_id: get().selectedCourseId ?? 0,
        file_size: 0,
        chapter: '',
      };
      set((s) => ({
        courseMaterials: [...s.courseMaterials, newMaterial],
        isUploading: false,
        uploadProgress: 100,
      }));
    } catch (e) {
      set({ isUploading: false, uploadProgress: 0, error: (e as Error).message });
      throw e;
    }
  },

  deleteMaterial: async (materialId) => {
    set({ error: null });
    try {
      await materialService.deleteMaterial(materialId);
      set((s) => ({
        courseMaterials: s.courseMaterials.filter(
          (m) => m.material_id !== materialId
        ),
      }));
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },
}));
