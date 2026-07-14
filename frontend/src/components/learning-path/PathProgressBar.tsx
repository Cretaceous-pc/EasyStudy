import { Button, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { LearningPath } from '../../types/learningPath';

interface Props {
  path: LearningPath;
  isLoading: boolean;
  onRegenerate: () => void;
}

/**
 * 顶部标题栏 + 重新生成按钮（无进度条）
 */
export default function PathProgressBar({ path, isLoading, onRegenerate }: Props) {
  return (
    <div
      className="flex-shrink-0"
      style={{ padding: '20px 28px 16px' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 22,
              fontWeight: 500,
              color: 'var(--near-black)',
              marginBottom: 4,
              margin: 0,
            }}
          >
            学习路径
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <Tag
              style={{
                fontSize: 11,
                background: 'var(--accent-light)',
                color: 'var(--accent)',
                border: 'none',
              }}
            >
              进度 {path.overallProgress}%
            </Tag>
          </div>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={isLoading}
          disabled={isLoading}
          onClick={onRegenerate}
          style={{
            fontSize: 12,
            borderColor: 'var(--border-cream)',
            color: 'var(--olive-gray)',
          }}
        >
          重新生成
        </Button>
      </div>
    </div>
  );
}
