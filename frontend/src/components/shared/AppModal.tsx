import { Modal, type ModalProps } from 'antd';

/**
 * 统一弹窗组件 — 封装 antd Modal，应用项目设计系统样式。
 *
 * 预设（可通过 props 覆盖）：
 * - centered: true
 * - 遮罩: 半透明黑色，无模糊
 * - 面板: var(--ivory) 背景 + var(--border-cream) 边框
 * - 圆角: 12px
 * - 阴影: 统一深度阴影
 * - 关闭按钮: antd 默认，mask 点击关闭
 * - body 默认 padding: 24px
 *
 * 用法：直接替换 <Modal> 或自定义 overlay div
 *   <AppModal open={visible} onCancel={onClose} title="标题">
 *     {content}
 *   </AppModal>
 */
export default function AppModal(props: ModalProps) {
  const {
    centered = true,
    mask = { closable: true },
    closable = true,
    footer = null,
    width,
    styles: externalStyles,
    className = '',
    ...rest
  } = props;

  return (
    <Modal
      centered={centered}
      mask={mask}
      closable={closable}
      footer={footer}
      width={width}
      className={`app-modal ${className}`}
      styles={{
        mask: {
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'none',
          ...externalStyles?.mask,
        },
        content: {
          background: 'var(--ivory)',
          border: '1px solid var(--border-cream)',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(42,27,24,0.06), 0 12px 40px rgba(42,27,24,0.12)',
          padding: 0,
          ...externalStyles?.content,
        },
        header: {
          padding: '20px 24px 0',
          marginBottom: 0,
          ...externalStyles?.header,
        },
        body: {
          padding: '20px 24px 24px',
          ...externalStyles?.body,
        },
        footer: externalStyles?.footer,
      }}
      {...rest}
    />
  );
}
