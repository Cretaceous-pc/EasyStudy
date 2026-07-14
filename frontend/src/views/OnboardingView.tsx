import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileQuestionnaire from '../components/onboarding/ProfileQuestionnaire';
import WelcomeModal from '../components/onboarding/WelcomeModal';
import { BookOutlined } from '@ant-design/icons';

export default function OnboardingView() {
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(true);
  const [preselectedCourseId, setPreselectedCourseId] = useState<number | null>(null);

  const handleWelcomeComplete = (courseId: number | null) => {
    setPreselectedCourseId(courseId);
    setShowWelcome(false);
  };

  const handleWelcomeSkip = () => {
    setPreselectedCourseId(null);
    setShowWelcome(false);
  };

  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: 'var(--parchment)' }}
    >
      {/* 欢迎介绍弹窗 — 仅新用户注册时显示 */}
      <WelcomeModal
        open={showWelcome}
        onComplete={handleWelcomeComplete}
        onSkip={handleWelcomeSkip}
      />

      {/* Header */}
      <header
        className="h-14 flex items-center px-8 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--border-cream)',
          background: 'var(--ivory)',
        }}
      >
        <div className="flex items-center gap-2">
          <BookOutlined className="text-lg" style={{ color: 'var(--accent)' }} />
          <span
            className="font-medium tracking-tight"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 16,
              color: 'var(--near-black)',
            }}
          >
            easyStudy · 完善学习画像
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col" style={{ maxWidth: 880, margin: '0 auto', width: '100%' }}>
        <ProfileQuestionnaire
          mode="onboarding"
          courseId={preselectedCourseId ?? undefined}
          onComplete={() => navigate('/')}
          onSkip={() => navigate('/')}
        />
      </main>
    </div>
  );
}
