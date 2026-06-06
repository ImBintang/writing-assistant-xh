// server/src/index.ts

// Load .env before anything else
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { createSandbox } from './sandbox';
import { createExtractionManager } from './agents';
import { createSkillRegistry } from './agents/skills/registry';
import { attachWebSocketServer } from './ws/handler';
import apiRouter from './routes/api';
import chaptersRouter from './routes/chapters';
import extractRouter from './routes/extract';
import skillsRouter from './routes/skills';
import knowledgeRouter from './routes/knowledge';
import writingRouter from './routes/writing';
import settingsRouter from './routes/settings';
import brainstormRouter from './routes/brainstorm';
import configRouter from './routes/config';
import { appLogger } from './utils/logger';
import { globalLimiter, aiLimiter, uploadLimiter } from './middleware/rateLimit';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main(): Promise<void> {
  // Resolve workspace at monorepo root (one level up from server/)
  const workspacePath = path.resolve(__dirname, '..', '..', 'workspace');
  await createSandbox(workspacePath);
  appLogger.info(`Workspace initialized at: ${workspacePath}`);

  // Initialize extraction manager
  createExtractionManager();
  appLogger.info('Extraction manager initialized');

  // Load custom skills from disk
  const skillRegistry = createSkillRegistry();
  await skillRegistry.loadCustomSkills();
  appLogger.info('Skill registry initialized');

  // Create Express app
  const app = express();

  // Create HTTP server explicitly for WebSocket support
  const httpServer = http.createServer(app);

  // ==================== Middleware (order matters) ====================

  // 1. Rate limiting — applied globally first
  app.use(globalLimiter);

  // 2. CORS + body parsing
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // ==================== API Routes ====================

  // AI rate-limited routes (10 req/min)
  app.use('/api/v1/extract', aiLimiter, extractRouter);
  app.use('/api/v1/writing', aiLimiter, writingRouter);
  app.use('/api/v1/brainstorm/sessions', aiLimiter, brainstormRouter);

  // Upload rate-limited route (5 req/min)
  app.use('/api/v1/chapters', uploadLimiter, chaptersRouter);

  // Non-rate-limited routes
  app.use('/api/v1', apiRouter);
  app.use('/api/v1/config', configRouter);
  app.use('/api/v1/skills', skillsRouter);
  app.use('/api/v1/knowledge', knowledgeRouter);
  app.use('/api/v1/settings', settingsRouter);

  // ==================== Error Handling ====================

  // Multer error normalization (before the global error handler)
  app.use(
    (
      err: any,
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) => {
      if (err.code === 'LIMIT_FILE_SIZE') {
        err.statusCode = 413;
        err.message = '文件大小超过限制（最大 50MB）';
      } else if (err.code === 'INVALID_FILE_TYPE') {
        err.statusCode = 400;
      }
      next(err);
    },
  );

  // Global error handler
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const statusCode = err.statusCode || err.status || 500;

      // In production mode, don't leak server paths in error messages
      const message =
        process.env.NODE_ENV === 'production' && statusCode === 500
          ? 'Internal Server Error'
          : err.message || 'Internal Server Error';

      appLogger.error(`[${statusCode}] ${err.message}`);

      res.status(statusCode).json({
        error: {
          message,
          status: statusCode,
        },
      });
    },
  );

  // Attach WebSocket server
  attachWebSocketServer(httpServer);
  appLogger.info('WebSocket server attached');

  // Start server
  httpServer.listen(PORT, () => {
    appLogger.info(`Server listening on http://localhost:${PORT}`);
    appLogger.info(`Health check: http://localhost:${PORT}/api/v1/health`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
