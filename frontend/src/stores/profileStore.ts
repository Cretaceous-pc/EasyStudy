import { create } from 'zustand';
import type { StudentProfile, ProfileSnapshot, ProfileDimension } from '../types/profile';
import { buildSummary, normalizeScore, DIMENSION_NAMES } from '../types/profile';
import * as profileService from '../services/profileService';

interface ProfileStore {
  profile: StudentProfile | null;
  history: ProfileSnapshot[];
  isEditing: boolean;
  editingDimensions: ProfileDimension[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  setProfile: (profile: StudentProfile | null) => void;
  updateDimension: (key: string, value: number) => void;
  startEditing: () => void;
  cancelEditing: () => void;

  fetchProfile: (courseId: number) => Promise<void>;
  fetchHistory: (courseId: number, limit?: number) => Promise<void>;
  saveEditing: () => Promise<void>;
  coldStart: (courseId: number) => Promise<{ need_cold_start: boolean; conversation_id?: number } | null>;
  resetProfile: (courseId: number) => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  history: [],
  isEditing: false,
  editingDimensions: [],
  isLoading: false,
  isSaving: false,
  error: null,

  setProfile: (profile) =>
    set({ profile, editingDimensions: profile?.dimensions ?? [] }),

  updateDimension: (key, value) =>
    set((s) => ({
      editingDimensions: s.editingDimensions.map((d) =>
        d.key === key ? { ...d, value: Math.min(100, Math.max(0, value)) } : d
      ),
    })),

  startEditing: () =>
    set((s) => ({
      isEditing: true,
      editingDimensions: s.profile?.dimensions.map((d) => ({ ...d })) ?? [],
    })),

  cancelEditing: () =>
    set((s) => ({
      isEditing: false,
      editingDimensions: s.profile?.dimensions ?? [],
    })),

  fetchProfile: async (courseId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await profileService.getProfile({ course_id: courseId });
      const profile = mapApiToProfile(data, courseId);
      // 空画像（profile 为 {}）视为未初始化，回退到默认页
      set({ profile, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message });
    }
  },

  fetchHistory: async (courseId, limit = 20) => {
    set({ error: null });
    try {
      const data = await profileService.getProfileHistory({ course_id: courseId, limit });
      const snapshots: ProfileSnapshot[] = (data.snapshots ?? []).map((s) => {
        const dims = Object.entries(s.profile ?? {}).map(([key, val]: [string, unknown]) => {
          const v = val as Record<string, unknown>;
          const raw = v.value ?? v.score ?? 0;
          return {
            key,
            label: DIMENSION_NAMES[key] ?? key,
            value: normalizeScore(key, raw),
            rawValue: (v.label ?? raw) as string | number,
          };
        });
        return {
          id: `v${s.version}-${s.snapshot_at}`,
          summary: buildSummary(dims),
          createdAt: s.snapshot_at,
          trigger: s.trigger,
        };
      });
      set({ history: snapshots });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  saveEditing: async () => {
    const { editingDimensions, profile } = get();
    if (!profile) return;

    set({ isSaving: true, error: null });
    try {
      const updates: Record<string, { value: unknown; label?: string }> = {};
      for (const dim of editingDimensions) {
        updates[dim.key] = { value: dim.value, label: dim.label };
      }
      await profileService.updateProfile({ course_id: profile.course_id, updates });

      const newDimensions = editingDimensions.map((d) => ({ ...d }));
      const newProfile: StudentProfile = {
        ...profile,
        dimensions: newDimensions,
        summary: buildSummary(newDimensions),
        updated_at: new Date().toISOString(),
      };
      set({ profile: newProfile, isEditing: false, isSaving: false });
    } catch (e) {
      set({ isSaving: false, error: (e as Error).message });
    }
  },

  coldStart: async (courseId) => {
    set({ error: null });
    try {
      return await profileService.coldStartProfile({ course_id: courseId });
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    }
  },

  resetProfile: async (courseId) => {
    set({ isSaving: true, error: null });
    try {
      await profileService.resetProfile({ course_id: courseId });
      set({
        profile: null,
        history: [],
        isSaving: false,
        isEditing: false,
        editingDimensions: [],
      });
    } catch (e) {
      set({ isSaving: false, error: (e as Error).message });
      throw e;
    }
  },
}));

/** 将 API 返回的 JSON profile 转为前端 StudentProfile */
function mapApiToProfile(
  data: { student_id: number; course_id?: number; profile: Record<string, unknown>; version: number; last_updated_at: string },
  courseId: number,
): StudentProfile | null {
  const raw = data.profile ?? {};

  // 后端可能返回 profile: {}（空对象），表示画像尚未初始化
  if (Object.keys(raw).length === 0) return null;

  const dimensions: ProfileDimension[] = Object.entries(raw).map(([key, val]) => {
    const v = val as Record<string, unknown>;
    const raw = v.value ?? v.score ?? 0;
    return {
      key,
      label: DIMENSION_NAMES[key] ?? key,
      value: normalizeScore(key, raw),
      rawValue: (v.label ?? raw) as string | number,
      description: v.description as string | undefined,
    };
  });

  return {
    student_id: data.student_id,
    course_id: data.course_id ?? courseId,
    dimensions,
    version: data.version,
    updated_at: data.last_updated_at,
    summary: buildSummary(dimensions),
  };
}
