import ActionButton from '../shared/ActionButton';
import { EditOutlined, SaveOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';

interface ProfileHeaderProps {
  isEditing: boolean;
  onStartEditing: () => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}

export default function ProfileHeader({
  isEditing,
  onStartEditing,
  onSave,
  onCancel,
  onReset,
}: ProfileHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--near-black)',
            marginBottom: 4,
          }}
        >
          学习画像
        </h1>
        <p style={{ fontSize: 13, color: 'var(--olive-gray)' }}>
          6 维动态画像，随学习过程自动演化
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <ActionButton icon={<SaveOutlined />} label="保存" primary onClick={onSave} />
            <ActionButton icon={<CloseOutlined />} label="取消" onClick={onCancel} />
          </>
        ) : (
          <>
            <ActionButton icon={<EditOutlined />} label="编辑" onClick={onStartEditing} />
            <ActionButton icon={<ReloadOutlined />} label="重置面板" onClick={onReset} />
          </>
        )}
      </div>
    </div>
  );
}
