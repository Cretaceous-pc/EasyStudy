import { create } from 'zustand';
import type { User, UserListQuery } from '../types/user';
import * as userService from '../services/userService';

interface AdminStore {
  users: User[];
  userQuery: UserListQuery;
  userTotal: number;
  isLoading: boolean;
  error: string | null;

  // 同步 setter
  setUsers: (users: User[]) => void;
  updateUser: (userId: number, updates: Partial<User>) => void;
  setUserQuery: (query: Partial<UserListQuery>) => void;
  setUserTotal: (total: number) => void;
  setIsLoading: (loading: boolean) => void;

  // 异步 API action
  fetchUsers: (query?: Partial<UserListQuery>) => Promise<void>;
  updateUserStatus: (userId: number, isEnabled: boolean) => Promise<void>;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  users: [],
  userQuery: { page: 1, page_size: 20 },
  userTotal: 0,
  isLoading: false,
  error: null,

  // ── 同步 setter ──

  setUsers: (users) => set({ users }),
  updateUser: (userId, updates) =>
    set((s) => ({
      users: s.users.map((u) =>
        u.user_id === userId ? { ...u, ...updates } : u
      ),
    })),
  setUserQuery: (query) =>
    set((s) => ({ userQuery: { ...s.userQuery, ...query } })),
  setUserTotal: (total) => set({ userTotal: total }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  // ── 异步 API action ──

  fetchUsers: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const mergedQuery = { ...get().userQuery, ...query };
      set({ userQuery: mergedQuery });
      const data = await userService.getUserList(mergedQuery);
      set({
        users: data.items,
        userTotal: data.total,
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message });
    }
  },

  updateUserStatus: async (userId, isEnabled) => {
    // 乐观更新
    set((s) => ({
      users: s.users.map((u) =>
        u.user_id === userId ? { ...u, is_enabled: isEnabled } : u
      ),
    }));
    try {
      await userService.updateUserStatus(userId, { is_enabled: isEnabled });
    } catch (e) {
      // 回滚乐观更新
      set((s) => ({
        users: s.users.map((u) =>
          u.user_id === userId ? { ...u, is_enabled: !isEnabled } : u
        ),
        error: (e as Error).message,
      }));
    }
  },
}));
