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

/**
 * 清空所有"与当前用户绑定"的 store。
 *
 * 原实现 logout 只清 authStore，其余 store（chat/course/resource/profile/
 * teacher）都是模块级单例且从不清空。同一浏览器内 A 退出、B 登录后，
 * 在 B 首次请求返回之前，界面会渲染出 A 的消息、课程与资源 —— 跨用户数据泄漏。
 *
 * 这里用动态 import 避免 store 之间的循环依赖（authStore 被 api.ts 引用，
 * 而各 store 又通过 service 间接引用 api.ts）。
 * layoutStore 故意不重置：它只保存界面偏好（当前视图、面板开关），不含用户数据。
 */
export function resetUserScopedStores() {
  void Promise.all([
    import('./chatStore'),
    import('./courseStore'),
    import('./resourceStore'),
    import('./profileStore'),
    import('./teacherStore'),
    import('./learningPathStore'),
  ])
    .then(([chat, course, resource, profile, teacher, learningPath]) => {
      chat.useChatStore.getState().resetAll?.();
      course.useCourseStore.setState({
        enrolledCourses: [],
        allCourses: [],
        currentCourse: null,
        activeCourseId: null,
        error: null,
      });
      resource.useResourceStore.getState().clear?.();
      profile.useProfileStore.setState({
        profile: null,
        history: [],
        editingDimensions: [],
        isEditing: false,
        error: null,
      });
      teacher.useTeacherStore.setState({
        myCourses: [],
        courseMaterials: [],
        selectedCourseId: null,
        error: null,
      });
      learningPath.useLearningPathStore.setState({ path: null, selectedNodeId: null });
    })
    .catch((e) => {
      console.warn('[authStore] 重置用户级 store 失败:', e);
    });
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
    resetUserScopedStores();
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
