import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import App from './App'
import ErrorBoundary from './components/shared/ErrorBoundary'
import './index.css'

const theme = {
  token: {
    colorPrimary: '***REMOVED***c96442',
    borderRadius: 8,
    fontFamily: `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`,
    colorBgContainer: '***REMOVED***faf9f5',
    colorBgLayout: '***REMOVED***f5f4ed',
    colorBorder: '***REMOVED***f0eee6',
    colorText: '***REMOVED***141413',
    colorTextSecondary: '***REMOVED***5e5d59',
    boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
  },
  components: {
    Tree: {
      nodeSelectedBg: '***REMOVED***f5f4ed',
      nodeHoverBg: '***REMOVED***e8e6dc',
    },
    Splitter: {
      splitBarSize: 6,
      splitBarTriggerSize: 12,
    },
    Tag: {
      defaultBg: '***REMOVED***e8d4c8',
      defaultColor: '***REMOVED***c96442',
    },
    Button: {
      primaryShadow: '0 1px 3px rgba(201,100,66,0.25)',
    },
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 顶层错误边界：原先没有它，任何渲染期异常都会直接白屏且无提示 */}
    <ErrorBoundary>
      <ConfigProvider theme={theme}>
        <App />
      </ConfigProvider>
    </ErrorBoundary>
  </StrictMode>,
)
