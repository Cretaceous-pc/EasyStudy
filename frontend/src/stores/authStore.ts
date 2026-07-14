import { create } from 'zustand';
import type { UserInfo } from '../types/auth';

const TOKEN_KEY = 'easystudy_token';
const USER_KEY = 'easystudy_user';

/** 从 localStorage 恢复初始状态 */
function getInitialToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getInitialUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

interface AuthStore {
  token: string | null;
  userInfo: UserInfo | null;
  isAuthenticated: boolean;
  isChecking: boolean;
  justRegistered: boolean;

  login: (token: string, user: UserInfo) => void;
  logout: () => void;
  setUserInfo: (user: UserInfo) => void;
  checkAuth: () => Promise<void>;
  clearJustRegistered: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // 初始化时从 localStorage 恢复（刷新页面不丢失认证）
  token: getInitialToken(),
  userInfo: getInitialUser(),
  isAuthenticated: false,  // 初始为 false，等 checkAuth 验证通过后再设为 true
  isChecking: !!getInitialToken(),  // 有 token 时才需要验证
  justRegistered: false,

  login: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, userInfo: user, isAuthenticated: true, isChecking: false });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, userInfo: null, isAuthenticated: false, isChecking: false });
  },

  setUserInfo: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ userInfo: user });
  },

  clearJustRegistered: () => set({ justRegistered: false }),

  /** 验证 token 有效性：调用 /api/auth/me，失败则清除认证状态 */
  checkAuth: async () => {
    const token = get().token;
    if (!token) {
      set({ isChecking: false });
      return;
    }
    try {
      const { getMe } = await import('../services/authService');
      const user = await getMe();
      // Token 有效，更新用户信息并确认认证状态
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ userInfo: user, isAuthenticated: true, isChecking: false });
    } catch {
      // Token 无效或过期，清除认证状态
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ token: null, userInfo: null, isAuthenticated: false, isChecking: false });
    }
  },
}));
