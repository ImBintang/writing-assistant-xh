// server/src/routes/api.ts

import { Router, Request, Response } from 'express';
import { getSandbox } from '../sandbox';

const router = Router();

// =================== Health & System ===================

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/system/info', (_req: Request, res: Response) => {
  res.json({
    name: 'writing-assistant',
    version: '0.1.0',
    nodeVersion: process.version,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
});

// =================== Workspace ===================

router.get('/workspace/status', async (_req: Request, res: Response) => {
  const sandbox = getSandbox();
  const status = await sandbox.getStatus();
  res.json(status);
});

router.post('/workspace/init', async (_req: Request, res: Response) => {
  const sandbox = getSandbox();
  await sandbox.initialize();
  const status = await sandbox.getStatus();
  res.json({ message: 'Workspace re-initialized', ...status });
});

// NOTE: Config routes have been moved to /api/v1/config (routes/config.ts)
// NOTE: Context usage and path validation are now in routes/config.ts

export default router;
