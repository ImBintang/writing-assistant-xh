// server/src/index.ts

// Load .env before anything else
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { createSandbox } from './sandbox';
import apiRouter from './routes/api';
import { appLogger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main(): Promise<void> {
  // Resolve workspace at monorepo root (one level up from server/)
  const workspacePath = path.resolve(__dirname, '..', '..', 'workspace');
  await createSandbox(workspacePath);
  appLogger.info(`Workspace initialized at: ${workspacePath}`);

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // API routes
  app.use('/api/v1', apiRouter);

  // Global error handler
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const statusCode = err.statusCode || err.status || 500;
      appLogger.error(`[${statusCode}] ${err.message}`);

      res.status(statusCode).json({
        error: {
          message: err.message || 'Internal Server Error',
          status: statusCode,
        },
      });
    },
  );

  // Start server
  app.listen(PORT, () => {
    appLogger.info(`Server listening on http://localhost:${PORT}`);
    appLogger.info(`Health check: http://localhost:${PORT}/api/v1/health`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
