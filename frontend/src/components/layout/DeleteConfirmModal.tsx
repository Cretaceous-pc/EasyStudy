import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import AppModal from '../shared/AppModal';

interface DeleteConfirmModalProps {
  open: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function DeleteConfirmModal({
  open,
  title,
  onConfirm,
  onCancel,
  loading,
}: DeleteConfirmModalProps) {
  return (
    <AppModal
      open={open}
      onCancel={onCancel}
      width={360}
      mask={{ closable: !loading }}
      closable={!loading}
      title={
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 28, height: 28, background: '#fdf3e0', color: '#d4882a', fontSize: 14 }}
          >
            <ExclamationCircleOutlined />
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500, color: 'var(--near-black)' }}>
            确认删除
          </span>
        </div>
      }
      footer={
        <div className="flex justify-end gap-2.5">
          <Button onClick={onCancel} disabled={loading}
            style={{ fontSize: 13, borderColor: 'var(--border-cream)', color: 'var(--olive-gray)' }}>
            取消
          </Button>
          <Button type="primary" onClick={onConfirm} disabled={loading} loading={loading}
            style={{ fontSize: 13, background: 'var(--accent)', borderColor: 'var(--accent)' }}>
            {loading ? '删除中…' : '确认删除'}
          </Button>
        </div>
      }
      styles={{ body: { padding: '4px 24px 0' } }}
    >
      <p style={{ fontSize: 13.5, color: 'var(--olive-gray)', lineHeight: 1.65, margin: 0 }}>
        确定要删除会话{' '}
        <strong style={{ color: 'var(--near-black)', fontWeight: 500, fontFamily: 'var(--font-serif)' }}>
          {title.length > 18 ? title.slice(0, 18) + '…' : title}
        </strong>
        {' '}吗？
      </p>
      <p style={{
        fontSize: 11.5, color: 'var(--stone-gray)', lineHeight: 1.5, marginTop: 10,
        padding: '8px 12px', background: 'var(--parchment)', borderRadius: 8,
        border: '1px solid var(--border-cream)',
      }}>
        💡 删除后该会话仍保留在后台，可从教师端恢复，但不会再出现在你的会话列表中。
      </p>
    </AppModal>
  );
}
