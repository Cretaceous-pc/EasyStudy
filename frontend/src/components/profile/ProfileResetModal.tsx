import { Button } from 'antd';
import AppModal from '../shared/AppModal';

interface ProfileResetModalProps {
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProfileResetModal({
  isSaving,
  onConfirm,
  onCancel,
}: ProfileResetModalProps) {
  return (
    <AppModal
      open
      onCancel={onCancel}
      width={400}
      mask={{ closable: !isSaving }}
      closable={!isSaving}
      title={
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500, color: 'var(--near-black)' }}>
          重置学习画像
        </span>
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button onClick={onCancel} disabled={isSaving}
            style={{ fontSize: 13, borderColor: 'var(--border-cream)', color: 'var(--olive-gray)' }}>
            取消
          </Button>
          <Button type="primary" onClick={onConfirm} loading={isSaving}
            style={{ fontSize: 13, background: 'var(--accent)', borderColor: 'var(--accent)' }}>
            {isSaving ? '重置中...' : '确定重置'}
          </Button>
        </div>
      }
    >
      <p style={{ fontSize: 13, color: 'var(--olive-gray)', lineHeight: 1.6, margin: 0 }}>
        确定要重置学习画像吗？当前所有维度数据将被清空，需要重新填写问卷。此操作不可撤销。
      </p>
    </AppModal>
  );
}
