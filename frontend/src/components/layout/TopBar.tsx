import { useNavigate } from 'react-router-dom';
import { MenuOutlined, BookOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAuthStore, useLayoutStore, useCourseStore } from '../../stores';

export default function TopBar() {
  const navigate = useNavigate();
  const { toggleDirectory, setShowDirectory, setCurrentFile, setActiveView, setChatExpanded } = useLayoutStore();
  const { userInfo, logout } = useAuthStore();
  const { currentCourse } = useCourseStore();

  const handleHomeClick = () => {
    setCurrentFile(null);
    setActiveView('chat');
    setShowDirectory(false);
    setChatExpanded(false);
  };

  const displayName = userInfo?.display_name || '用户';
  const firstChar = displayName.charAt(0);
  const roles = userInfo?.roles || [];
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header
      className="h-12 flex items-center justify-between px-4 flex-shrink-0 z-10"
      style={{
        borderBottom: '1px solid var(--border-cream)',
        background: 'var(--ivory)',
        boxShadow: '0 1px 3px rgba(42,27,24,0.02)',
      }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDirectory}
          className="w-7.5 h-7.5 flex items-center justify-center rounded-md border-none bg-transparent cursor-pointer"
          style={{ color: 'var(--olive-gray)', fontSize: 15, transition: 'all 0.2s' }}
          title="切换目录栏"
        >
          <MenuOutlined />
        </button>
        <div
          onClick={handleHomeClick}
          className="flex items-center gap-2 cursor-pointer select-none"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 17, color: 'var(--near-black)', letterSpacing: '-0.3px' }}
          title="返回首页"
        >
          <BookOutlined style={{ color: 'var(--accent)', fontSize: 18 }} />
          <span>easyStudy</span>
        </div>
        {currentCourse && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-medium"
            style={{
              fontSize: 11,
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <BookOutlined style={{ fontSize: 10 }} />
            {currentCourse.title}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-px h-4" style={{ background: 'var(--border-cream)' }} />

        {/* 头像 + 下拉菜单 */}
        <div className="relative group">
          <div
            className="w-7.5 h-7.5 rounded-lg flex items-center justify-center text-white text-xs font-semibold cursor-pointer"
            style={{
              background: 'var(--accent)',
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            title={`${displayName} · ${roles.map((r) => r.replace('ROLE_', '')).join('/')}`}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-hover)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(201,100,66,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            {firstChar}
          </div>

          {/* 下拉菜单 */}
          <div
            className="absolute right-0 top-full mt-1.5 py-1.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
            style={{
              minWidth: 140,
              background: 'var(--ivory)',
              border: '1px solid var(--border-cream)',
              boxShadow: '0 4px 16px rgba(42,27,24,0.06)',
            }}
          >
            <div className="px-3 py-1.5 text-xs" style={{ color: 'var(--stone-gray)', borderBottom: '1px solid var(--border-cream)' }}>
              {displayName}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs border-none cursor-pointer text-left"
              style={{ color: 'var(--error-crimson)', background: 'transparent', transition: 'all 0.2s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(181,51,51,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <LogoutOutlined style={{ fontSize: 11 }} />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
