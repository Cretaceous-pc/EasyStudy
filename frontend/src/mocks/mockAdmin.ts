import { useAdminStore } from '../stores/adminStore';
import { useAuthStore } from '../stores/authStore';

export function seedAdminMock() {
  const authStore = useAuthStore.getState();
  const user = authStore.userInfo;

  // 只有管理员角色才注入管理端数据
  if (!user || !user.roles.includes('ROLE_ADMIN')) {
    return;
  }

  const adminStore = useAdminStore.getState();

  adminStore.setUsers([
    {
      user_id: 1,
      username: 'zhangsan',
      display_name: '张三',
      email: 'zhangsan@example.com',
      roles: ['ROLE_STUDENT'],
      is_enabled: true,
      created_at: '2026-05-20T08:00:00Z',
    },
    {
      user_id: 2,
      username: 'lisi',
      display_name: '李四',
      email: 'lisi@example.com',
      roles: ['ROLE_STUDENT'],
      is_enabled: true,
      created_at: '2026-05-21T09:00:00Z',
    },
    {
      user_id: 3,
      username: 'wangwu',
      display_name: '王五',
      email: 'wangwu@example.com',
      roles: ['ROLE_STUDENT'],
      is_enabled: false,
      created_at: '2026-05-22T10:00:00Z',
    },
    {
      user_id: 10,
      username: 'teacher_li',
      display_name: '李老师',
      email: 'li@example.com',
      roles: ['ROLE_TEACHER'],
      is_enabled: true,
      created_at: '2026-05-01T08:00:00Z',
    },
    {
      user_id: 11,
      username: 'teacher_wang',
      display_name: '王老师',
      email: 'wang@example.com',
      roles: ['ROLE_TEACHER'],
      is_enabled: true,
      created_at: '2026-05-10T08:00:00Z',
    },
    {
      user_id: 99,
      username: 'admin',
      display_name: '系统管理员',
      email: 'admin@example.com',
      roles: ['ROLE_ADMIN'],
      is_enabled: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);

  adminStore.setUserTotal(6);
}
