import { RadarChartOutlined } from '@ant-design/icons';

interface ProfileEmptyProps {
  onStartQuestionnaire: () => void;
}

export default function ProfileEmpty({ onStartQuestionnaire }: ProfileEmptyProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--ivory)', border: '1px solid var(--border-cream)' }}
      >
        <RadarChartOutlined style={{ fontSize: 24, color: 'var(--warm-silver)' }} />
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
        暂无学习画像
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
        AI 通过六维分析——知识基础、学习目标、认知风格、易错点、学习节奏、参与度——深度理解你的学习特征。画像数据驱动课件难度、路径排序、资源偏好，持续优化个性化推荐。填写问卷即可激活画像。
      </p>
      <button
        onClick={onStartQuestionnaire}
        className="px-5 py-2 rounded-lg border-none cursor-pointer font-medium"
        style={{
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 13,
          transition: 'all 0.2s',
          boxShadow: '0 1px 3px rgba(201,100,66,0.25)',
        }}
      >
        填写问卷
      </button>
    </div>
  );
}
