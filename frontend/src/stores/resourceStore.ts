import { create } from 'zustand';
import type { Resource, GenerationProgress, ResourceType } from '../types/resource';
import * as resourceService from '../services/resourceService';
import { useAuthStore } from './authStore';

interface ResourceStore {
  resources: Resource[];
  isGenerating: boolean;
  isLoading: boolean;
  progress: GenerationProgress | null;
  selectedResourceId: string | null;
  error: string | null;

  // 同步 setter
  setResources: (resources: Resource[]) => void;
  addResource: (resource: Resource) => void;
  updateResource: (id: string, patch: Partial<Resource>) => void;
  setGenerating: (val: boolean) => void;
  setProgress: (progress: GenerationProgress | null) => void;
  selectResource: (id: string | null) => void;
  clear: () => void;

  // 异步 API action
  fetchResources: (params: { course_id: number; resource_type?: ResourceType; topic?: string; page?: number; page_size?: number }) => Promise<void>;
  fetchResourceDetail: (resourceId: number) => Promise<Resource | null>;
  generateResources: (params: { course_id: number; topic: string; resource_types: ResourceType[]; requirements?: string }) => Promise<void>;
}

export const useResourceStore = create<ResourceStore>((set, get) => ({
  resources: [],
  isGenerating: false,
  isLoading: false,
  progress: null,
  selectedResourceId: null,
  error: null,

  // ── 同步 setter ──

  setResources: (resources) => set({ resources }),

  addResource: (resource) =>
    set((s) => ({ resources: [resource, ...s.resources] })),

  updateResource: (id, patch) =>
    set((s) => ({
      resources: s.resources.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    })),

  setGenerating: (val) => set({ isGenerating: val }),
  setProgress: (progress) => set({ progress }),
  selectResource: (id) => set({ selectedResourceId: id }),

  clear: () =>
    set({
      resources: [],
      isGenerating: false,
      progress: null,
      selectedResourceId: null,
    }),

  // ── 异步 API action ──

  fetchResources: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const data = await resourceService.getResourceList(params);
      // 映射后端字段到前端 Resource 类型
      const resources: Resource[] = data.items.map((item) => ({
        id: String(item.resource_id),
        resource_type: item.resource_type as ResourceType,
        title: (item.title || '').replace(/^(document|mermaid|exercise_set|code_case|reading_material):\s*/i, ''),
        topic: item.topic ?? '',
        is_validated: item.is_validated ?? false,
        created_at: item.created_at ?? '',
        content: (item as any).content ?? {},
        source_chunks: (item as any).source_chunks ?? [],
        status: (item as any).status ?? 'completed',
      }));
      set({ resources, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message });
    }
  },

  fetchResourceDetail: async (resourceId) => {
    set({ error: null });
    try {
      const detail = await resourceService.getResourceDetail(resourceId);
      // 更新 resources 列表中对应项的详情
      const id = String(resourceId);
      set((s) => ({
        resources: s.resources.map((r) =>
          r.id === id
            ? {
                ...r,
                content: detail.content,
                source_chunks: detail.source_chunks,
                status: detail.status,
                is_validated: detail.is_validated,
              }
            : r
        ),
      }));
      return {
        id,
        resource_type: detail.resource_type as ResourceType,
        title: detail.title,
        topic: detail.topic,
        is_validated: detail.is_validated,
        created_at: detail.created_at,
        content: detail.content,
        source_chunks: detail.source_chunks,
        status: detail.status,
      } as Resource;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    }
  },

  generateResources: async (params) => {
    set({ isGenerating: true, progress: null, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(resourceService.RESOURCE_GENERATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          course_id: params.course_id,
          topic: params.topic,
          resource_types: params.resource_types,
          requirements: params.requirements ?? '',
        }),
      });

      if (!response.ok) {
        throw new Error(`资源生成请求失败: ${response.status}`);
      }
      if (!response.body) {
        throw new Error('SSE response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            if (line.startsWith('data:')) data = line.slice(5).trim();
          }

          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            switch (eventType) {
              case 'plan':
                set({
                  progress: {
                    current: 0,
                    total: parsed.resource_types?.length ?? 0,
                    status: 'planning',
                    message: `正在规划 ${parsed.resource_types?.length ?? 0} 种资源...`,
                  },
                });
                break;
              case 'progress':
                set({
                  progress: {
                    current: (get().progress?.current ?? 0) + 1,
                    total: get().progress?.total ?? 0,
                    status: 'generating',
                    message: `正在生成: ${parsed.resource_type ?? ''}`,
                  },
                });
                break;
              case 'resource':
                // 新增生成的资源到列表
                get().addResource({
                  id: String(parsed.resource_id ?? Date.now()),
                  resource_type: (parsed.resource_type ?? 'document') as ResourceType,
                  title: (parsed.title ?? '').replace(/^(document|mermaid|exercise_set|code_case|reading_material):\s*/i, ''),
                  topic: parsed.topic ?? '',
                  is_validated: parsed.is_validated ?? false,
                  created_at: parsed.created_at ?? new Date().toISOString(),
                  content: parsed.content ?? {},
                  source_chunks: parsed.source_chunks ?? [],
                  status: 'completed',
                });
                break;
              case 'done':
                set({ isGenerating: false, progress: null });
                // 重新拉取完整资源列表（含 content / created_at）
                get().fetchResources({ course_id: params.course_id });
                break;
              case 'error':
                set({ isGenerating: false, error: parsed.message ?? '生成失败' });
                break;
            }
          } catch {
            // ignore malformed JSON
          }
        }
      }

      // 流结束但未收到 done 事件
      if (get().isGenerating) {
        set({ isGenerating: false, progress: null });
        get().fetchResources({ course_id: params.course_id });
      }
    } catch (e) {
      set({ isGenerating: false, error: (e as Error).message });
    }
  },
}));
