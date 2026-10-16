import { useState } from 'react';
import { Steps, Radio, Input, Button } from 'antd';
import {
  AimOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  ReadOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { QuestionnaireAnswers } from '../../types/learningPath';
import AppModal from '../shared/AppModal';

// ── 问题定义 ──
interface QuestionStep {
  title: string;
  icon: React.ReactNode;
  question: string;
  field: keyof QuestionnaireAnswers;
  type: 'radio' | 'text';
  options?: { label: string; value: string; desc?: string }[];
  placeholder?: string;
}

const QUESTIONS: QuestionStep[] = [
  {
    title: '学习目的',
    icon: <AimOutlined />,
    question: '你学习这门课的主要目的是什么？',
    field: 'purpose',
    type: 'radio',
    options: [
      { label: '通过考试/考证', value: 'exam', desc: '应对标准化考试或获取专业认证' },
      { label: '提升工作技能', value: 'career', desc: '学以致用，助力职业发展' },
      { label: '兴趣探索', value: 'interest', desc: '出于好奇或爱好，想了解这个领域' },
      { label: '学术研究', value: 'research', desc: '配合学业或科研需要' },
      { label: '其他', value: 'other', desc: '不在上述范围的目的' },
    ],
  },
  {
    title: '学习时间',
    icon: <ClockCircleOutlined />,
    question: '你预计每天能花多少时间学习？',
    field: 'dailyStudyTime',
    type: 'radio',
    options: [
      { label: '少于 30 分钟', value: '<30min', desc: '碎片时间，见缝插针' },
      { label: '30 分钟 - 1 小时', value: '30min-1h', desc: '每天固定一小段时间' },
      { label: '1 - 2 小时', value: '1-2h', desc: '有较完整的学习时段' },
      { label: '2 小时以上', value: '>2h', desc: '可以深度投入' },
    ],
  },
  {
    title: '学习深度',
    icon: <ReadOutlined />,
    question: '你希望学到什么程度？',
    field: 'depth',
    type: 'radio',
    options: [
      { label: '了解概览即可', value: 'overview', desc: '知道是什么、能做什么就行' },
      { label: '能独立上手使用', value: 'practical', desc: '可以独立完成常见任务' },
      { label: '系统掌握原理', value: 'systematic', desc: '理解底层原理，能灵活运用' },
      { label: '成为专家', value: 'expert', desc: '深度掌握，能解决复杂问题' },
    ],
  },
  {
    title: '当前水平',
    icon: <RiseOutlined />,
    question: '你目前在该领域的水平如何？',
    field: 'level',
    type: 'radio',
    options: [
      { label: '零基础', value: 'beginner', desc: '完全没接触过' },
      { label: '入门了解', value: 'elementary', desc: '知道基本概念，没有系统学过' },
      { label: '有一定基础', value: 'intermediate', desc: '能独立完成一些简单任务' },
      { label: '比较熟练', value: 'advanced', desc: '有较深理解，希望查漏补缺' },
    ],
  },
  {
    title: '学习内容',
    icon: <EditOutlined />,
    question: '请描述你想学习的具体内容',
    field: 'topic',
    type: 'text',
    placeholder: '例如：想学会用 Python 做数据分析，特别是 Pandas 和 Matplotlib 可视化；或者想系统学习机器学习算法，重点在决策树和随机森林...',
  },
];

const DEFAULT_ANSWERS: QuestionnaireAnswers = {
  purpose: 'career',
  dailyStudyTime: '30min-1h',
  depth: 'practical',
  level: 'beginner',
  topic: '',
};

interface Props {
  open: boolean;
  onSubmit: (answers: QuestionnaireAnswers) => void;
  isLoading: boolean;
  onClose: () => void;
  initialAnswers?: QuestionnaireAnswers;
}

/**
 * 学习路径问卷 Modal
 * 5 步表单：前 4 步单选，第 5 步自由文本输入（最重要）
 */
export default function PathQuestionnaire({ open, onSubmit, isLoading, onClose, initialAnswers }: Props) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(
    initialAnswers ? { ...initialAnswers } : { ...DEFAULT_ANSWERS }
  );

  // 当 initialAnswers 变化时同步（重新生成场景）
  const [prevInitial, setPrevInitial] = useState(initialAnswers);
  if (initialAnswers !== prevInitial) {
    setPrevInitial(initialAnswers);
    setAnswers(initialAnswers ? { ...initialAnswers } : { ...DEFAULT_ANSWERS });
    setCurrent(0);
  }

  const step = QUESTIONS[current];

  const handleAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [step.field]: value }));
  };

  const canProceed = (): boolean => {
    if (step.type === 'text') {
      return (answers[step.field] as string).trim().length > 0;
    }
    return true;
  };

  const handleNext = () => {
    if (current < QUESTIONS.length - 1) {
      setCurrent(current + 1);
    }
  };

  const handlePrev = () => {
    if (current > 0) {
      setCurrent(current - 1);
    }
  };

  const handleFinish = () => {
    if (!canProceed()) return;
    onSubmit(answers);
  };

  const handleClose = () => {
    setCurrent(0);
    setAnswers({ ...DEFAULT_ANSWERS });
    onClose();
  };

  const stepItems = QUESTIONS.map((q) => ({
    title: q.title,
  }));

  return (
    <AppModal
      title={
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500 }}>
          🎯 定制你的学习路径
        </span>
      }
      open={open}
      onCancel={handleClose}
      width={520}
      closable={!isLoading}
      mask={{ closable: !isLoading }}
    >
      {/* 步骤指示器 */}
      <Steps
        current={current}
        size="small"
        items={stepItems}
        style={{ marginBottom: 28 }}
      />

      {/* 问题区 — 固定高度避免步骤切换时弹窗大小跳动 */}
      <div
        className="flex flex-col items-center text-center"
        style={{ height: 420, overflowY: 'auto' }}
      >
        <div
          className="flex items-center justify-center w-12 h-12 rounded-full mb-4"
          style={{
            background: current === 4 ? 'var(--accent)' : 'var(--accent-light)',
            color: current === 4 ? '#fff' : 'var(--accent)',
            fontSize: 20,
          }}
        >
          {step.icon}
        </div>

        <h3
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 16,
            fontWeight: 500,
            color: 'var(--near-black)',
            marginBottom: current === 4 ? 20 : 16,
          }}
        >
          {step.question}
        </h3>

        {step.type === 'radio' && step.options && (
          <Radio.Group
            value={answers[step.field]}
            onChange={(e) => handleAnswer(e.target.value)}
            style={{ width: '100%' }}
          >
            <div className="flex flex-col gap-2 w-full">
              {step.options.map((opt) => {
                const isChecked = answers[step.field] === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleAnswer(opt.value)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer transition-all duration-150 text-left"
                    style={{
                      background: isChecked ? 'var(--accent-light)' : 'var(--ivory)',
                      border: `1px solid ${isChecked ? 'var(--accent)' : 'var(--border-cream)'}`,
                    }}
                  >
                    <Radio value={opt.value} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: isChecked ? 600 : 400, color: 'var(--near-black)' }}>
                        {opt.label}
                      </div>
                      {opt.desc && (
                        <div style={{ fontSize: 11, color: 'var(--stone-gray)', marginTop: 1 }}>
                          {opt.desc}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Radio.Group>
        )}

        {/* Q5: 自由文本输入 */}
        {step.type === 'text' && (
          <div className="w-full">
            <Input.TextArea
              value={answers.topic}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder={step.placeholder}
              rows={5}
              style={{
                fontSize: 13,
                borderRadius: 8,
                borderColor: 'var(--border-cream)',
                background: 'var(--ivory)',
                resize: 'none',
              }}
              autoFocus
            />
            <div
              style={{
                fontSize: 11,
                color: answers.topic.trim() ? 'var(--accent)' : 'var(--stone-gray)',
                marginTop: 8,
                textAlign: 'right',
              }}
            >
              {answers.topic.trim().length > 0
                ? `✅ 已输入 ${answers.topic.length} 字`
                : '⚠️ 请至少输入一句话描述你想学的内容（这是最重要的信息）'}
            </div>
          </div>
        )}
      </div>

      {/* 底部按钮 */}
      <div className="flex items-center justify-between mt-6">
        <Button onClick={handlePrev} disabled={current === 0 || isLoading}>
          上一步
        </Button>

        <span style={{ fontSize: 11, color: 'var(--stone-gray)' }}>
          {current + 1} / {QUESTIONS.length}
        </span>

        {current < QUESTIONS.length - 1 ? (
          <Button
            type="primary"
            onClick={handleNext}
            style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            下一步
          </Button>
        ) : (
          <Button
            type="primary"
            onClick={handleFinish}
            loading={isLoading}
            disabled={!canProceed()}
            style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {isLoading ? '生成中...' : '开始生成'}
          </Button>
        )}
      </div>
    </AppModal>
  );
}
