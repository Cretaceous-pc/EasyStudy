import { useCallback, useRef, useState } from 'react';
import type { SSEEvent } from '../types/chat';
import { useAuthStore } from '../stores/authStore';

/** 超时专用错误 */
class SSETimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSETimeoutError';
  }
}

interface UseSSEOptions {
  url: string;
  body: Record<string, unknown>;
  onEvent?: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
  onDone?: () => void;
  /** 读取超时（毫秒），默认 90 秒 */
  timeoutMs?: number;
}

export function useSSE() {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const connect = useCallback(
    async ({ url, body, onEvent, onError, onTimeout, onDone, timeoutMs = 90000 }: UseSSEOptions) => {
      // Abort previous connection
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      // 超时哨兵：超时后设为 true，所有后续数据丢弃
      let timedOut = false;

      setIsConnected(true);
      setEvents([]);

      try {
        const token = useAuthStore.getState().token;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`SSE request failed: ${response.status} ${response.statusText}`);
        }
        if (!response.body) {
          throw new Error('SSE response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          // Promise.race：read() vs 超时
          let readResult: ReadableStreamReadResult<Uint8Array>;
          try {
            readResult = await Promise.race([
              reader.read(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new SSETimeoutError('SSE 读取超时')), timeoutMs),
              ),
            ]);
          } catch (e) {
            if (e instanceof SSETimeoutError) {
              timedOut = true;
              controller.abort();
              onTimeout?.();
              break;
            }
            throw e;
          }

          const { done, value } = readResult;
          if (done) break;

          // 超时后到达的数据直接丢弃
          if (timedOut) continue;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (timedOut) break;

            const lines = part.split('\n');
            let eventType = 'message';
            let data = '';

            for (const line of lines) {
              if (line.startsWith('event:')) eventType = line.slice(6).trim();
              if (line.startsWith('data:')) data = line.slice(5).trim();
            }

            if (data && !timedOut) {
              try {
                const parsed = JSON.parse(data);
                const evt: SSEEvent = { type: eventType, data: parsed };
                setEvents((prev) => [...prev, evt]);
                onEvent?.(evt);

                if (eventType === 'done') {
                  onDone?.();
                }
              } catch {
                // ignore malformed JSON
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // 超时触发的 abort — 不当作错误（已通过 onTimeout 处理）
        } else {
          onError?.(err as Error);
        }
      } finally {
        setIsConnected(false);
      }
    },
    [],
  );

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsConnected(false);
  }, []);

  return { connect, disconnect, isConnected, events };
}
