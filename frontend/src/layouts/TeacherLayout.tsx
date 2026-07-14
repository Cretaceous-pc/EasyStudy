import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOutlined, FileTextOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores';

const menuItems = [
  { key: 'courses', label: '课程管理', icon: BookOutlined, path: '/teacher/courses' },
  { key: 'materials', label: '资料管理', icon: FileTextOutlined, path: '/teacher/materials' },
];

export default function TeacherLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const activeKey = menuItems.find((item) => location.pathname.startsWith(item.path))?.key || 'courses';
  const displayName = userInfo?.display_name || '教师';
  const firstChar = displayName.charAt(0);

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--parchment)' }}>
      {/* 侧边栏 */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-300"
        style={{
          width: collapsed ? 64 : 220,
          background: 'var(--ivory)',
          borderRight: '1px solid var(--border-cream)',
        }}
      >
        {/* Logo 区 */}
        <div
          className="flex items-center justify-between px-4 flex-shrink-0"
          style={{ height: 56, borderBottom: '1px solid var(--border-cream)' }}
        >
          <div className="flex items-center gap-2">
            <BookOutlined style={{ color: 'var(--accent)', fontSize: 20 }} />
            {!collapsed && (
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 16, color: 'var(--near-black)' }}>
                教师工作台
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-6 h-6 rounded border-none cursor-pointer bg-transparent"
            style={{ color: 'var(--stone-gray)', transition: 'all 0.2s' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--warm-sand)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {collapsed ? <MenuUnfoldOutlined style={{ fontSize: 12 }} /> : <MenuFoldOutlined style={{ fontSize: 12 }} />}
          </button>
        </div>

        {/* 菜单 */}
        <nav className="flex-1 py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg border-none cursor-pointer text-left w-[calc(100%-16px)]"
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--olive-gray)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--warm-sand)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon style={{ fontSize: 16 }} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* 底部用户信息 */}
        <div
          className="flex items-center gap-2 px-4 flex-shrink-0"
          style={{ height: 56, borderTop: '1px solid var(--border-cream)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {firstChar}
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs truncate" style={{ color: 'var(--near-black)', fontWeight: 500 }}>
                {displayName}
              </span>
              <span className="text-[10px] truncate" style={{ color: 'var(--stone-gray)' }}>
                教师
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
