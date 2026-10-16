import { useEffect, useCallback, useState, useRef } from 'react';
import { useLearningPathStore } from '../stores/learningPathStore';
import { useCourseStore } from '../stores';
import { Button } from 'antd';
import { ExclamationCircleOutlined, NodeIndexOutlined } from '@ant-design/icons';
import AppModal from '../components/shared/AppModal';
import {
  PathQuestionnaire,
  PathTreeCanvas,
  PathProgressBar,
  PathEmptyState,
  PathCompletionModal,
} from '../components/learning-path';

/**
 * 学习路径页面
 * 顶层编排：问卷入口 → 生成路径 → 树状图渲染
 */
export default function LearningPathView() {
  const {
    hasQuestionnaire,
    questionnaire,
    path,
    isLoading,
    error,
    fetchPath,
    generatePath,
    updateNodeStatus,
    submitQuestionnaire,
  } = useLearningPathStore();

  const { currentCourse, enrolledCourses } = useCourseStore();
  const courseId = currentCourse?.course_id ?? enrolledCourses[0]?.course_id ?? 1;
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  // 区分首次填写和重新生成：true = 重新生成（提交时 force），false = 首次
  const [isRegenerate, setIsRegenerate] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const prevProgressRef = useRef<number | null>(null);
  const hasShownCompletionRef = useRef(false);

  // 加载学习路径（始终尝试，已有路径自动恢复 hasQuestionnaire）
  useEffect(() => {
    if (courseId) {
      if (courseId) { fetchPath(courseId); }
    }
  }, [courseId, fetchPath]);

  // 检测学习进度到达 100%（监听整个 path 对象，确保每次状态更新都触发）
  useEffect(() => {
    if (!path || path.overallProgress !== 100) return;
    if (hasShownCompletionRef.current) return;
    const prev = prevProgressRef.current;
    // 从其他进度 → 100%，或初次加载已是 100%
    if (prev === null || prev < 100) {
      setShowCompletion(true);
      hasShownCompletionRef.current = true;
    }
    prevProgressRef.current = path.overallProgress;
  }, [path]);

  // ── 回调 ──
  // 无路径时直接生成（无需确认，因为没有进度可丢失）
  const handleGenerate = useCallback(() => {
    generatePath(courseId, true);
  }, [courseId, generatePath]);

  // 有路径时重新生成 → 先确认再打开问卷
  const handleRegenerate = useCallback(() => {
    setShowRegenConfirm(true);
  }, []);

  const handleRegenConfirmOk = useCallback(() => {
    setShowRegenConfirm(false);
    setIsRegenerate(true);
    setQuestionnaireOpen(true);
  }, []);

  const handleRetry = useCallback(() => {
    if (courseId) { fetchPath(courseId); }
  }, [courseId, fetchPath]);

  // 首次问卷提交
  const handleQuestionnaireSubmit = useCallback(
    (answers: any) => {
      setQuestionnaireOpen(false);
      submitQuestionnaire(answers, false);
    },
    [submitQuestionnaire],
  );

  // 重新生成问卷提交
  const handleRegenerateSubmit = useCallback(
    (answers: any) => {
      setQuestionnaireOpen(false);
      setIsRegenerate(false);
      submitQuestionnaire(answers, true);
    },
    [submitQuestionnaire],
  );

  const handleQuestionnaireClose = useCallback(() => {
    setQuestionnaireOpen(false);
    setIsRegenerate(false);
  }, []);

  const handleNodeStatusChange = useCallback(
    (nodeId: string, status: any) => {
      updateNodeStatus(nodeId, status);
    },
    [updateNodeStatus],
  );

  // ── 渲染 ──

  // 问卷 Modal（所有分支均可打开）
  const questionnaireModal = (
    <PathQuestionnaire
      open={questionnaireOpen}
      onSubmit={isRegenerate ? handleRegenerateSubmit : handleQuestionnaireSubmit}
      isLoading={isLoading}
      onClose={handleQuestionnaireClose}
      initialAnswers={isRegenerate ? (questionnaire ?? undefined) : undefined}
    />
  );

  // 1) 问卷未填写 → 等待页 + 按钮打开问卷 Modal
  if (!hasQuestionnaire) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {questionnaireModal}
        <div className="h-full flex flex-col items-center justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'var(--ivory)', border: '1px solid var(--border-cream)' }}
          >
            <NodeIndexOutlined style={{ fontSize: 24, color: 'var(--warm-silver)' }} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--near-black)',
              marginBottom: 6,
            }}
          >
            暂无学习路径
          </div>
          <p
            style={{
              fontSize: 13,
              color: 'var(--stone-gray)',
              marginBottom: 16,
              maxWidth: 360,
              textAlign: 'center',
              lineHeight: 1.7,
            }}
          >
            AI 根据你的学习画像和课程目标，自动生成树状知识图谱。每个节点配有 AI 生成的教学内容，支持章节展开、节点自由探索。你可以按推荐路径循序渐进，也可以跳转到任意节点深度学习，学习进度实时追踪。
          </p>
          <button
            onClick={() => { setIsRegenerate(false); setQuestionnaireOpen(true); }}
            className="px-5 py-2 rounded-lg border-none cursor-pointer font-medium"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 13,
              transition: 'all 0.2s',
              boxShadow: '0 1px 3px rgba(201,100,66,0.25)',
            }}
          >
            参加问卷
          </button>
        </div>
      </div>
    );
  }

  // 2) 问卷已填，无路径（加载中时最小化展示，由 PathEmptyState 处理）
  if (!path) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {questionnaireModal}
        <PathEmptyState
          isLoading={isLoading}
          error={error}
          onGenerate={handleGenerate}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  // 3) 有路径 → 树状图
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {questionnaireModal}
      <PathCompletionModal
        visible={showCompletion}
        onLater={() => setShowCompletion(false)}
        onRegenerate={() => {
          setShowCompletion(false);
          handleRegenerate();
        }}
      />
      {/* 重新生成确认弹窗 */}
      <AppModal
        open={showRegenConfirm}
        onCancel={() => setShowRegenConfirm(false)}
        width={400}
        title={
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 28, height: 28, background: '#fdf3e0', color: '#d4882a', fontSize: 14 }}>
              <ExclamationCircleOutlined />
            </div>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500, color: 'var(--near-black)' }}>
              重新生成学习路径
            </span>
          </div>
        }
        footer={
          <div className="flex justify-end gap-2.5">
            <Button onClick={() => setShowRegenConfirm(false)}
              style={{ fontSize: 13, borderColor: 'var(--border-cream)', color: 'var(--olive-gray)' }}>
              取消
            </Button>
            <Button type="primary" onClick={handleRegenConfirmOk}
              style={{ fontSize: 13, background: 'var(--accent)', borderColor: 'var(--accent)' }}>
              确认重新生成
            </Button>
          </div>
        }
        styles={{ body: { padding: '4px 24px 0' } }}
      >
        <p style={{ fontSize: 13.5, color: 'var(--olive-gray)', lineHeight: 1.65, margin: 0 }}>
          重新生成将<strong style={{ color: 'var(--near-black)', fontWeight: 500 }}>覆盖当前学习路径</strong>，
          但已完成节点的学习记录会保留。
        </p>
        <p style={{
          fontSize: 11.5, color: 'var(--stone-gray)', lineHeight: 1.5, marginTop: 10,
          padding: '8px 12px', background: 'var(--parchment)', borderRadius: 8,
          border: '1px solid var(--border-cream)',
        }}>
          💡 你可以在问卷中调整偏好，AI 将根据新偏好重新生成。
        </p>
      </AppModal>
      <PathProgressBar
        path={path!}
        isLoading={isLoading}
        onRegenerate={handleRegenerate}
      />
      {/* 重新生成失败时的错误提示 */}
      {error && (
        <div
          className="flex-shrink-0 mx-7 flex items-center gap-2 rounded-lg px-4 py-2.5"
          style={{
            background: 'rgba(201,100,66,0.08)',
            border: '1px solid rgba(201,100,66,0.2)',
            fontSize: 12,
            color: 'var(--accent)',
          }}
        >
          <span>⚠️ {error}</span>
          <button
            onClick={() => fetchPath(courseId)}
            className="border-none cursor-pointer underline"
            style={{ fontSize: 11, color: 'var(--accent)', background: 'transparent', marginLeft: 'auto' }}
          >
            重试
          </button>
        </div>
      )}
      <PathTreeCanvas
        nodes={path!.nodes}
        onStatusChange={handleNodeStatusChange}
      />
    </div>
  );
}
