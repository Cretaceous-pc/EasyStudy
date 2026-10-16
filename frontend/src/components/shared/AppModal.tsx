import { Modal, type ModalProps } from 'antd';
import type { CSSProperties } from 'react';

/**
 * 统一弹窗组件 — 封装 antd Modal，应用项目设计系统样式。
 *
 * 预设（可通过 props 覆盖）：
 * - centered: true
 * - 遮罩: 半透明黑色，无模糊
 * - 面板: var(--ivory) 背景 + var(--border-cream) 边框
 * - 圆角: 12px / 统一深度阴影
 * - footer 默认 null（由调用方自行提供）
 *
 * antd 6 迁移说明
 * ---------------
 * antd 5 的面板样式槽位叫 `content`，antd 6 已改名为 `container`
 * （antd 6 中 `content` 不再是合法槽位）。本组件对外仍接受 `content`，
 * 内部映射到 `container`，以免逐个修改调用方。
 *
 * 另外 antd 6 的 `styles` 类型是"对象 | 函数"的联合，直接传对象字面量
 * 会被 TS 判为不匹配，故此处用显式 CSSProperties 类型收窄。
 */
interface AppModalStyleSlots {
  mask?: CSSProperties;
  /** antd 5 名称，内部映射到 antd 6 的 container */
  content?: CSSProperties;
  /** antd 6 名称（优先于 content） */
  container?: CSSProperties;
  header?: CSSProperties;
  body?: CSSProperties;
  footer?: CSSProperties;
  wrapper?: CSSProperties;
  root?: CSSProperties;
}

type AppModalProps = Omit<ModalProps, 'styles'> & {
  styles?: AppModalStyleSlots;
};

export default function AppModal(props: AppModalProps) {
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

  const panelStyle: CSSProperties = {
    background: 'var(--ivory)',
    border: '1px solid var(--border-cream)',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(42,27,24,0.06), 0 12px 40px rgba(42,27,24,0.12)',
    padding: 0,
    ...externalStyles?.content,
    ...externalStyles?.container,
  };

  const mergedStyles: NonNullable<ModalProps['styles']> = {
    mask: {
      background: 'rgba(0,0,0,0.25)',
      backdropFilter: 'none',
      ...externalStyles?.mask,
    },
    container: panelStyle,
    header: {
      padding: '20px 24px 0',
      marginBottom: 0,
      ...externalStyles?.header,
    },
    body: {
      padding: '20px 24px 24px',
      ...externalStyles?.body,
    },
  };
  if (externalStyles?.footer) mergedStyles.footer = externalStyles.footer;
  if (externalStyles?.wrapper) mergedStyles.wrapper = externalStyles.wrapper;
  if (externalStyles?.root) mergedStyles.root = externalStyles.root;

  return (
    <Modal
      centered={centered}
      mask={mask}
      closable={closable}
      footer={footer}
      width={width}
      className={`app-modal ${className}`}
      styles={mergedStyles}
      {...rest}
    />
  );
}
