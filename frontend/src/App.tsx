import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores';
import { initMocks } from './mocks';
import LoginLayout from './layouts/LoginLayout';
import MainLayout from './layouts/MainLayout';
import TeacherLayout from './layouts/TeacherLayout';
import AdminLayout from './layouts/AdminLayout';
import OnboardingView from './views/OnboardingView';
import RoleGuard from './components/shared/RoleGuard';
import CourseManageView from './views/teacher/CourseManageView';
import MaterialManageView from './views/teacher/MaterialManageView';
import UserManageView from './views/admin/UserManageView';

function App() {
  const { isAuthenticated, isChecking, checkAuth } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initMocks();
    // 验证 token 有效性（有 token 则调 /api/auth/me，无 token 直接跳过）
    checkAuth().finally(() => setIsReady(true));
  }, []);

  // 正在验证 token — 显示加载状态
  if (!isReady || isChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--parchment)' }}>
        <div className="text-sm" style={{ color: 'var(--stone-gray)' }}>加载中...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 教师端路由 */}
        <Route
          path="/teacher/*"
          element={
            <RoleGuard allowedRoles={['ROLE_TEACHER', 'ROLE_ADMIN']}>
              <TeacherLayout />
            </RoleGuard>
          }
        >
          <Route index element={<Navigate to="courses" replace />} />
          <Route path="courses" element={<CourseManageView />} />
          <Route path="materials" element={<MaterialManageView />} />
        </Route>

        {/* 管理端路由 */}
        <Route
          path="/admin/*"
          element={
            <RoleGuard allowedRoles={['ROLE_ADMIN']}>
              <AdminLayout />
            </RoleGuard>
          }
        >
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<UserManageView />} />
        </Route>

        {/* 引导页 — 注册后填写六维问卷 */}
        <Route
          path="/onboarding"
          element={isAuthenticated ? <OnboardingView /> : <Navigate to="/" replace />}
        />

        {/* 学生端 / 默认路由 */}
        <Route path="*" element={isAuthenticated ? <MainLayout /> : <LoginLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
