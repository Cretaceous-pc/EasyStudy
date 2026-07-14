import { useState } from 'react';
import type { Message } from '../../types/chat';

interface FastScrollerProps {
  messages: Message[];
  onScrollTo: (index: number) => void;
}

export default function FastScroller({ messages, onScrollTo }: FastScrollerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className="fixed flex flex-col items-center gap-1.5 z-5"
      style={{
        right: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        opacity: messages.length >= 6 ? 1 : 0,
        pointerEvents: messages.length >= 6 ? 'auto' : 'none',
        transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className="relative cursor-pointer"
          style={{
            width: hoveredIndex === idx ? 4 : 3,
            height: hoveredIndex === idx ? 4 : 3,
            borderRadius: '50%',
            background: msg.role === 'user' ? 'rgba(201,100,66,0.35)' : 'var(--warm-silver)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => onScrollTo(idx)}
        >
          {hoveredIndex === idx && (
            <div
              className="absolute"
              style={{
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--ivory)',
                border: '1px solid var(--border-cream)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 11,
                color: 'var(--olive-gray)',
                fontFamily: 'var(--font-sans)',
                whiteSpace: 'nowrap',
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                boxShadow: '0 2px 8px rgba(42,27,24,0.05)',
                zIndex: 10,
              }}
            >
              {msg.content.slice(0, 40)}{msg.content.length > 40 ? '...' : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
