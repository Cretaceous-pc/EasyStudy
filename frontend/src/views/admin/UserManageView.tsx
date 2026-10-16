import { useState, useMemo, useEffect } from 'react';
import {
  SearchOutlined,
  StopOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useAdminStore } from '../../stores';

const roleMap: Record<string, { label: string; color: string; bg: string }> = {
  ROLE_STUDENT: { label: '学生', color: '#2e7d32', bg: '#e8f5e9' },
  ROLE_TEACHER: { label: '教师', color: '#1565c0', bg: '#e3f2fd' },
  ROLE_ADMIN: { label: '管理员', color: '#c96442', bg: '#e8d4c8' },
};

export default function UserManageView() {
  const { users, updateUser, fetchUsers, updateUserStatus, isLoading } = useAdminStore();
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // 加载用户列表
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (keyword.trim()) {
      const k = keyword.toLowerCase();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(k) ||
          u.display_name.toLowerCase().includes(k) ||
          (u.email && u.email.toLowerCase().includes(k))
      );
    }

    if (roleFilter) {
      result = result.filter((u) => u.roles.includes(roleFilter));
    }

    return result;
  }, [users, keyword, roleFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      students: users.filter((u) => u.roles.includes('ROLE_STUDENT')).length,
      teachers: users.filter((u) => u.roles.includes('ROLE_TEACHER')).length,
      admins: users.filter((u) => u.roles.includes('ROLE_ADMIN')).length,
      enabled: users.filter((u) => u.is_enabled).length,
      disabled: users.filter((u) => !u.is_enabled).length,
    };
  }, [users]);

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? '禁用' : '启用';
    if (confirm(`确定要${action}该用户吗？`)) {
      await updateUserStatus(userId, !currentStatus);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 顶部操作栏 */}
      <div
        className="flex items-center justify-between px-6 flex-shrink-0"
        style={{ height: 56, borderBottom: '1px solid var(--border-cream)' }}
      >
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, color: 'var(--near-black)', margin: 0 }}>
          用户管理
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '总用户数', value: stats.total, icon: <TeamOutlined />, color: 'var(--accent)' },
            { label: '学生', value: stats.students, icon: <UserOutlined />, color: '#2e7d32' },
            { label: '教师', value: stats.teachers, icon: <SafetyCertificateOutlined />, color: '#1565c0' },
            { label: '已启用', value: stats.enabled, icon: <CheckCircleOutlined />, color: '#2e7d32' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{
                background: 'var(--ivory)',
                border: '1px solid var(--border-cream)',
                boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm"
                style={{ color: stat.color, background: `${stat.color}15` }}
              >
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--near-black)', lineHeight: 1.2 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--stone-gray)' }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <SearchOutlined
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ fontSize: 12, color: 'var(--stone-gray)' }}
            />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索用户名、昵称、邮箱"
              className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm outline-none"
              style={{
                borderColor: 'var(--border-warm)',
                background: 'var(--ivory)',
                color: 'var(--near-black)',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm outline-none"
            style={{
              borderColor: 'var(--border-warm)',
              background: 'var(--ivory)',
              color: 'var(--near-black)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <option value="">全部角色</option>
            <option value="ROLE_STUDENT">学生</option>
            <option value="ROLE_TEACHER">教师</option>
            <option value="ROLE_ADMIN">管理员</option>
          </select>
        </div>

        {/* 用户表格 */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--ivory)',
            border: '1px solid var(--border-cream)',
            boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-cream)' }}>
                {['用户', '用户名', '角色', '状态', '注册时间', '操作'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-medium"
                    style={{ color: 'var(--stone-gray)', background: 'rgba(245,244,237,0.5)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.user_id}
                  className="group"
                  style={{
                    borderBottom: '1px solid var(--border-cream)',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(245,244,237,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{ background: 'var(--accent)' }}
                      >
                        {user.display_name.charAt(0)}
                      </div>
                      <span style={{ color: 'var(--near-black)', fontWeight: 500 }}>{user.display_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--olive-gray)' }}>
                    {user.username}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {user.roles.map((role) => {
                        const rm = roleMap[role] || { label: role, color: 'var(--stone-gray)', bg: 'var(--warm-sand)' };
                        return (
                          <span
                            key={role}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{ color: rm.color, background: rm.bg }}
                          >
                            {rm.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: user.is_enabled ? '#2e7d32' : '#757575' }}
                    >
                      {user.is_enabled ? (
                        <CheckCircleOutlined style={{ fontSize: 11 }} />
                      ) : (
                        <StopOutlined style={{ fontSize: 11 }} />
                      )}
                      {user.is_enabled ? '正常' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--stone-gray)' }}>
                    {new Date(user.created_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleStatus(user.user_id, user.is_enabled)}
                      className="px-2 py-1 rounded-md border-none cursor-pointer text-xs font-medium"
                      style={{
                        color: user.is_enabled ? 'var(--error-crimson)' : '#2e7d32',
                        background: 'transparent',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = user.is_enabled
                          ? 'rgba(181,51,51,0.06)'
                          : 'rgba(46,125,50,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {user.is_enabled ? '禁用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="h-48 flex flex-col items-center justify-center" style={{ color: 'var(--stone-gray)' }}>
              <TeamOutlined style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }} />
              <div style={{ fontSize: 13 }}>未找到用户</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
