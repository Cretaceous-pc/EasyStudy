import { useState, useEffect } from 'react';
import { useResourceStore, useCourseStore } from '../stores';
import ResourceCard from '../components/resources/ResourceCard';
import GenerationProgressBar from '../components/resources/GenerationProgressBar';
import type { ResourceType } from '../types/resource';
import {
  FileTextOutlined,
  PartitionOutlined,
  EditOutlined,
  CodeOutlined,
  ReadOutlined,
  PlusOutlined,
} from '@ant-design/icons';

const generateOptions: { type: ResourceType; label: string; icon: any }[] = [
  { type: 'document', label: '知识点总结', icon: FileTextOutlined },
  { type: 'mermaid', label: '思维导图', icon: PartitionOutlined },
  { type: 'exercise_set', label: '练习题', icon: EditOutlined },
  { type: 'code_case', label: '代码案例', icon: CodeOutlined },
  { type: 'reading_material', label: '拓展阅读', icon: ReadOutlined },
];

export default function ResourceView() {
  const { resources, isGenerating, progress, error, fetchResources, generateResources } = useResourceStore();
  const { activeCourseId } = useCourseStore();
  const courseId = activeCourseId;
  const [selectedTypes, setSelectedTypes] = useState<ResourceType[]>([]);
  const [topic, setTopic] = useState('');
  const [requirements, setRequirements] = useState('');

  // 加载资源列表
  useEffect(() => {
    if (courseId) {
      fetchResources({ course_id: courseId });
    }
  }, [courseId, fetchResources]);

  const toggleType = (type: ResourceType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleGenerate = () => {
    if (!courseId || !topic || selectedTypes.length === 0) return;
    generateResources({
      course_id: courseId,
      topic,
      resource_types: selectedTypes,
      requirements: requirements.trim(),
    });
  };

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        padding: '24px 32px',
        scrollbarWidth: 'thin',
      }}
    >
      {/* Header */}
      <div className="mb-6">
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--near-black)',
            marginBottom: 4,
          }}
        >
          AI 资源生成
        </h1>
        <p style={{ fontSize: 13, color: 'var(--olive-gray)' }}>
          选择主题和资源类型，AI 将并行生成 5 种学习材料
        </p>
      </div>

      {/* 生成面板 */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{
          background: 'var(--ivory)',
          border: '1px solid var(--border-cream)',
          boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
        }}
      >
        {/* 主题输入 */}
        <div className="mb-4">
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--charcoal-warm)',
              marginBottom: 8,
            }}
          >
            学习主题
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：线性回归、神经网络前向传播..."
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-cream)',
              background: 'var(--parchment)',
              fontSize: 13,
              color: 'var(--near-black)',
              outline: 'none',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-sans)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,100,66,0.08)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-cream)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 资源类型选择 */}
        <div className="mb-4">
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--charcoal-warm)',
              marginBottom: 8,
            }}
          >
            生成类型
          </label>
          <div className="flex flex-wrap gap-2">
            {generateOptions.map(({ type, label, icon: Icon }) => {
              const isSelected = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-none cursor-pointer"
                  style={{
                    background: isSelected ? 'var(--accent)' : 'var(--parchment)',
                    color: isSelected ? '#fff' : 'var(--olive-gray)',
                    fontSize: 12,
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isSelected
                      ? '0 1px 3px rgba(201,100,66,0.25)'
                      : '0 1px 2px rgba(42,27,24,0.03)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--warm-sand)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--parchment)';
                    }
                  }}
                >
                  <Icon style={{ fontSize: 13 }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 生成要求 — 大尺寸输入框 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--charcoal-warm)',
              }}
            >
              生成要求
            </label>
            <span
              style={{
                fontSize: 11,
                color: requirements.length > 9500 ? 'var(--accent)' : 'var(--stone-gray)',
                transition: 'color 0.2s',
              }}
            >
              {requirements.length.toLocaleString()} / 10,000
            </span>
          </div>
          <textarea
            value={requirements}
            onChange={(e) => {
              if (e.target.value.length <= 10000) {
                setRequirements(e.target.value);
              }
            }}
            placeholder="输入对资源的要求可使资源生成更准确，可直接粘贴课件或对话或其他文本"
            rows={8}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 10,
              border: '1px solid var(--border-cream)',
              background: 'var(--parchment)',
              fontSize: 13,
              color: 'var(--near-black)',
              outline: 'none',
              resize: 'vertical',
              minHeight: 180,
              maxHeight: 360,
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.65,
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,100,66,0.08)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-cream)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={!courseId || !topic || selectedTypes.length === 0 || isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border-none cursor-pointer font-medium"
          style={{
            background:
              !courseId || !topic || selectedTypes.length === 0 || isGenerating
                ? 'var(--warm-sand)'
                : 'var(--accent)',
            color:
              !courseId || !topic || selectedTypes.length === 0 || isGenerating
                ? 'var(--stone-gray)'
                : '#fff',
            fontSize: 13,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow:
              !courseId || !topic || selectedTypes.length === 0 || isGenerating
                ? 'none'
                : '0 1px 3px rgba(201,100,66,0.25)',
            cursor:
              !courseId || !topic || selectedTypes.length === 0 || isGenerating
                ? 'not-allowed'
                : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (courseId && topic && selectedTypes.length > 0 && !isGenerating) {
              e.currentTarget.style.background = 'var(--accent-hover)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (courseId && topic && selectedTypes.length > 0 && !isGenerating) {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.transform = '';
            }
          }}
        >
          <PlusOutlined style={{ fontSize: 13 }} />
          {isGenerating ? '生成中...' : '开始生成'}
        </button>
      </div>

      {/* 生成进度 */}
      {isGenerating && <GenerationProgressBar progress={progress} />}

      {/* 错误提示 */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 mb-4"
          style={{
            background: 'rgba(201,100,66,0.08)',
            border: '1px solid rgba(201,100,66,0.2)',
            fontSize: 13,
            color: 'var(--accent)',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* 资源列表 */}
      <div className="mb-4">
        <div
          className="mb-3"
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--stone-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
          }}
        >
          已生成资源（{resources.length}）
        </div>
        <div className="grid grid-cols-1 gap-3">
          {resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
        {resources.length === 0 && (
          <EmptyState message="暂无生成资源，选择主题和类型后开始生成" />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded-xl"
      style={{
        background: 'var(--ivory)',
        border: '1px dashed var(--border-warm)',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: 'var(--parchment)' }}
      >
        <FileTextOutlined style={{ fontSize: 20, color: 'var(--warm-silver)' }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--stone-gray)' }}>{message}</span>
    </div>
  );
}
