// client/src/hooks/useExtractionWebSocket.ts
// WebSocket hook for real-time extraction progress updates

import { useEffect, useRef, useState, useCallback } from 'react';

export interface ProgressUpdate {
  totalSteps: number;
  completedSteps: number;
  currentChapterIndex: number | null;
  currentChapterTitle: string | null;
  currentCategory: string | null;
}

export interface MergeCompleteUpdate {
  category: string;
  added: string[];
  merged: string[];
  conflicts: unknown[];
}

export interface TaskCompleteUpdate {
  status: string;
  progress: { totalSteps: number; completedSteps: number };
  errors?: unknown[];
}

export interface UseExtractionWebSocketOptions {
  taskId: string | null;
  onProgress?: (data: ProgressUpdate) => void;
  onMergeComplete?: (data: MergeCompleteUpdate) => void;
  onTaskComplete?: (data: TaskCompleteUpdate) => void;
  onError?: (error: { message: string }) => void;
  onFallbackToPolling?: () => void;
}

interface WSMessage {
  type: 'status' | 'progress' | 'merge_complete' | 'task_complete' | 'error' | 'cancelled' | 'heartbeat';
  data: unknown;
}

export function useExtractionWebSocket(options: UseExtractionWebSocketOptions): {
  connected: boolean;
  disconnect: () => void;
} {
  const { taskId } = options;
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacksRef = useRef(options);

  // Keep callback refs up to date
  callbacksRef.current = options;

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    reconnectAttempts.current = maxReconnectAttempts;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!taskId) {
      disconnect();
      return;
    }

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        callbacksRef.current.onFallbackToPolling?.();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/extract?taskId=${taskId}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);

            switch (message.type) {
              case 'status': {
                const data = message.data as { progress?: ProgressUpdate };
                if (data.progress && callbacksRef.current.onProgress) {
                  callbacksRef.current.onProgress(data.progress);
                }
                break;
              }
              case 'progress':
                callbacksRef.current.onProgress?.(message.data as ProgressUpdate);
                break;
              case 'merge_complete':
                callbacksRef.current.onMergeComplete?.(message.data as MergeCompleteUpdate);
                break;
              case 'task_complete':
                callbacksRef.current.onTaskComplete?.(message.data as TaskCompleteUpdate);
                break;
              case 'error':
                callbacksRef.current.onError?.(message.data as { message: string });
                break;
              case 'cancelled':
                callbacksRef.current.onTaskComplete?.({ status: 'cancelled', progress: { totalSteps: 0, completedSteps: 0 } });
                break;
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = (event) => {
          setConnected(false);
          wsRef.current = null;
          if (event.code === 1000) return;

          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.pow(2, reconnectAttempts.current) * 1000;
            reconnectAttempts.current++;
            reconnectTimer.current = setTimeout(connect, delay);
          } else {
            callbacksRef.current.onFallbackToPolling?.();
          }
        };
      } catch {
        // Connection failed
      }
    };

    connect();

    return () => {
      disconnect();
    };
  }, [taskId, disconnect]);

  return { connected, disconnect };
}
