import { useState, useRef, useEffect } from 'react';
import {
  FileTextOutlined,
  PartitionOutlined,
  EditOutlined,
  CodeOutlined,
  ReadOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { useCourseStore, useResourceStore, useChatStore, useLayoutStore } from '../../stores';
import AppModal from '../shared/AppModal';
import type { ResourceType } from '../../types/resource';

interface Props {
  open: boolean;
  onClose: () => void;
  contextContent?: string;
}

const GENERATE_OPTIONS: { type: ResourceType; label: string; icon: any }[] = [
  { type: 'document', label: '知识点总结', icon: FileTextOutlined },
  { type: 'mermaid', label: '思维导图', icon: PartitionOutlined },
  { type: 'exercise_set', label: '练习题', icon: EditOutlined },
  { type: 'code_case', label: '代码案例', icon: CodeOutlined },
  { type: 'reading_material', label: '拓展阅读', icon: ReadOutlined },
];

type Phase = 'form' | 'generating' | 'done' | 'error';

export default function ResourceGenModal({ open, onClose, contextContent }: Props) {
  const { activeCourseId } = useCourseStore();
  const { generateResources, isGenerating, progress } = useResourceStore();
  const { messages } = useChatStore();

  const [phase, setPhase] = useState<Phase>('form');
  const [topic, setTopic] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ResourceType[]>([]);
  const [reqMode, setReqMode] = useState<'context' | 'custom'>('context');
  const [customReqs, setCustomReqs] = useState('');
  const [generatedCount, setGeneratedCount] = useState(0);
  const [fakePercent, setFakePercent] = useState(0);
  const fakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Toast + 内部弹窗控制
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [internalOpen, setInternalOpen] = useState(false);
  const isModalVisible = open || internalOpen;

  // 父组件打开时重置
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setPhase('form');
      setTopic('');
      setSelectedTypes([]);
      setReqMode('context');
      setCustomReqs('');
      setGeneratedCount(0);
      setFakePercent(0);
      setShowToast(false);
      setInternalOpen(false);
      useResourceStore.getState().setGenerating(false);
    }
    prevOpen.current = open;
  }, [open]);

  // 假百分比进度动画
  useEffect(() => {
    if (phase !== 'generating') {
      setFakePercent(0);
      if (fakeTimerRef.current) {
        clearInterval(fakeTimerRef.current);
        fakeTimerRef.current = null;
      }
      return;
    }
    setFakePercent(0);

    fakeTimerRef.current = setInterval(() => {
      setFakePercent((prev) => {
        const realPercent = progress
          ? Math.round((progress.current / Math.max(progress.total, 1)) * 100)
          : 0;
        const cap = isGenerating ? 92 : 100;
        const gap = cap - prev;
        let increment: number;
        if (gap > 40) increment = Math.random() * 8 + 3;
        else if (gap > 15) increment = Math.random() * 3 + 1;
        else if (gap > 3) increment = Math.random() * 1.5 + 0.3;
        else increment = Math.random() * 0.8 + 0.1;
        const next = Math.min(cap, Math.max(prev, realPercent) + increment);
        return Math.round(Math.min(next, cap));
      });
    }, 200);

    return () => {
      if (fakeTimerRef.current) {
        clearInterval(fakeTimerRef.current);
        fakeTimerRef.current = null;
      }
    };
  }, [phase, isGenerating, progress]);

  // 监听生成完成 → 显示右下角 Toast
  useEffect(() => {
    if (phase === 'generating' && !isGenerating) {
      if (fakeTimerRef.current) {
        clearInterval(fakeTimerRef.current);
        fakeTimerRef.current = null;
      }
      const err = useResourceStore.getState().error;
      if (err) {
        setPhase('error');
        setToastType('error');
        setShowToast(true);
        if (open) onClose();
        return;
      }
      setFakePercent(100);
      setToastType('success');
      setShowToast(true);
      if (open) onClose();
    }
  }, [isGenerating, phase, open, onClose]);

  const courseId = activeCourseId;
  const canGenerate = !!courseId && !!topic && selectedTypes.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate || !courseId) return;
    setPhase('generating');
    let requirements = '';
    if (reqMode === 'context') {
      const parts: string[] = [];
      if (contextContent) parts.push(`【课件内容】\n${contextContent.slice(0, 3000)}`);
      if (messages.length > 0) {
        const recentMsgs = messages.slice(-6).map((m) => `${m.role === 'user' ? '学生' : 'AI'}: ${m.content}`).join('\n');
        parts.push(`【对话记录】\n${recentMsgs}`);
      }
      requirements = parts.join('\n\n');
    } else {
      requirements = customReqs.trim();
    }
    setGeneratedCount(selectedTypes.length);
    await generateResources({ course_id: courseId, topic, resource_types: selectedTypes, requirements });
  };

  const toggleType = (t: ResourceType) => {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const handleModalClose = () => {
    setInternalOpen(false);
    onClose();
  };

  if (!isModalVisible && !showToast) return null;

  // ── Toast 通知 ──
  const toastEl = showToast ? (
    <>
      <style>{`@keyframes slideUpIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        className="fixed z-[60] flex items-center gap-3 shadow-lg rounded-xl cursor-pointer"
        style={{
          right: 24, bottom: 24, padding: '14px 20px',
          background: 'var(--ivory)', border: '1px solid var(--border-cream)',
          maxWidth: 320, animation: 'slideUpIn 0.35s ease',
        }}
        onClick={() => {
          setShowToast(false);
          if (toastType === 'success') setPhase('done');
          setInternalOpen(true);
        }}
      >
        {toastType === 'success'
          ? <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a', flexShrink: 0 }} />
          : <CloseCircleOutlined style={{ fontSize: 20, color: '#b55738', flexShrink: 0 }} />
        }
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--near-black)', fontFamily: 'var(--font-serif)' }}>
            {toastType === 'success' ? '资源生成完成' : '资源生成失败'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--stone-gray)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
            {toastType === 'success' ? '点击查看生成结果' : '点击查看详情'}
          </div>
        </div>
      </div>
    </>
  ) : null;

  if (!isModalVisible) return <>{toastEl}</>;

  // ── 表单阶段 ──
  if (phase === 'form') {
    return (
      <>
        {toastEl}
        <AppModal
          open
          onCancel={handleModalClose}
          width={480}
          title={
            <div className="flex items-center gap-2">
              <ThunderboltOutlined style={{ fontSize: 16, color: 'var(--accent)' }} />
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500, color: 'var(--near-black)' }}>
                AI 资源生成
              </span>
            </div>
          }
          styles={{ body: { padding: '8px 24px 20px' } }}
          footer={null}
        >
          {/* 学习主题 */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal-warm)', marginBottom: 6 }}>
            学习主题
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="输入学习主题，例如：线性回归、CNN..."
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border-cream)', background: 'var(--parchment)',
              fontSize: 13, color: 'var(--near-black)', outline: 'none',
              fontFamily: 'var(--font-sans)', marginBottom: 16,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-cream)'; }}
          />

          {/* 生成类型 */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal-warm)', marginBottom: 6 }}>
            生成类型
          </label>
          <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
            {GENERATE_OPTIONS.map(({ type, label, icon: Icon }) => {
              const sel = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-none cursor-pointer"
                  style={{
                    background: sel ? 'var(--accent)' : 'var(--parchment)',
                    color: sel ? '#fff' : 'var(--olive-gray)',
                    fontSize: 12, transition: 'all 0.2s',
                  }}
                >
                  <Icon style={{ fontSize: 12 }} />{label}
                </button>
              );
            })}
          </div>

          {/* 生成要求 */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal-warm)', marginBottom: 6 }}>
            生成要求
          </label>
          <div className="flex gap-3" style={{ marginBottom: 12 }}>
            <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 12, color: 'var(--olive-gray)' }}>
              <input type="radio" name="reqMode" checked={reqMode === 'context'} onChange={() => setReqMode('context')} />
              基于当前课件与对话
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 12, color: 'var(--olive-gray)' }}>
              <input type="radio" name="reqMode" checked={reqMode === 'custom'} onChange={() => setReqMode('custom')} />
              自定义要求
            </label>
          </div>
          {reqMode === 'custom' && (
            <textarea
              value={customReqs}
              onChange={(e) => { if (e.target.value.length <= 5000) setCustomReqs(e.target.value); }}
              placeholder="输入自定义生成要求..."
              rows={4}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, resize: 'vertical',
                border: '1px solid var(--border-cream)', background: 'var(--parchment)',
                fontSize: 12, color: 'var(--near-black)', outline: 'none',
                fontFamily: 'var(--font-sans)', lineHeight: 1.5, marginBottom: 16,
              }}
            />
          )}

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-none font-medium"
            style={{
              background: canGenerate ? 'var(--accent)' : 'var(--warm-sand)',
              color: canGenerate ? '#fff' : 'var(--stone-gray)',
              fontSize: 13, transition: 'all 0.2s',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
            }}
          >
            <ThunderboltOutlined />
            开始生成
          </button>
        </AppModal>
      </>
    );
  }

  // ── 生成中阶段 ──
  if (phase === 'generating') {
    const realMsg = progress?.message ?? '正在规划...';
    return (
      <>
        {toastEl}
        <AppModal
          open
          onCancel={() => {}} // 不允许 ESC/遮罩关闭
          width={360}
          closable={false}
          mask={{ closable: false }}
          footer={
            <div className="flex justify-center">
              <Button onClick={onClose} style={{ fontSize: 12, borderColor: 'var(--border-cream)', color: 'var(--stone-gray)' }}>
                稍后查看
              </Button>
            </div>
          }
          styles={{ body: { padding: '20px 28px 8px' } }}
        >
          <div className="flex flex-col items-center">
            <LoadingOutlined style={{ fontSize: 36, color: 'var(--accent)', marginBottom: 16 }} spin />
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--near-black)', marginBottom: 14, fontFamily: 'var(--font-serif)' }}>
              AI 正在生成资源...
            </div>

            {/* 进度条 */}
            <div style={{ width: '100%', marginBottom: 10 }}>
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--warm-sand)', overflow: 'hidden' }}>
                <div style={{
                  width: `${fakePercent}%`, height: '100%', borderRadius: 3,
                  background: 'var(--accent)', transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--near-black)', marginBottom: 2, fontFamily: 'var(--font-sans)' }}>
              {fakePercent}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--stone-gray)', fontFamily: 'var(--font-sans)' }}>
              {realMsg}
            </div>
          </div>
        </AppModal>
      </>
    );
  }

  // ── 错误阶段 ──
  if (phase === 'error') {
    const errMsg = useResourceStore.getState().error || '生成失败，请重试';
    return (
      <>
        {toastEl}
        <AppModal
          open
          onCancel={handleModalClose}
          width={360}
          closable={false}
          footer={
            <div className="flex gap-3">
              <Button block onClick={handleModalClose} style={{ fontSize: 13, borderColor: 'var(--border-cream)', color: 'var(--stone-gray)' }}>
                关闭
              </Button>
              <Button block type="primary" icon={<ReloadOutlined />} onClick={() => setPhase('form')}
                style={{ fontSize: 13, background: 'var(--accent)', borderColor: 'var(--accent)' }}>
                重试
              </Button>
            </div>
          }
          styles={{ body: { padding: '16px 24px 8px' } }}
        >
          <div className="flex flex-col items-center">
            <CloseCircleOutlined style={{ fontSize: 40, color: '#b55738', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--near-black)', marginBottom: 4, fontFamily: 'var(--font-serif)' }}>
              生成失败
            </div>
            <div style={{ fontSize: 12, color: 'var(--stone-gray)', marginBottom: 8, fontFamily: 'var(--font-sans)', textAlign: 'center', maxWidth: 280 }}>
              {errMsg}
            </div>
          </div>
        </AppModal>
      </>
    );
  }

  // ── 完成阶段 ──
  return (
    <>
      {toastEl}
      <AppModal
        open
        onCancel={handleModalClose}
        width={360}
        closable={false}
        footer={
          <div className="flex gap-3">
            <Button block onClick={() => { handleModalClose(); useLayoutStore.getState().setActiveView('resources'); }}
              style={{ fontSize: 13, borderColor: 'var(--accent)', color: 'var(--accent)' }}>
              查看其他资源
            </Button>
            <Button block type="primary" onClick={async () => {
              handleModalClose();
              const cid = activeCourseId;
              if (!cid) return;
              await useResourceStore.getState().fetchResources({ course_id: cid });
              const list = useResourceStore.getState().resources;
              if (list.length > 0) {
                const r = list[0];
                let md = '';
                const c = r.content as Record<string, unknown> | undefined;
                if (typeof c?.markdown === 'string') md = c.markdown;
                else if (typeof c?.text === 'string') md = c.text;
                else if (c) md = JSON.stringify(c, null, 2);
                useLayoutStore.getState().setCurrentFile({
                  id: parseInt(r.id, 10) || 0,
                  title: r.title,
                  chapter: r.topic || '',
                  section: '',
                  fileType: 'resource',
                  fileUrl: '',
                  courseId: cid,
                  courseTitle: currentCourse?.title ?? '',
                  resourceContent: md,
                });
              }
            }} style={{ fontSize: 13, background: 'var(--accent)', borderColor: 'var(--accent)' }}>
              立即查看资源
            </Button>
          </div>
        }
        styles={{ body: { padding: '16px 24px 8px' } }}
      >
        <div className="flex flex-col items-center">
          <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a', marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--near-black)', marginBottom: 4, fontFamily: 'var(--font-serif)' }}>
            生成完成！
          </div>
          <div style={{ fontSize: 12, color: 'var(--stone-gray)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
            已成功生成 {generatedCount} 份学习资源
          </div>
        </div>
      </AppModal>
    </>
  );
}
