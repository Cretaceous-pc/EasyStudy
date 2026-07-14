import { useEffect, useRef, useState } from 'react';
import type { Message } from '../../types/chat';
import MessageBubble from './MessageBubble';
import { LoadingOutlined } from '@ant-design/icons';

interface MessageListProps {
  messages: Message[];
  streamingContent?: string;
  isStreaming?: boolean;
  variant: 'default' | 'companion';
  courseId?: number;
  materialId?: number;
}

export default function MessageList({ messages, streamingContent, isStreaming, variant, courseId, materialId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [prevLen, setPrevLen] = useState(0);
  const newFrom = prevLen;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    setPrevLen(messages.length);
  }, [messages.length]);

  return (
    <div
      className="flex flex-col"
      style={{
        maxWidth: variant === 'companion' ? 780 : undefined,
        margin: variant === 'companion' ? '0 auto' : undefined,
        width: '100%',
      }}
    >
      {messages.map((msg, idx) => (
        <div key={msg.message_id} className={idx >= newFrom && newFrom > 0 ? 'msg-bubble-new' : ''}>
          <MessageBubble
            message={msg}
            index={idx}
            variant={variant}
            courseId={courseId}
            materialId={materialId}
          />
        </div>
      ))}
      {/* 等待首 token 时的加载动画 */}
      {isStreaming && !streamingContent && (
        <div
          className="flex items-center gap-2"
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(240,238,230,0.6)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--stone-gray)', fontFamily: 'var(--font-sans)' }}>
            AI 正在思考
          </span>
          <LoadingOutlined style={{ fontSize: 12, color: 'var(--accent)' }} />
        </div>
      )}

      {/* 流式内容 */}
      {streamingContent && (
        <MessageBubble
          message={{
            message_id: -1,
            role: 'assistant',
            content: streamingContent,
            created_at: new Date().toISOString(),
          }}
          index={messages.length}
          variant={variant}
          isStreaming
        />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
