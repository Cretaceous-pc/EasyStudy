import { useState, memo } from 'react';
import {
  BookOutlined,
  EditOutlined,
  NodeIndexOutlined,
  RadarChartOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useLayoutStore } from '../../stores';
import AppModal from '../shared/AppModal';
import type { MainView } from '../../stores/layoutStore';

const icons: { key: MainView; icon: any; title: string }[] = [
  { key: 'chat', icon: BookOutlined, title: '课件' },
  { key: 'resources', icon: EditOutlined, title: '资源生成' },
  { key: 'path', icon: NodeIndexOutlined, title: '学习路径' },
  { key: 'profile', icon: RadarChartOutlined, title: '学习画像' },
];

const ABOUT_MD = `easyStudy 是一个 **AI 驱动的个性化学习平台**，核心理念是通过大语言模型（LLM）为每位学习者生成自适应学习路径、智能课件对话、个性化资源，并构建动态学生画像以持续优化学习体验。

---

## 技术架构

| 层 | 技术栈 |
|---|---|
| 前端 | React 19 + TypeScript + Vite + Ant Design 6 + Tailwind CSS 4 + Zustand |
| 主后端 | Java Spring Boot 3 + Maven + Spring Security (JWT) |
| AI 后端 | Python FastAPI + LangGraph + DeepSeek |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis 7 |
| 向量库 | Chroma |
| 文件存储 | MinIO (S3) |

## 核心业务链路

### 1. 学习路径生成
用户填写偏好问卷 → LangGraph 5 节点流水线（load_context → generate_path → generate_teach_content → save_path → index_teach_to_kb）→ LLM 生成树状知识图谱 + 并行生成教学内容 → 切片存入 Chroma 向量库供 RAG 检索。

### 2. 课件 AI 伴读
教师上传课件 → MinIO 存储 + 向量切片 → 学生打开课件时自动绑定 AI 对话 → 对话上下文基于课件向量检索（RAG），确保回答紧扣当前学习材料。

### 3. 资源生成
选择主题 + 资源类型（文档/思维导图/练习题/代码案例/拓展阅读）→ LangGraph 并行 fanout 5 个生成节点 → SSE 流式推送进度 → 自动入库 MinIO + 向量化。

### 4. 学生画像
对话/行为触发画像抽取 → LangGraph extract_dimensions → compare_and_decide → apply_update → 画像维度（知识基础、学习节奏、认知风格等）动态演化，驱动个性化推荐。

## 请求链路

\`\`\`
前端 axios → Vite proxy → Spring Boot (JWT 鉴权)
  → 注入 X-User-Id → RestTemplate → FastAPI
    → LangGraph 状态图 → DeepSeek LLM
      → PostgreSQL / Chroma / MinIO
\`\`\`

---

**联系方式：2304185505@qq.com**
`;

export default function IconBar() {
  const { showDirectory, setShowDirectory, activeView, setActiveView } = useLayoutStore();
  const [showAbout, setShowAbout] = useState(false);

  const handleIconClick = (key: MainView) => {
    if (key === 'chat') {
      setActiveView('chat');
      setShowDirectory(!showDirectory);
    } else {
      setActiveView(key);
    }
  };

  return (
    <nav
      className="flex flex-col items-center py-3.5 gap-1.5 flex-shrink-0"
      style={{
        width: 52,
        background: 'var(--warm-sand)',
        borderRight: '1px solid var(--border-warm)',
      }}
    >
      {icons.map(({ key, icon: Icon, title }) => {
        const isActive =
          key === 'chat'
            ? activeView === 'chat' && showDirectory
            : activeView === key;
        return (
          <button
            key={key}
            onClick={() => handleIconClick(key)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border-none cursor-pointer relative"
            style={{
              background: isActive ? 'var(--ivory)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--stone-gray)',
              fontSize: 15,
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: isActive
                ? '0 1px 3px rgba(42,27,24,0.05), 0 0 0 1px var(--border-cream)'
                : 'none',
            }}
            title={title}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--border-cream)';
                e.currentTarget.style.color = 'var(--olive-gray)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--stone-gray)';
              }
            }}
          >
            <Icon />
            {isActive && (
              <span
                className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-sm"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={() => setShowAbout(true)}
        className="w-9 h-9 flex items-center justify-center rounded-lg border-none cursor-pointer"
        style={{
          background: 'transparent',
          color: 'var(--stone-gray)',
          fontSize: 15,
          transition: 'all 0.2s',
        }}
        title="帮助"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--border-cream)';
          e.currentTarget.style.color = 'var(--olive-gray)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--stone-gray)';
        }}
      >
        <QuestionCircleOutlined />
      </button>

      <AppModal
        open={showAbout}
        onCancel={() => setShowAbout(false)}
        width="50vw"
        title={
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500, color: 'var(--near-black)' }}>
            easyStudy 介绍与帮助
          </span>
        }
        styles={{ body: { padding: '20px 28px 24px', maxHeight: '70vh', overflowY: 'auto', scrollbarWidth: 'none' } }}
        footer={null}
      >
        <AboutContent />
      </AppModal>
    </nav>
  );
}

const AboutContent = memo(function AboutContent() {
  return (
    <div style={{ fontSize: 13.5, color: 'var(--olive-gray)', lineHeight: 1.85, fontFamily: 'var(--font-sans)' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw] as any}
        components={{
          h1: ({ children }) => (
            <h1 style={{ fontSize: 18, fontWeight: 500, margin: '16px 0 10px', color: 'var(--near-black)', fontFamily: 'var(--font-serif)' }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 16, fontWeight: 500, margin: '18px 0 8px', color: 'var(--near-black)', fontFamily: 'var(--font-serif)', borderBottom: '1px solid var(--border-cream)', paddingBottom: 4 }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: '12px 0 6px', color: 'var(--near-black)' }}>
              {children}
            </h3>
          ),
          p: ({ children }) => <p style={{ marginBottom: 12 }}>{children}</p>,
          strong: ({ children }) => (
            <strong style={{ color: 'var(--near-black)', fontWeight: 500 }}>{children}</strong>
          ),
          code: ({ children }) => (
            <code style={{
              background: 'var(--parchment)', color: '#b55738',
              padding: '1px 5px', borderRadius: 3,
              fontFamily: 'var(--font-mono)', fontSize: 12,
            }}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre style={{
              background: 'var(--ivory)', border: '1px solid var(--border-cream)',
              borderRadius: 8, padding: '12px 16px', overflowX: 'auto',
              fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, margin: '12px 0',
            }}>
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '14px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: 'var(--olive-gray)' }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr style={{ borderBottom: '1px solid var(--border-cream)' }}>{children}</tr>
          ),
          th: ({ children }) => (
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: 'var(--near-black)', background: 'var(--parchment)', fontSize: 12 }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ padding: '8px 12px' }}>{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{
              margin: '12px 0', padding: '10px 16px',
              borderLeft: '3px solid var(--accent)',
              background: 'var(--accent-light)',
              borderRadius: '0 6px 6px 0',
              color: 'var(--olive-gray)', fontSize: 13,
            }}>
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-cream)', margin: '16px 0' }} />
          ),
        }}
      >
        {ABOUT_MD}
      </ReactMarkdown>
    </div>
  );
});
