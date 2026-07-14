import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import App from './App'
import './index.css'

const theme = {
  token: {
    colorPrimary: '#c96442',
    borderRadius: 8,
    fontFamily: `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`,
    colorBgContainer: '#faf9f5',
    colorBgLayout: '#f5f4ed',
    colorBorder: '#f0eee6',
    colorText: '#141413',
    colorTextSecondary: '#5e5d59',
    boxShadow: '0 1px 3px rgba(42,27,24,0.03)',
  },
  components: {
    Tree: {
      nodeSelectedBg: '#f5f4ed',
      nodeHoverBg: '#e8e6dc',
    },
    Splitter: {
      splitBarSize: 6,
      splitBarTriggerSize: 12,
    },
    Tag: {
      defaultBg: '#e8d4c8',
      defaultColor: '#c96442',
    },
    Button: {
      primaryShadow: '0 1px 3px rgba(201,100,66,0.25)',
    },
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={theme}>
      <App />
    </ConfigProvider>
  </StrictMode>,
)
