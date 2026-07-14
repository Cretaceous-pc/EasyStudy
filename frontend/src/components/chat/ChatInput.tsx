import { useState, useRef } from 'react';
import { ArrowUpOutlined } from '@ant-design/icons';
import { useChatStore, useCourseStore, useLayoutStore } from '../../stores';
import { useSSE } from '../../hooks/useSSE';

interface ChatInputProps {
  expanded?: boolean;
  variant?: 'floating' | 'ghost';
  context?: Record<string, unknown>;
  materialId?: number;
  onResourceGen?: () => void;
}

export default function ChatInput({ expanded = false, variant = 'floating', context, materialId, onResourceGen }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    addMessage, appendStreamingContent, setStreamingContent, setIsStreaming,
    finalizeStreamingMessage, isStreaming,
    currentConversationId, setCurrentConversation, fetchConversations,
  } = useChatStore();
  const { connect, disconnect, isConnected } = useSSE();

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // 首页：自动展开对话框以显示回复
    if (variant !== 'ghost') {
      const { isChatExpanded, setChatExpanded } = useLayoutStore.getState();
      if (!isChatExpanded) {
        setChatExpanded(true);
      }
    }

    // 防重入标记：error/done/timeout 只触发一次 finalize
    let handled = false;
    const safeFinalize = () => {
      if (handled) return;
      handled = true;
      finalizeStreamingMessage();
    };

    // Add user message
    addMessage({
      message_id: Date.now(),
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    });

    setText('');
    setStreamingContent('');
    setIsStreaming(true);

    // In mock mode, simulate SSE streaming
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const mockResponses = [
        '好的，',
        '让我',
        '来回答',
        '你的',
        '问题。\n\n',
        '根据',
        '课程',
        '资料，',
        '这',
        '是一个',
        '很好的',
        '问题。',
        '在',
        '机器',
        '学习',
        '中，',
        '这个',
        '概念',
        '非常',
        '重要。',
      ];

      let idx = 0;
      const interval = setInterval(() => {
        if (idx >= mockResponses.length) {
          clearInterval(interval);
          finalizeStreamingMessage();
          return;
        }
        appendStreamingContent(mockResponses[idx]);
        idx++;
      }, 120);

      return;
    }

    // 使用当前激活课程的 ID
    const cs = useCourseStore.getState();
    const courseId = cs.activeCourseId
      || cs.enrolledCourses[0]?.course_id
      || (context as Record<string, number> | undefined)?.course_id;

    if (!courseId) {
      console.warn('无法发送消息：没有选中课程');
      return;
    }

    await connect({
      url: '/api/ai/chat/send',
      body: {
        course_id: courseId,
        conversation_id: currentConversationId,
        message: trimmed,
        material_id: materialId ?? null,
        context_type: materialId ? 'courseware' : 'general',
        context: context || {},
      },
      timeoutMs: 90000,
      onTimeout: () => {
        if (handled) return;
        const currentContent = useChatStore.getState().streamingContent;
        if (currentContent) {
          useChatStore.getState().appendStreamingContent('\n\n> ⚠️ 回复超时，请稍后重试');
        } else {
          useChatStore.getState().setStreamingContent('> ⚠️ 回复超时，请稍后重试');
        }
        safeFinalize();
      },
      onEvent: (evt) => {
        if (handled) return;
        if (evt.type === 'conversation_created' && evt.data?.conversation_id) {
          setCurrentConversation(evt.data.conversation_id);
          fetchConversations({ course_id: courseId });
        }
        if (evt.type === 'message' && typeof evt.data.content === 'string') {
          appendStreamingContent(evt.data.content);
        }
        if (evt.type === 'error') {
          const errMsg = (evt.data?.message as string) || '未知错误';
          useChatStore.getState().appendStreamingContent(`\n\n> ⚠️ ${errMsg}`);
          safeFinalize();
        }
        if (evt.type === 'done') {
          safeFinalize();
        }
      },
      onError: (err) => {
        if (handled) return;
        useChatStore.getState().appendStreamingContent(
          `\n\n> ⚠️ 请求失败：${err.message.slice(0, 50)}`
        );
        safeFinalize();
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  if (variant === 'ghost') {
    return (
      <div
        className="w-full"
        style={{
          maxWidth: 780,
          margin: '0 auto 8px',
          padding: '10px 20px 16px',
          background: 'var(--ivory)',
          border: '1px solid var(--border-cream)',
          borderTop: '2px solid var(--accent)',
          borderRadius: '12px 12px 0 0',
          boxShadow: '0 -2px 12px rgba(42,27,24,0.04)',
        }}
      >
        <textarea
          ref={textareaRef}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="针对上方课件提问... (Enter 发送，Shift+Enter 换行)"
          className="w-full border-none outline-none resize-none bg-transparent"
          style={{
            fontSize: 14,
            color: 'var(--near-black)',
            fontFamily: 'var(--font-sans)',
            padding: '4px 0',
            lineHeight: 1.6,
          }}
        />
        <div className="flex items-center justify-between pt-2 mt-1.5" style={{ borderTop: '1px solid var(--border-cream)' }}>
          <span style={{ fontSize: 10, color: 'var(--warm-silver)', fontFamily: 'var(--font-sans)' }}>
            Enter 发送 · Shift+Enter 换行
          </span>
          <div className="flex items-center gap-2">
            {onResourceGen && (
              <button
                onClick={onResourceGen}
                disabled={isStreaming}
                className="flex items-center justify-center border-none cursor-pointer"
                style={{
                  height: 26,
                  padding: '0 12px',
                  borderRadius: 6,
                  background: 'var(--accent-light)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  opacity: isStreaming ? 0.5 : 1,
                }}
              >
                资源生成
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!text.trim() || isStreaming}
              className="flex items-center justify-center border-none cursor-pointer"
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 10,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: text.trim() ? 1 : 0.5,
                transform: text.trim() ? 'scale(1)' : 'scale(0.95)',
              }}
            >
              <ArrowUpOutlined />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl p-3"
      style={{
        maxWidth: expanded ? 680 : 580,
        background: 'var(--ivory)',
        border: '1px solid var(--border-cream)',
        boxShadow: expanded
          ? '0 1px 3px rgba(42,27,24,0.04), 0 8px 32px rgba(42,27,24,0.06)'
          : '0 1px 3px rgba(42,27,24,0.04), 0 4px 16px rgba(42,27,24,0.04)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <textarea
        ref={textareaRef}
        rows={expanded ? undefined : 3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入任何学科疑问，或者让我帮你总结核心考点、生成思维导图、出练习题..."
        className="w-full border-none outline-none resize-none bg-transparent"
        style={{
          fontSize: 14,
          color: 'var(--near-black)',
          fontFamily: 'var(--font-sans)',
          padding: '2px 4px 0',
          lineHeight: 1.6,
          minHeight: expanded ? 80 : undefined,
        }}
      />
      <div className="flex items-center justify-between pt-2 pb-0.5 px-1 mt-2.5" style={{ borderTop: '1px solid var(--border-cream)' }}>
        <span style={{ fontSize: 10, color: 'var(--warm-silver)', fontFamily: 'var(--font-sans)' }}>
          Enter 发送 · Shift+Enter 换行
        </span>
        <button
          onClick={handleSend}
          disabled={!text.trim() || isStreaming}
          className="flex items-center justify-center border-none cursor-pointer"
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 12,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 1px 3px rgba(201,100,66,0.25)',
            opacity: text.trim() ? 1 : 0.5,
          }}
        >
          <ArrowUpOutlined />
        </button>
      </div>
    </div>
  );
}


