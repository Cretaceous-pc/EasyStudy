import { Button } from 'antd';
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import AppModal from '../shared/AppModal';

interface Props {
  visible: boolean;
  onLater: () => void;
  onRegenerate: () => void;
}

/**
 * 学习路径完成弹窗
 * 当所有节点标记为 completed（进度 100%）时弹出
 */
export default function PathCompletionModal({ visible, onLater, onRegenerate }: Props) {
  return (
    <AppModal
      open={visible}
      onCancel={onLater}
      width={440}
    >
      <div className="flex flex-col items-center text-center" style={{ padding: '16px 0' }}>
        {/* 图标 */}
        <div
          className="flex items-center justify-center rounded-full mb-5"
          style={{
            width: 72,
            height: 72,
            background: 'rgba(91,140,90,0.12)',
            color: '#5b8c5a',
            fontSize: 36,
          }}
        >
          <CheckCircleOutlined />
        </div>

        {/* 标题 */}
        <h3
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--near-black)',
            marginBottom: 8,
            margin: '0 0 8px',
          }}
        >
          🎉 恭喜！
        </h3>

        <p
          style={{
            fontSize: 14,
            color: 'var(--olive-gray)',
            lineHeight: 1.7,
            marginBottom: 28,
            maxWidth: 320,
          }}
        >
          您的学习已完成，需要生成新的学习路径吗？
        </p>

        {/* 按钮 */}
        <div className="flex items-center gap-3">
          <Button
            onClick={onLater}
            style={{
              fontSize: 13,
              borderColor: 'var(--border-cream)',
              color: 'var(--olive-gray)',
              minWidth: 110,
            }}
          >
            稍后学习
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={onRegenerate}
            style={{
              fontSize: 13,
              background: 'var(--accent)',
              borderColor: 'var(--accent)',
              minWidth: 110,
            }}
          >
            立即生成
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
