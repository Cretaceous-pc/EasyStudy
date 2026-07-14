import { useState, useEffect, useCallback } from 'react';
import { useCourseStore } from '../../stores';
import * as profileService from '../../services/profileService';
import {
  LeftOutlined,
  RightOutlined,
  CheckOutlined,
  DoubleRightOutlined,
  BookOutlined,
  BulbOutlined,
  AimOutlined,
  EyeOutlined,
  WarningOutlined,
  DashboardOutlined,
  FireOutlined,
} from '@ant-design/icons';

// ── 类型定义 ──────────────────────────────

export type QuestionnaireMode = 'onboarding' | 'reset';

interface QuestionnaireProps {
  mode: QuestionnaireMode;
  courseId?: number; // reset 模式下预传入
  onComplete: () => void;
  onSkip: () => void;
}

interface DimensionStep {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  options: { value: string; label: string; description?: string }[];
  multiSelect?: boolean;
}

// ── 六维问题定义 ──────────────────────────

const DIMENSIONS: Record<string, DimensionStep> = {
  knowledge_base: {
    key: 'knowledge_base',
    title: '你的课程基础知识掌握程度？',
    subtitle: '帮助 AI 确定讲解的起点深度',
    icon: <BulbOutlined />,
    options: [
      { value: 'low', label: '入门', description: '几乎零基础，需要从最基本概念学起' },
      { value: 'medium', label: '有一定基础', description: '了解基本概念，但还不会灵活运用' },
      { value: 'high', label: '比较熟练', description: '大部分内容已掌握，需要查漏补缺' },
      { value: 'very_high', label: '非常扎实', description: '已系统学过，想深入学习或挑战难题' },
    ],
  },
  learning_goal: {
    key: 'learning_goal',
    title: '你学习这门课的主要目标是什么？',
    subtitle: 'AI 会据此调整内容的侧重点和深度',
    icon: <AimOutlined />,
    options: [
      { value: 'exam_prep', label: '通过考试', description: '以应试为导向，重点掌握考点' },
      { value: 'competition', label: '参加竞赛', description: '需要挑战难题和深入理解' },
      { value: 'research', label: '科研需要', description: '需要系统性掌握，为研究打基础' },
      { value: 'interest', label: '兴趣爱好', description: '凭兴趣学，不需要压力' },
      { value: 'job_interview', label: '求职需要', description: '面向面试和工作实战' },
      { value: 'other', label: '其他', description: '以上都不是' },
    ],
  },
  cognitive_style: {
    key: 'cognitive_style',
    title: '你觉得哪种学习方式效果最好？',
    subtitle: 'AI 会优先用你偏好的方式呈现知识',
    icon: <EyeOutlined />,
    options: [
      { value: 'visual', label: '视觉型', description: '看视频、图表、思维导图更易理解' },
      { value: 'auditory', label: '听觉型', description: '听讲解、讨论、复述更有效' },
      { value: 'read_write', label: '读写型', description: '阅读文档、做笔记、写总结更扎实' },
      { value: 'kinesthetic', label: '动觉型', description: '动手练习、做实验、做题学得更快' },
    ],
  },
  error_prone_points: {
    key: 'error_prone_points',
    title: '你感觉哪些知识点可能容易出错？（可多选）',
    subtitle: '帮助 AI 在这些地方多加讲解和练习',
    icon: <WarningOutlined />,
    multiSelect: true,
    options: [
      { value: '基础概念', label: '基础概念', description: '定义、定理、公式记忆' },
      { value: '计算推导', label: '计算推导', description: '数学运算、公式推导' },
      { value: '实验操作', label: '实验操作', description: '动手实验、数据采集' },
      { value: '案例分析', label: '案例分析', description: '实际应用场景分析' },
      { value: '代码编程', label: '代码编程', description: '编程实现、算法设计' },
      { value: '论文写作', label: '论文写作', description: '研究报告、论文撰写' },
    ],
  },
  learning_pace: {
    key: 'learning_pace',
    title: '你更倾向什么样的学习节奏？',
    subtitle: 'AI 会据此控制每次对话的信息密度',
    icon: <DashboardOutlined />,
    options: [
      { value: 'fast', label: '快速推进', description: '快速过一遍整体再回顾细节' },
      { value: 'medium', label: '稳步前进', description: '按计划逐步推进，不疾不徐' },
      { value: 'slow', label: '精耕细作', description: '每个知识点都要彻底搞懂再往下' },
    ],
  },
  engagement: {
    key: 'engagement',
    title: '你预计每周能投入多少时间学习？',
    subtitle: '用于评估你的学习参与度',
    icon: <FireOutlined />,
    options: [
      { value: '0.2', label: '少于 2 小时', description: '偶尔翻翻，碎片时间学习' },
      { value: '0.45', label: '2-5 小时', description: '每周固定学习几次' },
      { value: '0.7', label: '5-10 小时', description: '每天都会花一些时间学习' },
      { value: '0.95', label: '10 小时以上', description: '高强度投入，学习为主业' },
    ],
  },
};

const DIMENSION_ORDER = [
  'knowledge_base',
  'learning_goal',
  'cognitive_style',
  'error_prone_points',
  'learning_pace',
  'engagement',
];

// ── 组件 ──────────────────────────────────

export default function ProfileQuestionnaire({
  mode,
  courseId: presetCourseId,
  onComplete,
  onSkip,
}: QuestionnaireProps) {
  const { enrolledCourses, allCourses, fetchAllCourses, fetchEnrolledCourses, enrollCourse } =
    useCourseStore();

  const [step, setStep] = useState(mode === 'onboarding' ? 0 : 1); // 0=选课
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(presetCourseId ?? null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = mode === 'onboarding' ? 7 : 6;
  const isLastStep = step === totalSteps - 1;
  const isFirstStep = step === 0;

  // 加载课程列表
  useEffect(() => {
    if (mode === 'onboarding') {
      fetchAllCourses();
      fetchEnrolledCourses();
    }
  }, [mode, fetchAllCourses, fetchEnrolledCourses]);

  // 自动跳过选课步骤（已有选课或 reset 模式有 courseId）
  useEffect(() => {
    if (mode === 'reset' && presetCourseId) {
      setSelectedCourseId(presetCourseId);
      return;
    }
    if (mode === 'onboarding' && enrolledCourses.length > 0) {
      setSelectedCourseId(enrolledCourses[0].course_id);
      setStep(1);
    }
  }, [mode, enrolledCourses, presetCourseId]);

  // 可选的课程列表（未选课 + 已选课）
  const availableCourses = [
    ...enrolledCourses,
    ...allCourses.filter(
      (c) => !enrolledCourses.some((ec) => ec.course_id === c.course_id)
    ),
  ];

  const currentDimension = step > 0 ? DIMENSIONS[DIMENSION_ORDER[step - 1]] : null;

  const handleSelectOption = useCallback(
    (dimKey: string, value: string) => {
      setAnswers((prev) => {
        const current = prev[dimKey];
        if (currentDimension?.multiSelect) {
          const arr = Array.isArray(current) ? current : [];
          if (arr.includes(value)) {
            return { ...prev, [dimKey]: arr.filter((v) => v !== value) };
          }
          return { ...prev, [dimKey]: [...arr, value] };
        }
        return { ...prev, [dimKey]: value };
      });
    },
    [currentDimension],
  );

  const canGoNext = useCallback(() => {
    if (step === 0) return selectedCourseId !== null;
    if (!currentDimension) return false;
    const val = answers[currentDimension.key];
    if (currentDimension.multiSelect) {
      return Array.isArray(val) && val.length > 0;
    }
    return !!val;
  }, [step, selectedCourseId, currentDimension, answers]);

  const handleNext = () => {
    if (!canGoNext()) return;
    if (isLastStep) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSubmit = async () => {
    const cid = selectedCourseId;
    if (!cid) return;

    setIsSubmitting(true);
    setError('');

    try {
      await profileService.initProfile({
        course_id: cid,
        answers,
      });
      onComplete();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '保存失败，请稍后重试';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnrollAndNext = async () => {
    if (step !== 0 || !selectedCourseId) return;
    // 如果尚未选课，先选课再进入问答
    const isEnrolled = enrolledCourses.some((c) => c.course_id === selectedCourseId);
    if (!isEnrolled) {
      setIsSubmitting(true);
      try {
        await enrollCourse(selectedCourseId);
      } catch {
        // 已选课的错误可以忽略
      } finally {
        setIsSubmitting(false);
      }
    }
    setStep(1);
  };

  const selectedCourse = availableCourses.find((c) => c.course_id === selectedCourseId);

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* 进度条 */}
      <ProgressBar current={step} total={totalSteps} />

      {/* 步骤内容 */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto px-8" style={{ paddingTop: 32, paddingBottom: 32 }}>
        {/* Step 0: 选课 */}
        {step === 0 && (
          <div className="w-full" style={{ maxWidth: 520 }}>
            <StepHeader
              icon={<BookOutlined />}
              title="你想为哪门课程建立学习画像？"
              subtitle="画像数据与具体课程关联，帮助你获得更精准的学习建议"
            />
            <div className="flex flex-col gap-2 mt-6">
              {availableCourses.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--stone-gray)', textAlign: 'center', padding: 24 }}>
                  暂无可选课程，请跳过此步骤
                </p>
              )}
              {availableCourses.map((course) => (
                <button
                  key={course.course_id}
                  onClick={() => setSelectedCourseId(course.course_id)}
                  className="text-left p-4 rounded-xl border-none cursor-pointer transition-all"
                  style={{
                    background:
                      selectedCourseId === course.course_id
                        ? 'var(--accent-light)'
                        : 'var(--parchment)',
                    border:
                      selectedCourseId === course.course_id
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border-cream)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--near-black)',
                      marginBottom: 2,
                    }}
                  >
                    {course.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--stone-gray)' }}>
                    {course.teacher_name} · {course.subject}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1-6: 维度问答 */}
        {currentDimension && (
          <div className="w-full" style={{ maxWidth: 520 }}>
            <StepHeader
              icon={currentDimension.icon}
              title={currentDimension.title}
              subtitle={currentDimension.subtitle}
            />
            <div className="flex flex-col gap-2.5 mt-6">
              {currentDimension.options.map((opt) => {
                const isSelected = currentDimension.multiSelect
                  ? Array.isArray(answers[currentDimension.key]) &&
                    answers[currentDimension.key].includes(opt.value)
                  : answers[currentDimension.key] === opt.value;

                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSelectOption(currentDimension.key, opt.value)}
                    className="text-left p-4 rounded-xl border-none cursor-pointer transition-all"
                    style={{
                      background: isSelected ? 'var(--accent-light)' : 'var(--parchment)',
                      border: isSelected
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border-cream)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--near-black)',
                        marginBottom: opt.description ? 4 : 0,
                      }}
                    >
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div style={{ fontSize: 12, color: 'var(--stone-gray)', lineHeight: 1.5 }}>
                        {opt.description}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div
            className="mt-4 py-2 px-4 rounded-lg text-xs w-full"
            style={{
              maxWidth: 520,
              background: 'rgba(201,100,66,0.08)',
              color: 'var(--accent)',
              border: '1px solid rgba(201,100,66,0.15)',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* 底部导航 */}
      <div className="flex-shrink-0 px-8 pb-8">
        <div
          className="flex items-center justify-between w-full mx-auto"
          style={{ maxWidth: 520 }}
        >
          <div>
            {!isFirstStep && (
              <NavButton
                icon={<LeftOutlined />}
                label="上一步"
                onClick={() => setStep((s) => s - 1)}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* 跳过按钮 */}
            <button
              onClick={onSkip}
              className="bg-transparent border-none cursor-pointer text-sm"
              style={{
                color: 'var(--stone-gray)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              跳过问卷，稍后再说
            </button>

            {/* 下一步/提交 */}
            {step === 0 ? (
              <NavButton
                icon={<DoubleRightOutlined />}
                label="进入问卷"
                primary
                disabled={!canGoNext()}
                onClick={handleEnrollAndNext}
              />
            ) : isLastStep ? (
              <NavButton
                icon={isSubmitting ? undefined : <CheckOutlined />}
                label={isSubmitting ? '保存中...' : '完成，开始学习'}
                primary
                disabled={!canGoNext() || isSubmitting}
                onClick={handleNext}
              />
            ) : (
              <NavButton
                icon={<RightOutlined />}
                label="下一步"
                primary
                disabled={!canGoNext()}
                onClick={handleNext}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 子组件 ──────────────────────────────────

function StepHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{
          background: 'var(--accent-light)',
          color: 'var(--accent)',
          fontSize: 22,
        }}
      >
        {icon}
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 20,
          fontWeight: 500,
          color: 'var(--near-black)',
          margin: 0,
          marginBottom: 6,
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--stone-gray)', margin: 0 }}>
        {subtitle}
      </p>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = ((current) / (total - 1)) * 100;
  return (
    <div className="flex-shrink-0 px-8 pt-6">
      <div className="flex items-center gap-3 mx-auto" style={{ maxWidth: 520 }}>
        <div
          className="flex-1 h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--warm-sand)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(pct, 2)}%`,
              background: 'var(--accent)',
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--stone-gray)', fontFamily: 'var(--font-mono)' }}>
          {current + 1}/{total}
        </span>
      </div>
    </div>
  );
}

function NavButton({
  icon,
  label,
  primary,
  disabled,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-none cursor-pointer font-medium text-sm transition-all"
      style={{
        background: primary
          ? disabled
            ? 'var(--stone-gray)'
            : 'var(--accent)'
          : 'var(--parchment)',
        color: primary ? '#fff' : 'var(--olive-gray)',
        fontFamily: 'var(--font-sans)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: primary && !disabled ? '0 1px 3px rgba(201,100,66,0.25)' : 'none',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
