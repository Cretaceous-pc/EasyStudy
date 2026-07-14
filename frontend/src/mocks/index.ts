import { seedAuthMock } from './mockAuth';
import { seedCourseMock } from './mockCourses';
import { seedChatMock } from './mockChat';
import { seedResourceMock } from './mockResources';
import { seedPathMock } from './mockPath';
import { seedProfileMock } from './mockProfile';
import { seedTeacherMock } from './mockTeacher';
import { seedAdminMock } from './mockAdmin';

export function initMocks() {
  if (import.meta.env.VITE_USE_MOCK !== 'true') return;

  seedAuthMock();
  seedCourseMock();
  seedChatMock();
  seedResourceMock();
  seedPathMock();
  // seedProfileMock(); // 注释掉：让 API 决定是否有画像，无画像时显示 ProfileEmpty 空状态
  seedTeacherMock();
  seedAdminMock();
}
