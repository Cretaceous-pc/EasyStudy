import { useEffect, useState } from 'react';
import { useProfileStore, useCourseStore } from '../stores';
import type { QuestionnaireMode } from '../components/onboarding/ProfileQuestionnaire';
import ProfileQuestionnaire from '../components/onboarding/ProfileQuestionnaire';
import ProfileEmpty from '../components/profile/ProfileEmpty';
import ProfileHeader from '../components/profile/ProfileHeader';
import ProfileSummary from '../components/profile/ProfileSummary';
import ProfileRadar from '../components/profile/ProfileRadar';
import ProfileDimensions from '../components/profile/ProfileDimensions';
import ProfileHistory from '../components/profile/ProfileHistory';
import ProfileResetModal from '../components/profile/ProfileResetModal';
import AppModal from '../components/shared/AppModal';

export default function ProfileView() {
  const store = useProfileStore();
  const {
    profile, history, isEditing, editingDimensions, isSaving, isLoading,
    startEditing, cancelEditing, saveEditing, updateDimension,
    fetchProfile, fetchHistory,
  } = store;

  const { currentCourse, enrolledCourses } = useCourseStore();
  const courseId = currentCourse?.course_id ?? enrolledCourses[0]?.course_id ?? 1;

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState<QuestionnaireMode | null>(null);

  // ── 加载画像 ──
  useEffect(() => {
    if (courseId) {
      fetchProfile(courseId);
      fetchHistory(courseId);
    }
  }, [courseId, fetchProfile, fetchHistory]);

  // ── 操作 ──
  const handleQuestionnaireDone = () => {
    setShowQuestionnaire(null);
    if (courseId) {
      fetchProfile(courseId);
      fetchHistory(courseId);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(false);
    setShowQuestionnaire('reset');
  };

  // ── 渲染 ──

  // 问卷 Modal — 替代原来全页面替换
  const questionnaireModal = showQuestionnaire && courseId && (
    <AppModal
      open={true}
      onCancel={handleQuestionnaireDone}
      width={620}
      mask={{ closable: false }}
      closable={true}
      title={null}
      styles={{
        body: { padding: 0, height: '80vh', overflow: 'hidden' },
        content: { padding: 0 },
      }}
      footer={null}
    >
      <ProfileQuestionnaire
        mode={showQuestionnaire}
        courseId={courseId}
        onComplete={handleQuestionnaireDone}
        onSkip={handleQuestionnaireDone}
      />
    </AppModal>
  );

  // 初次加载中 — 避免闪烁 ProfileEmpty
  if (isLoading && !profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <span style={{ fontSize: 14, color: 'var(--stone-gray)' }}>加载中...</span>
        {questionnaireModal}
      </div>
    );
  }

  // 空状态
  if (!profile) {
    return (
      <>
        <ProfileEmpty onStartQuestionnaire={() => setShowQuestionnaire('onboarding')} />
        {questionnaireModal}
      </>
    );
  }

  // 正常展示
  const displayDimensions = isEditing ? editingDimensions : profile.dimensions;

  return (
    <div className="h-full overflow-y-auto" style={{ padding: '24px 32px', scrollbarWidth: 'thin' }}>
      <ProfileHeader
        isEditing={isEditing}
        onStartEditing={startEditing}
        onSave={saveEditing}
        onCancel={cancelEditing}
        onReset={() => setShowResetConfirm(true)}
      />

      <ProfileSummary summary={profile.summary} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <ProfileRadar dimensions={displayDimensions} />
        <ProfileDimensions
          dimensions={displayDimensions}
          isEditing={isEditing}
          onDimensionChange={updateDimension}
        />
      </div>

      <ProfileHistory history={history} />
      <div style={{ height: 40 }} />

      {showResetConfirm && (
        <ProfileResetModal
          isSaving={isSaving}
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
      {questionnaireModal}
    </div>
  );
}
