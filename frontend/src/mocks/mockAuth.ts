import { useAuthStore } from '../stores/authStore';

export function seedAuthMock() {
  useAuthStore.getState().login(
    'mock_jwt_token_for_development_only',
    {
      user_id: 1,
      username: 'zhangsan',
      display_name: '张三',
      email: 'zhangsan@example.com',
      roles: ['ROLE_STUDENT'],
    }
  );
}
