// server/src/routes/settings.ts
// Setting REST API routes for PRD-06
// Mounted at /api/v1/settings

import { Router, Request, Response } from 'express';
import * as settingsService from '../services/settings';
import {
  createSettingSchema,
  updateSettingSchema,
  referenceSchema,
  migrateSchema,
  migrateConfirmSchema,
} from '../types/knowledge';
import { createLogger } from '../utils/logger';
import { sanitizeMiddleware } from '../middleware/validate';

const logger = createLogger('routes-settings');
const settingsRouter = Router();

// GET /api/v1/settings — list all setting files
settingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const settings = await settingsService.listSettings(category);
    res.json(settings);
  } catch (err) {
    logger.error('Failed to list settings:', err);
    res.status(500).json({ error: '获取设定列表失败' });
  }
});

// POST /api/v1/settings — create a new setting file
settingsRouter.post('/', sanitizeMiddleware(['title', 'content', 'template']), async (req: Request, res: Response) => {
  const parsed = createSettingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数校验失败', details: parsed.error.errors });
    return;
  }

  try {
    const setting = await settingsService.createSetting(parsed.data);
    res.status(201).json(setting);
  } catch (err) {
    logger.error('Failed to create setting:', err);
    res.status(500).json({ error: '创建设定失败' });
  }
});

// GET /api/v1/settings/:id — read a setting file
settingsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const setting = await settingsService.getSettingById(id);
    if (!setting) {
      res.status(404).json({ error: '设定文件不存在' });
      return;
    }
    res.json(setting);
  } catch (err) {
    logger.error('Failed to read setting:', err);
    res.status(500).json({ error: '读取设定失败' });
  }
});

// PUT /api/v1/settings/:id — update a setting file
settingsRouter.put('/:id', sanitizeMiddleware(['title', 'content']), async (req: Request, res: Response) => {
  const parsed = updateSettingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数校验失败', details: parsed.error.errors });
    return;
  }

  try {
    const setting = await settingsService.updateSetting(String(req.params.id), parsed.data);
    if (!setting) {
      res.status(404).json({ error: '设定文件不存在' });
      return;
    }
    res.json(setting);
  } catch (err) {
    logger.error('Failed to update setting:', err);
    res.status(500).json({ error: '更新设定失败' });
  }
});

// DELETE /api/v1/settings/:id — delete a setting file
settingsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await settingsService.deleteSettingFile(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: '设定文件不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete setting:', err);
    res.status(500).json({ error: '删除设定失败' });
  }
});

// POST /api/v1/settings/:id/reference — add a knowledge reference
settingsRouter.post('/:id/reference', async (req: Request, res: Response) => {
  const parsed = referenceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数校验失败', details: parsed.error.errors });
    return;
  }

  try {
    const setting = await settingsService.addReferenceToSetting(
      String(req.params.id),
      parsed.data.knowledgeId,
    );
    if (!setting) {
      res.status(404).json({ error: '设定文件不存在' });
      return;
    }
    res.json(setting);
  } catch (err) {
    logger.error('Failed to add reference:', err);
    res.status(500).json({ error: '添加引用失败' });
  }
});

// POST /api/v1/settings/migrate — preview migration (MUST come before /:id routes)
settingsRouter.post('/migrate', async (req: Request, res: Response) => {
  const parsed = migrateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数校验失败', details: parsed.error.errors });
    return;
  }

  try {
    const preview = await settingsService.previewMigration(parsed.data.settingIds);
    res.json(preview);
  } catch (err) {
    logger.error('Failed to preview migration:', err);
    res.status(500).json({ error: '迁移预览失败' });
  }
});

// POST /api/v1/settings/migrate/confirm — confirm and execute migration
settingsRouter.post('/migrate/confirm', async (req: Request, res: Response) => {
  const parsed = migrateConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数校验失败', details: parsed.error.errors });
    return;
  }

  try {
    const result = await settingsService.confirmMigration(
      parsed.data.preview,
      parsed.data.resolvedConflicts,
    );
    res.json(result);
  } catch (err) {
    logger.error('Failed to confirm migration:', err);
    res.status(500).json({ error: '迁移执行失败' });
  }
});

export default settingsRouter;
