import { useState, useEffect, useCallback } from 'react';
import { useCourseStore } from '../../stores';
import AppModal from '../shared/AppModal';
import {
  BookOutlined,
  NodeIndexOutlined,
  EditOutlined,
  RadarChartOutlined,
  LeftOutlined,
  RightOutlined,
  DoubleRightOutlined,
} from '@ant-design/icons';
import type { Course } from '../../types/course';

// ── 四个板块介绍定义 ──────────────────────

interface SectionIntro {
  key: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
}

const SECTIONS: SectionIntro[] = [
  {
    key: 'chat',
    icon: <BookOutlined />,
    title: '课件',
    subtitle: 'AI 智能伴读，课件对话学习',
    description:
      '上传或选择课件后，AI 会基于课件内容与你实时对话。你可以随时提问，AI 将结合课件知识库给出精准回答，让每一份课件都成为你的专属导师。',
  },
  {
    key: 'path',
    icon: <NodeIndexOutlined />,
    title: '学习路径',
    subtitle: '个性化知识图谱，自适应导航',
    description:
      'AI 会根据你的学习画像和课程目标，自动生成树状知识图谱。每个节点都有 AI 生成的教学内容，你可以按照推荐路径或自由探索学习。',
  },
  {
    key: 'resources',
    icon: <EditOutlined />,
    title: '资源生成',
    subtitle: '一键生成多种学习资源',
    description:
      '选择主题和资源类型（文档、思维导图、练习题、代码案例、拓展阅读），AI 将并行生成多种学习材料，并自动存入你的知识库，随时查阅。',
  },
  {
    key: 'profile',
    icon: <RadarChartOutlined />,
    title: '学习画像',
    subtitle: '六维学习画像，动态优化体验',
    description:
      'AI 会根据你的学习行为和偏好，构建包含知识基础、学习目标、认知风格等六个维度的动态画像，持续优化个性化推荐和学习路径。',
  },
];

// ── 组件 props ────────────────────────────

interface WelcomeModalProps {
  open: boolean;
  onComplete: (selectedCourseId: number | null) => void;
  onSkip: () => void;
}

// ── 组件 ──────────────────────────────────

export default function WelcomeModal({ open, onComplete, onSkip }: WelcomeModalProps) {
  const { allCourses, fetchAllCourses, fetchEnrolledCourses, enrolledCourses, enrollCourse } =
    useCourseStore();

  const [step, setStep] = useState(0); // 0-3=板块介绍, 4=选课
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const totalSteps = SECTIONS.length + 1; // 4 介绍 + 1 选课 = 5
  const isIntroStep = step < SECTIONS.length;
  const isCourseStep = step === SECTIONS.length;
  const isLastStep = step === totalSteps - 1;

  // 加载课程列表
  useEffect(() => {
    if (open) {
      fetchAllCourses();
      fetchEnrolledCourses();
    }
  }, [open, fetchAllCourses, fetchEnrolledCourses]);

  // 可选的课程列表
  const availableCourses: Course[] = [
    ...enrolledCourses,
    ...allCourses.filter((c) => !enrolledCourses.some((ec) => ec.course_id === c.course_id)),
  ];

  const currentSection = isIntroStep ? SECTIONS[step] : null;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      // 选课步骤：直接完成
      onComplete(selectedCourseId);
    } else {
      setStep((s) => s + 1);
    }
  }, [isLastStep, selectedCourseId, onComplete]);

  const handlePrev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const handleEnrollAndComplete = async () => {
    if (!selectedCourseId) {
      onComplete(null);
      return;
    }
    const isEnrolled = enrolledCourses.some((c) => c.course_id === selectedCourseId);
    if (!isEnrolled) {
      setIsEnrolling(true);
      try {
        await enrollCourse(selectedCourseId);
      } catch {
        // 忽略已选课错误
      } finally {
        setIsEnrolling(false);
      }
    }
    onComplete(selectedCourseId);
  };

  // 弹窗标题
  const modalTitle = isIntroStep ? (
    <span
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 17,
        fontWeight: 500,
        color: 'var(--near-black)',
      }}
    >
      欢迎来到 easyStudy
    </span>
  ) : (
    <span
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 17,
        fontWeight: 500,
        color: 'var(--near-black)',
      }}
    >
      选择一门课程开始学习
    </span>
  );

  return (
    <AppModal
      open={open}
      onCancel={onSkip}
      width={480}
      title={modalTitle}
      mask={{ closable: false }}
      closable={true}
      styles={{
        body: { padding: '24px 28px 28px' },
      }}
    >
      <div className="flex flex-col">
        {/* 进度点 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 8 : 6,
                height: i === step ? 8 : 6,
                background:
                  i === step
                    ? 'var(--accent)'
                    : i < step
                      ? 'var(--accent-light)'
                      : 'var(--border-cream)',
                opacity: i <= step ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* 板块介绍步骤 */}
        {isIntroStep && currentSection && (
          <div className="flex flex-col items-center text-center">
            {/* 图标 */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: 'var(--accent-light)',
                color: 'var(--accent)',
                fontSize: 26,
              }}
            >
              {currentSection.icon}
            </div>

            {/* 标题 */}
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 20,
                fontWeight: 500,
                color: 'var(--near-black)',
                margin: 0,
                marginBottom: 4,
              }}
            >
              {currentSection.title}
            </h3>

            {/* 副标题 */}
            <p
              style={{
                fontSize: 13,
                color: 'var(--stone-gray)',
                margin: 0,
                marginBottom: 16,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {currentSection.subtitle}
            </p>

            {/* 描述 */}
            <p
              style={{
                fontSize: 13.5,
                color: 'var(--olive-gray)',
                lineHeight: 1.8,
                margin: 0,
                fontFamily: 'var(--font-sans)',
                maxWidth: 380,
              }}
            >
              {currentSection.description}
            </p>
          </div>
        )}

        {/* 选课步骤 */}
        {isCourseStep && (
          <div className="flex flex-col">
            <p
              style={{
                fontSize: 13,
                color: 'var(--stone-gray)',
                margin: 0,
                marginBottom: 16,
                textAlign: 'center',
                fontFamily: 'var(--font-sans)',
              }}
            >
              选择一个课程，AI 将据此为你定制学习画像。也可以跳过，稍后再说。
            </p>

            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
              {availableCourses.length === 0 && (
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--stone-gray)',
                    textAlign: 'center',
                    padding: 24,
                  }}
                >
                  暂无可选课程
                </p>
              )}
              {availableCourses.map((course) => (
                <button
                  key={course.course_id}
                  onClick={() => setSelectedCourseId(course.course_id)}
                  className="text-left p-3.5 rounded-xl border-none cursor-pointer transition-all"
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
                    {course.teacher_name}
                    {course.subject ? ` · ${course.subject}` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 底部导航 */}
        <div className="flex items-center justify-between mt-6">
          <div>
            {step > 0 && (
              <NavButton icon={<LeftOutlined />} label="上一步" onClick={handlePrev} />
            )}
          </div>

          <div className="flex items-center gap-3">
            {isCourseStep ? (
              <>
                <button
                  onClick={() => onComplete(null)}
                  className="bg-transparent border-none cursor-pointer text-sm"
                  style={{
                    color: 'var(--stone-gray)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  跳过，稍后再说
                </button>
                <NavButton
                  icon={isEnrolling ? undefined : <DoubleRightOutlined />}
                  label={isEnrolling ? '处理中...' : '开始学习'}
                  primary
                  disabled={isEnrolling}
                  onClick={handleEnrollAndComplete}
                />
              </>
            ) : (
              <NavButton
                icon={<RightOutlined />}
                label={step === SECTIONS.length - 1 ? '选课程' : '继续'}
                primary
                onClick={handleNext}
              />
            )}
          </div>
        </div>
      </div>
    </AppModal>
  );
}

// ── 子组件 ──────────────────────────────────

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
