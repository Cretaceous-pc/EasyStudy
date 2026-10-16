import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 可选：出错时的替代 UI */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 顶层错误边界。
 *
 * 原实现完全没有 ErrorBoundary：任何渲染期异常（例如后端返回了前端
 * 未识别的资源类型，导致 typeConfig[type] 为 undefined 后取 .icon）
 * 都会让整个应用白屏，且用户看不到任何原因。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 保留控制台细节便于定位；UI 上只给可操作的信息
    console.error('[ErrorBoundary] 渲染异常:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--ivory, ***REMOVED***faf9f5)',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            border: '1px solid var(--border-cream, ***REMOVED***e8e2d6)',
            borderRadius: 12,
            background: '***REMOVED***fff',
            padding: 28,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: '***REMOVED***b55738', marginBottom: 10 }}>
            页面渲染出错
          </div>
          <div style={{ fontSize: 13, color: '***REMOVED***4d4c48', lineHeight: 1.7, marginBottom: 16 }}>
            这是前端渲染异常，不是你的操作问题。可以重试；若反复出现，
            请把下面这行信息反馈给管理员。
          </div>
          <pre
            style={{
              fontSize: 12,
              background: 'var(--parchment, ***REMOVED***f5f0e8)',
              border: '1px solid var(--border-cream, ***REMOVED***e8e2d6)',
              borderRadius: 8,
              padding: 12,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              margin: '0 0 16px',
            }}
          >
            {error.message}
          </pre>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={this.reset}
              style={{
                fontSize: 13,
                padding: '7px 16px',
                borderRadius: 6,
                border: '1px solid var(--accent, ***REMOVED***c96442)',
                background: 'var(--accent, ***REMOVED***c96442)',
                color: '***REMOVED***fff',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                fontSize: 13,
                padding: '7px 16px',
                borderRadius: 6,
                border: '1px solid var(--border-cream, ***REMOVED***e8e2d6)',
                background: '***REMOVED***fff',
                color: '***REMOVED***4d4c48',
                cursor: 'pointer',
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}
