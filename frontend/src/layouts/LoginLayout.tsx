import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import * as authService from '../services/authService';
import { BookOutlined, UserOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

type PageMode = 'login' | 'register' | 'forgot';

export default function LoginLayout() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [mode, setMode] = useState<PageMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await authService.login({ username, password });
        login(data.access_token, data.user);

        navigate('/');
      } else if (mode === 'register') {
        if (!displayName.trim()) {
          setError('请输入显示名称');
          return;
        }
        await authService.register({
          username,
          password,
          display_name: displayName,
          email: email.trim() || undefined,
        });
        setSuccessMsg('注册成功，正在跳转...');
        const data = await authService.login({ username, password });
        // 标记刚刚注册，MainLayout 会弹出功能介绍弹窗
        useAuthStore.getState().justRegistered = true;
        login(data.access_token, data.user);
      } else if (mode === 'forgot') {
        if (forgotStep === 'email') {
          await authService.forgotPassword({ email: email.trim() });
          setSuccessMsg('验证码已发送，请查收邮件');
          setForgotStep('reset');
        } else {
          if (!code.trim()) {
            setError('请输入验证码');
            return;
          }
          await authService.resetPassword({
            email: email.trim(),
            code: code.trim(),
            new_password: password,
          });
          setSuccessMsg('密码重置成功，请使用新密码登录');
          setMode('login');
          setForgotStep('email');
          setPassword('');
          setCode('');
        }
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        (mode === 'login' ? '登录失败，请检查用户名和密码' :
         mode === 'register' ? '注册失败，请稍后重试' :
         '操作失败，请稍后重试');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: PageMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
    setForgotStep('email');
    setCode('');
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--parchment)' }}>
      {/* Header */}
      <header
        className="h-16 flex items-center justify-between px-8 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-cream)', background: 'var(--ivory)' }}
      >
        <div className="flex items-center gap-2">
          <BookOutlined className="text-xl" style={{ color: 'var(--accent)' }} />
          <span
            className="font-medium text-lg tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--near-black)' }}
          >
            easyStudy
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-12" style={{ maxWidth: 880, margin: '0 auto' }}>
        <h1
          className="text-center mb-3"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 36,
            fontWeight: 500,
            color: 'var(--near-black)',
            letterSpacing: '-0.4px',
            lineHeight: 1.2,
          }}
        >
          面向未来的 <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>AI 智能体</em> 个性化学习平台
        </h1>
        <p
          className="text-center mb-9"
          style={{
            fontSize: 14,
            color: 'var(--olive-gray)',
            maxWidth: 520,
            lineHeight: 1.65,
          }}
        >
          6 维学习画像驱动千人千面 · 5 种 AI 资源并行生成 · RAG 防幻觉智能答疑。像翻阅一本精心排版的教材那样，享受 AI 伴学的每一刻。
        </p>

        {/* 登录/注册/忘记密码 表单 */}
        <form
          onSubmit={handleSubmit}
          className="w-full mb-10"
          style={{ maxWidth: 400 }}
        >
          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--ivory)',
              border: '1px solid var(--border-cream)',
              boxShadow: '0 2px 8px rgba(42,27,24,0.06)',
            }}
          >
            {/* 成功提示 */}
            {successMsg && (
              <div
                className="mb-3 py-2 px-3 rounded-lg text-xs"
                style={{
                  background: 'rgba(100,160,100,0.08)',
                  color: '#4a8c4a',
                  border: '1px solid rgba(100,160,100,0.15)',
                }}
              >
                {successMsg}
              </div>
            )}

            {/* 切换 登录/注册（忘记密码模式下不显示切换） */}
            {mode !== 'forgot' && (
              <div className="flex mb-5 gap-1 rounded-lg overflow-hidden" style={{ background: 'var(--parchment)' }}>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="flex-1 py-2 text-sm font-medium border-none cursor-pointer transition-all"
                  style={{
                    background: mode === 'login' ? 'var(--accent)' : 'transparent',
                    color: mode === 'login' ? '#fff' : 'var(--olive-gray)',
                    borderRadius: 6,
                  }}
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="flex-1 py-2 text-sm font-medium border-none cursor-pointer transition-all"
                  style={{
                    background: mode === 'register' ? 'var(--accent)' : 'transparent',
                    color: mode === 'register' ? '#fff' : 'var(--olive-gray)',
                    borderRadius: 6,
                  }}
                >
                  注册
                </button>
              </div>
            )}

            {/* 忘记密码模式标题 */}
            {mode === 'forgot' && (
              <div className="mb-5">
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 17,
                    fontWeight: 500,
                    color: 'var(--near-black)',
                    marginBottom: 4,
                  }}
                >
                  重置密码
                </div>
                <p style={{ fontSize: 13, color: 'var(--stone-gray)' }}>
                  {forgotStep === 'email' ? '请输入注册时使用的邮箱，我们将发送验证码' : '请输入邮件中的6位验证码和新密码'}
                </p>
              </div>
            )}

            {/* ── 登录模式 ── */}
            {mode === 'login' && (
              <>
                <div className="mb-3">
                  <div className="relative">
                    <UserOutlined
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--stone-gray)', fontSize: 14 }}
                    />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="用户名"
                      required
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg text-sm border-none outline-none"
                      style={{
                        background: 'var(--parchment)',
                        color: 'var(--near-black)',
                        fontFamily: 'var(--font-sans)',
                      }}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <div className="relative">
                    <LockOutlined
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--stone-gray)', fontSize: 14 }}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="密码"
                      required
                      minLength={8}
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg text-sm border-none outline-none"
                      style={{
                        background: 'var(--parchment)',
                        color: 'var(--near-black)',
                        fontFamily: 'var(--font-sans)',
                      }}
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <div className="text-right mb-3">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs border-none bg-transparent cursor-pointer"
                    style={{ color: 'var(--accent)', fontFamily: 'var(--font-sans)' }}
                  >
                    忘记密码？
                  </button>
                </div>
              </>
            )}

            {/* ── 注册模式 ── */}
            {mode === 'register' && (
              <>
                <div className="mb-3">
                  <div className="relative">
                    <UserOutlined
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--stone-gray)', fontSize: 14 }}
                    />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="用户名"
                      required
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg text-sm border-none outline-none"
                      style={{
                        background: 'var(--parchment)',
                        color: 'var(--near-black)',
                        fontFamily: 'var(--font-sans)',
                      }}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <div className="relative">
                    <LockOutlined
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--stone-gray)', fontSize: 14 }}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="密码"
                      required
                      minLength={8}
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg text-sm border-none outline-none"
                      style={{
                        background: 'var(--parchment)',
                        color: 'var(--near-black)',
                        fontFamily: 'var(--font-sans)',
                      }}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <div className="relative">
                    <UserOutlined
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--stone-gray)', fontSize: 14 }}
                    />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="显示名称（如：张三）"
                      required
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg text-sm border-none outline-none"
                      style={{
                        background: 'var(--parchment)',
                        color: 'var(--near-black)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    />
                  </div>
                </div>

                {/* 邮箱（可选） */}
                <div className="mb-3">
                  <div className="relative">
                    <MailOutlined
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--stone-gray)', fontSize: 14 }}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="邮箱（可选，用于找回密码）"
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg text-sm border-none outline-none"
                      style={{
                        background: 'var(--parchment)',
                        color: 'var(--near-black)',
                        fontFamily: 'var(--font-sans)',
                      }}
                      autoComplete="email"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── 忘记密码模式：第一步 输入邮箱 ── */}
            {mode === 'forgot' && forgotStep === 'email' && (
              <div className="mb-3">
                <div className="relative">
                  <MailOutlined
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--stone-gray)', fontSize: 14 }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="注册邮箱"
                    required
                    className="w-full py-2.5 pl-9 pr-3 rounded-lg text-sm border-none outline-none"
                    style={{
                      background: 'var(--parchment)',
                      color: 'var(--near-black)',
                      fontFamily: 'var(--font-sans)',
                    }}
                    autoComplete="email"
                  />
                </div>
              </div>
            )}

            {/* ── 忘记密码模式：第二步 输入验证码 + 新密码 ── */}
            {mode === 'forgot' && forgotStep === 'reset' && (
              <>
                <div className="mb-3">
                  <div className="relative">
                    <SafetyCertificateOutlined
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--stone-gray)', fontSize: 14 }}
                    />
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6位验证码"
                      required
                      maxLength={6}
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg text-sm border-none outline-none"
                      style={{
                        background: 'var(--parchment)',
                        color: 'var(--near-black)',
                        fontFamily: 'var(--font-sans)',
                        letterSpacing: '0.3em',
                      }}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <div className="relative">
                    <LockOutlined
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--stone-gray)', fontSize: 14 }}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="新密码（至少8位）"
                      required
                      minLength={8}
                      className="w-full py-2.5 pl-9 pr-3 rounded-lg text-sm border-none outline-none"
                      style={{
                        background: 'var(--parchment)',
                        color: 'var(--near-black)',
                        fontFamily: 'var(--font-sans)',
                      }}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 错误提示 */}
            {error && (
              <div
                className="mb-3 py-2 px-3 rounded-lg text-xs"
                style={{
                  background: 'rgba(201,100,66,0.08)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(201,100,66,0.15)',
                }}
              >
                {error}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium text-sm cursor-pointer border-none"
              style={{
                background: loading ? 'var(--stone-gray)' : 'var(--accent)',
                color: '#fff',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 1px 3px rgba(201,100,66,0.25)',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? '请稍候...'
                : mode === 'login'
                  ? '登 录'
                  : mode === 'register'
                    ? '注 册'
                    : forgotStep === 'email'
                      ? '发送验证码'
                      : '重置密码'}
            </button>

            {/* 忘记密码模式：返回登录 */}
            {mode === 'forgot' && (
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs border-none bg-transparent cursor-pointer"
                  style={{ color: 'var(--stone-gray)', fontFamily: 'var(--font-sans)' }}
                >
                  返回登录
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Feature Grid */}
        <div className="grid grid-cols-3 gap-3.5 w-full" style={{ maxWidth: 900 }}>
          <FeatureCard
            tag="核心创新"
            icon="🎯"
            title="6 维学习画像，动态演进"
            desc="知识基础 · 学习目标 · 认知风格 · 易错点 · 节奏偏好 · 参与度。对话式冷启动，随学随新。"
          />
          <FeatureCard
            tag="技术亮点"
            icon="🧩"
            title="LangGraph 多智能体协同"
            desc="文档生成 · 思维导图 · 练习题 · 代码案例 · 拓展阅读。并行生成 + 质量校验。"
          />
          <FeatureCard
            tag="安全防线"
            icon="🛡️"
            title="RAG 课程隔离 + 防幻觉"
            desc="所有回答强制绑定课程资料 source，引用溯源到章节。绝不编造。"
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ tag, icon, title, desc }: { tag: string; icon: string; title: string; desc: string }) {
  return (
    <div
      className="rounded-xl p-5.5 text-left cursor-pointer"
      style={{
        background: 'var(--ivory)',
        border: '1px solid var(--border-cream)',
        boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(42,27,24,0.06)';
        e.currentTarget.style.borderColor = 'var(--border-warm)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(42,27,24,0.03)';
        e.currentTarget.style.borderColor = 'var(--border-cream)';
      }}
    >
      <div
        className="inline-block mb-3 rounded px-1.5 py-0.5"
        style={{
          fontSize: 10,
          fontWeight: 500,
          background: 'var(--accent-light)',
          color: 'var(--accent)',
        }}
      >
        {tag}
      </div>
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center mb-3.5"
        style={{ background: 'var(--parchment)', fontSize: 20 }}
      >
        {icon}
      </div>
      <div
        className="mb-1"
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 500,
          fontSize: 15,
          color: 'var(--near-black)',
          letterSpacing: '-0.2px',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--olive-gray)', lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}
