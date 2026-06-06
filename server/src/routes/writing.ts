// server/src/routes/writing.ts
// Writing window routes for PRD-05
// Provides RAG retrieval, AI writing operations, and draft management endpoints.

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { createLogger } from '../utils/logger';
import { getSandbox } from '../sandbox';
import * as writingService from '../services/writing';
import {
  retrieveRequestSchema,
  generateRequestSchema,
  continueRequestSchema,
  polishRequestSchema,
  expandRequestSchema,
  shortenRequestSchema,
  rewriteRequestSchema,
  foreshadowCheckSchema,
  createDraftSchema,
  updateDraftSchema,
} from '../types/knowledge';
import type { DraftOutline, GenerateRequest, ContinueRequest, PolishRequest, ExpandRequest, ShortenRequest, RewriteRequest, ForeshadowCheckRequest } from '../types/knowledge';

const logger = createLogger('routes-writing');
const router = Router();

// ============================================================
// RAG Retrieval
// ============================================================

router.post('/retrieve', async (req: Request, res: Response) => {
  try {
    const parsed = retrieveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const result = await writingService.retrieve(parsed.data);
    res.json(result);
  } catch (err: any) {
    logger.error(`Retrieve error: ${err.message}`);
    res.status(500).json({ error: '检索先验知识失败' });
  }
});

// ============================================================
// AI Writing Operations
// ============================================================

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const parsed = generateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const result = await writingService.generate(parsed.data as unknown as GenerateRequest);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(499).json({ error: '操作已取消' });
      return;
    }
    logger.error(`Generate error: ${err.message}`);
    res.status(500).json({ error: 'AI撰写失败' });
  }
});

router.post('/continue', async (req: Request, res: Response) => {
  try {
    const parsed = continueRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const result = await writingService.continueWriting(parsed.data as unknown as ContinueRequest);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(499).json({ error: '操作已取消' });
      return;
    }
    logger.error(`Continue error: ${err.message}`);
    res.status(500).json({ error: 'AI续写失败' });
  }
});

router.post('/polish', async (req: Request, res: Response) => {
  try {
    const parsed = polishRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const result = await writingService.polish(parsed.data as unknown as PolishRequest);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(499).json({ error: '操作已取消' });
      return;
    }
    logger.error(`Polish error: ${err.message}`);
    res.status(500).json({ error: 'AI润色失败' });
  }
});

router.post('/expand', async (req: Request, res: Response) => {
  try {
    const parsed = expandRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const result = await writingService.expand(parsed.data as unknown as ExpandRequest);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(499).json({ error: '操作已取消' });
      return;
    }
    logger.error(`Expand error: ${err.message}`);
    res.status(500).json({ error: 'AI扩写失败' });
  }
});

router.post('/shorten', async (req: Request, res: Response) => {
  try {
    const parsed = shortenRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const result = await writingService.shorten(parsed.data as unknown as ShortenRequest);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(499).json({ error: '操作已取消' });
      return;
    }
    logger.error(`Shorten error: ${err.message}`);
    res.status(500).json({ error: 'AI缩写失败' });
  }
});

router.post('/rewrite', async (req: Request, res: Response) => {
  try {
    const parsed = rewriteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const result = await writingService.rewrite(parsed.data as unknown as RewriteRequest);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(499).json({ error: '操作已取消' });
      return;
    }
    logger.error(`Rewrite error: ${err.message}`);
    res.status(500).json({ error: 'AI改写失败' });
  }
});

router.post('/check-foreshadowing', async (req: Request, res: Response) => {
  try {
    const parsed = foreshadowCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const result = await writingService.checkForeshadowing(parsed.data as unknown as ForeshadowCheckRequest);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(499).json({ error: '操作已取消' });
      return;
    }
    logger.error(`Foreshadowing check error: ${err.message}`);
    res.status(500).json({ error: '伏笔检查失败' });
  }
});

// ============================================================
// Draft Management
// ============================================================

const DRAFTS_DIR = 'drafts';

async function readDraftFile(draftPath: string): Promise<DraftOutline | null> {
  try {
    const sandbox = getSandbox();
    const content = await sandbox.readFile(draftPath);
    return JSON.parse(content) as DraftOutline;
  } catch {
    return null;
  }
}

router.get('/drafts', async (_req: Request, res: Response) => {
  try {
    const sandbox = getSandbox();
    const files = await sandbox.listDir(DRAFTS_DIR);
    const jsonFiles = files.filter((f: string) => f.endsWith('.json'));

    const drafts: DraftOutline[] = [];
    for (const file of jsonFiles) {
      const draft = await readDraftFile(path.join(DRAFTS_DIR, file));
      if (draft) {
        drafts.push(draft);
      }
    }

    // Sort by updatedAt descending
    drafts.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    res.json({ drafts });
  } catch (err: any) {
    logger.error(`List drafts error: ${err.message}`);
    res.status(500).json({ error: '获取草稿列表失败' });
  }
});

router.post('/drafts', async (req: Request, res: Response) => {
  try {
    const parsed = createDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const sandbox = getSandbox();
    const now = new Date().toISOString();
    const id = randomUUID();

    const draft: DraftOutline = {
      id,
      title: parsed.data.title,
      targetChapter: parsed.data.targetChapter,
      outline: parsed.data.outline || '',
      draft: parsed.data.draft || '',
      priorKnowledge: parsed.data.priorKnowledge,
      createdAt: now,
      updatedAt: now,
    };

    await sandbox.writeFile(
      path.join(DRAFTS_DIR, `${id}.json`),
      JSON.stringify(draft, null, 2),
    );

    logger.info(`Draft created: id=${id}, title="${parsed.data.title}"`);
    res.status(201).json(draft);
  } catch (err: any) {
    logger.error(`Create draft error: ${err.message}`);
    res.status(500).json({ error: '创建草稿失败' });
  }
});

router.put('/drafts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = updateDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const filePath = path.join(DRAFTS_DIR, `${id}.json`);
    const sandbox = getSandbox();

    // Read existing draft
    let existing: DraftOutline;
    try {
      const content = await sandbox.readFile(filePath);
      existing = JSON.parse(content) as DraftOutline;
    } catch {
      res.status(404).json({ error: '草稿不存在' });
      return;
    }

    // Merge changes
    const updated: DraftOutline = {
      ...existing,
      ...parsed.data,
      id: existing.id, // Immutable
      createdAt: existing.createdAt, // Immutable
      updatedAt: new Date().toISOString(),
    };

    await sandbox.writeFile(filePath, JSON.stringify(updated, null, 2));

    logger.info(`Draft updated: id=${id}`);
    res.json(updated);
  } catch (err: any) {
    logger.error(`Update draft error: ${err.message}`);
    res.status(500).json({ error: '更新草稿失败' });
  }
});

router.delete('/drafts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sandbox = getSandbox();
    const filePath = path.join(DRAFTS_DIR, `${id}.json`);

    try {
      await sandbox.deleteFile(filePath);
    } catch {
      res.status(404).json({ error: '草稿不存在' });
      return;
    }

    logger.info(`Draft deleted: id=${id}`);
    res.json({ success: true });
  } catch (err: any) {
    logger.error(`Delete draft error: ${err.message}`);
    res.status(500).json({ error: '删除草稿失败' });
  }
});

export default router;
