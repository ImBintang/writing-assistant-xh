// server/src/ws/handler.ts
// WebSocket server — attaches to existing HTTP server for extraction progress

import { WebSocketServer, WebSocket } from 'ws';
import type http from 'http';
import { getExtractionManager } from '../agents';
import { createLogger } from '../utils/logger';

const logger = createLogger('ws-handler');

export function attachWebSocketServer(httpServer: http.Server): void {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/extract',
  });

  wss.on('connection', (ws: WebSocket, req) => {
    // Parse taskId from URL query: /ws/extract?taskId=xxx
    let taskId: string | null = null;

    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      taskId = url.searchParams.get('taskId');
    } catch {
      // Ignore parse errors
    }

    if (!taskId) {
      logger.warn('WebSocket connection rejected: missing taskId');
      ws.close(4000, '缺少 taskId 参数');
      return;
    }

    logger.info(`WebSocket client connected for task: ${taskId}`);

    try {
      const manager = getExtractionManager();
      manager.subscribeToProgress(taskId, ws);

      // Send initial status immediately
      const status = manager.getTaskStatus(taskId);
      ws.send(
        JSON.stringify({
          type: 'status',
          data: status,
        }),
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      ws.send(
        JSON.stringify({
          type: 'error',
          data: { message: errorMsg },
        }),
      );
    }

    ws.on('close', (code, reason) => {
      logger.info(
        `WebSocket client disconnected: task=${taskId}, code=${code}, reason=${reason ? reason.toString() : 'none'}`,
      );
      if (taskId) {
        try {
          const manager = getExtractionManager();
          manager.unsubscribeFromProgress(taskId, ws);
        } catch {
          // Manager might not be initialized
        }
      }
    });

    ws.on('error', (err) => {
      logger.warn(`WebSocket error for task ${taskId}:`, err.message);
    });

    // Send heartbeat every 15 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat', data: { ts: Date.now() } }));
      } else {
        clearInterval(heartbeat);
      }
    }, 15000);

    ws.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  logger.info('WebSocket server attached (path: /ws/extract)');
}
