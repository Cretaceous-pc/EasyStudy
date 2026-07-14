import { create } from 'zustand';
import type { Message, Conversation } from '../types/chat';
import * as chatService from '../services/chatService';
import { useAuthStore } from './authStore';
import { CHAT_SEND_URL } from '../services/chatService';

interface ChatStore {
  conversations: Conversation[];
  currentConversationId: number | null;
  currentMaterialId: number | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  error: string | null;

  // 同步 setter
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (id: number | null) => void;
  setCurrentMaterialId: (id: number | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendStreamingContent: (content: string) => void;
  setStreamingContent: (content: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  finalizeStreamingMessage: () => void;
  clearStreaming: () => void;

  // 异步 API action
  fetchConversations: (params?: { course_id?: number; page?: number; page_size?: number }) => Promise<void>;
  fetchMessages: (conversationId: number, params?: { before_id?: number; limit?: number }) => Promise<void>;
  switchConversation: (conversationId: number | null) => Promise<void>;
  /** 进入课件时：查询已有会话或新建 */
  enterCourseware: (courseId: number, materialId: number) => Promise<void>;
  /** 对当前课件新建会话 */
  newCoursewareSession: (courseId: number, materialId: number) => Promise<void>;
  /** 重新生成助手回复：删除原消息对 → SSE 重新发送用户消息 */
  regenerateMessage: (assistantIndex: number, courseId: number, materialId?: number) => Promise<void>;
  /** 删除（归档）会话 */
  deleteConversation: (conversationId: number) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  currentMaterialId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  isLoadingConversations: false,
  isLoadingMessages: false,
  error: null,

  // ── 同步 setter ──

  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  setCurrentMaterialId: (id) => set({ currentMaterialId: id }),
  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),

  appendStreamingContent: (content) =>
    set((s) => ({ streamingContent: s.streamingContent + content })),

  setStreamingContent: (content) => set({ streamingContent: content }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  finalizeStreamingMessage: () => {
    const { streamingContent, messages } = get();
    if (!streamingContent.trim()) return;
    const newMsg: Message = {
      message_id: Date.now(),
      role: 'assistant',
      content: streamingContent,
      created_at: new Date().toISOString(),
    };
    set({
      messages: [...messages, newMsg],
      streamingContent: '',
      isStreaming: false,
    });
  },

  clearStreaming: () =>
    set({ streamingContent: '', isStreaming: false }),

  // ── 异步 API action ──

  fetchConversations: async (params) => {
    set({ isLoadingConversations: true, error: null });
    try {
      const data = await chatService.getConversations(params ?? {});
      set({ conversations: data.items, isLoadingConversations: false });
    } catch (e) {
      set({ isLoadingConversations: false, error: (e as Error).message });
    }
  },

  fetchMessages: async (conversationId, params) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const data = await chatService.getMessages(conversationId, params);
      // 如果是加载更多（有 before_id），追加到前面；否则替换
      if (params?.before_id) {
        set((s) => ({
          messages: [...data.items, ...s.messages],
          isLoadingMessages: false,
        }));
      } else {
        set({ messages: data.items, isLoadingMessages: false });
      }
    } catch (e) {
      set({ isLoadingMessages: false, error: (e as Error).message });
    }
  },

  switchConversation: async (conversationId) => {
    set({ currentConversationId: conversationId, messages: [], error: null });
    if (conversationId !== null) {
      await get().fetchMessages(conversationId);
    }
  },

  /** 进入课件时：查询已有会话 → 有则加载、无则准备新建 */
  enterCourseware: async (courseId, materialId) => {
    set({ currentMaterialId: materialId, isLoadingMessages: true, error: null });
    try {
      const { exists, conversation } = await chatService.getConversationByMaterial(courseId, materialId);
      if (exists && conversation) {
        // 有历史会话 → 直接切换
        set({ currentConversationId: conversation.conversation_id });
        await get().fetchMessages(conversation.conversation_id);
        // 同时刷新对话列表
        get().fetchConversations({ course_id: courseId });
      } else {
        // 无历史会话 → 清空消息，等待首次发送时自动创建
        set({
          currentConversationId: null,
          messages: [],
          isLoadingMessages: false,
        });
      }
    } catch (e) {
      set({ isLoadingMessages: false, error: (e as Error).message });
    }
  },

  /** 对当前课件新建会话 */
  newCoursewareSession: async (courseId, materialId) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const { conversation_id } = await chatService.createNewSession(courseId, materialId);
      set({
        currentConversationId: conversation_id,
        messages: [],
        isLoadingMessages: false,
      });
      // 刷新对话列表
      get().fetchConversations({ course_id: courseId });
    } catch (e) {
      set({ isLoadingMessages: false, error: (e as Error).message });
    }
  },

  /** 删除（归档）会话 */
  deleteConversation: async (conversationId) => {
    // 乐观更新：立即从列表中移除
    const prev = get().conversations;
    set((s) => ({
      conversations: s.conversations.filter((c) => c.conversation_id !== conversationId),
    }));
    try {
      await chatService.deleteConversation(conversationId);
      // 如果删除的是当前会话，清空聊天区
      if (get().currentConversationId === conversationId) {
        set({ currentConversationId: null, messages: [] });
      }
    } catch (e) {
      // 回滚
      set({ conversations: prev, error: (e as Error).message });
    }
  },

  /** 重新生成助手回复：删除原消息对 → SSE 重新发送用户消息 */
  regenerateMessage: async (assistantIndex, courseId, materialId) => {
    const { messages, currentConversationId } = get();
    if (assistantIndex <= 0 || assistantIndex >= messages.length) return;

    // 找到前一条用户消息
    const userMsg = messages[assistantIndex - 1];
    const assistantMsg = messages[assistantIndex];
    if (userMsg.role !== 'user' || assistantMsg.role !== 'assistant') return;

    // 乐观删除：移除用户消息 + 助手消息对
    const newMessages = messages.filter(
      (_, i) => i !== assistantIndex - 1 && i !== assistantIndex,
    );
    set({ messages: newMessages, streamingContent: '', isStreaming: true });

    // 使用原生 fetch 做 SSE 流式请求（复用 useSSE 相同的模式）
    const token = useAuthStore.getState().token;
    const controller = new AbortController();

    try {
      const response = await fetch(CHAT_SEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          course_id: courseId,
          conversation_id: currentConversationId,
          message: userMsg.content,
          material_id: materialId ?? null,
          context_type: materialId ? 'courseware' : 'general',
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let timedOut = false;
      let handled = false;
      const READ_TIMEOUT_MS = 50000;

      while (true) {
        // Promise.race：read() vs 30s 超时
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('SSE_READ_TIMEOUT')), READ_TIMEOUT_MS),
            ),
          ]);
        } catch (e) {
          if ((e as Error).message === 'SSE_READ_TIMEOUT') {
            timedOut = true;
            controller.abort();
            if (handled) break;
            handled = true;
            const partial = get().streamingContent;
            if (partial) {
              get().appendStreamingContent('\n\n> ⚠️ 回复超时，请稍后重试');
            } else {
              get().setStreamingContent('> ⚠️ 回复超时，请稍后重试');
            }
            get().finalizeStreamingMessage();
            break;
          }
          throw e;
        }

        const { done, value } = readResult;
        if (done) break;
        if (timedOut) continue;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (timedOut) break;

          const lines = part.split('\n');
          let eventType = 'message';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            if (line.startsWith('data:')) data = line.slice(5).trim();
          }

          if (!data || timedOut) continue;

          try {
            const parsed = JSON.parse(data);

            if (eventType === 'conversation_created' && parsed.conversation_id) {
              if (!currentConversationId) {
                set({ currentConversationId: parsed.conversation_id });
                get().fetchConversations({ course_id: courseId });
              }
            }

            if (eventType === 'message' && typeof parsed.content === 'string') {
              if (!handled) get().appendStreamingContent(parsed.content);
            }

            if (eventType === 'done') {
              if (handled) break;
              handled = true;
              get().finalizeStreamingMessage();
            }
          } catch {
            // ignore malformed
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 超时或手动 abort — 不恢复消息对（已在超时分支中处理）
        return;
      }
      // 非超时错误：恢复被删除的消息对
      set((s) => {
        const restored = [...s.messages];
        const insertIdx = Math.min(assistantIndex - 1, restored.length);
        restored.splice(insertIdx, 0, userMsg);
        restored.splice(insertIdx + 1, 0, {
          ...assistantMsg,
          content: `[重新生成失败] ${(err as Error).message}`,
        });
        return {
          messages: restored,
          streamingContent: '',
          isStreaming: false,
        };
      });
    }
  },
}));
