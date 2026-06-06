// server/src/routes/knowledge-management.ts
// Knowledge management routes — CRUD, search, graph, export/import (PRD-04)

import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  browseEntries,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
  restoreEntry,
  emptyTrash,
  addRelation,
  removeRelation,
  getCategoryCounts,
  getTrashEntries,
  getVersionHistory,
  getRecentChanges,
  searchEntries,
  CATEGORIES,
} from '../services/knowledge-management';
import {
  buildGraph,
  getNodeWithRelations,
  getAllRelationTypes,
  addCustomRelationType,
  loadCustomRelationTypes,
} from '../services/graph';
import { exportKnowledge, importKnowledge } from '../services/export-import';
import {
  createEntrySchema,
  updateEntrySchema,
  addRelationSchema,
  browseQuerySchema,
  searchQuerySchema,
  graphQuerySchema,
  nodeGraphQuerySchema,
  exportBodySchema,
  addRelationTypeSchema,
} from '../types/knowledge';
import { createLogger } from '../utils/logger';

const logger = createLogger('routes-knowledge-mgmt');
const knowledgeManagementRouter = Router();

// Multer for file uploads (import)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Category display name mapping
const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

// ============================================================
// Browse & Search
// ============================================================

/**
 * GET /entries — Browse entries with pagination, filtering, and sorting
 */
knowledgeManagementRouter.get('/entries', async (req: Request, res: Response) => {
  try {
    const parsed = browseQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: '参数校验失败', details: parsed.error.issues });
      return;
    }

    const { category, page, size, sort } = parsed.data;
    const { entries, total } = await browseEntries(category || undefined, page, size, sort);
    const categoryCounts = await getCategoryCounts();

    res.json({
      entries,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
      categoryCounts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to browse entries:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /categories — Get category list with entry counts
 */
knowledgeManagementRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    const counts = await getCategoryCounts();
    const categories = CATEGORIES.map((key) => ({
      key,
      name: CATEGORY_NAMES[key] || key,
      count: counts[key] || 0,
    }));
    res.json({ categories });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to get categories:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /search — Full-text search with FTS5
 */
knowledgeManagementRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: '参数校验失败', details: parsed.error.issues });
      return;
    }

    const { q, category, page, size } = parsed.data;
    const results = searchEntries(q, category || undefined, page, size);
    res.json({ results, query: q, page, size });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to search:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /entries/:id — Get a single entry with full detail
 */
knowledgeManagementRouter.get('/entries/:id', async (req: Request, res: Response) => {
  try {
    const entry = await getEntryById(String(req.params.id));
    if (!entry) {
      res.status(404).json({ error: '条目不存在' });
      return;
    }
    res.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to get entry:', err);
    res.status(500).json({ error: message });
  }
});

// ============================================================
// CRUD
// ============================================================

/**
 * POST /entries — Create a new knowledge entry
 */
knowledgeManagementRouter.post('/entries', async (req: Request, res: Response) => {
  try {
    const parsed = createEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '参数校验失败', details: parsed.error.issues });
      return;
    }

    const entry = await createEntry(parsed.data);
    res.status(201).json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to create entry:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /entries/:id — Update an existing entry
 */
knowledgeManagementRouter.put('/entries/:id', async (req: Request, res: Response) => {
  try {
    const parsed = updateEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '参数校验失败', details: parsed.error.issues });
      return;
    }

    const entry = await updateEntry(String(req.params.id), parsed.data);
    if (!entry) {
      res.status(404).json({ error: '条目不存在' });
      return;
    }
    res.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to update entry:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /entries/:id — Soft-delete an entry (move to trash)
 */
knowledgeManagementRouter.delete('/entries/:id', async (req: Request, res: Response) => {
  try {
    const entry = await deleteEntry(String(req.params.id));
    if (!entry) {
      res.status(404).json({ error: '条目不存在或已在回收站' });
      return;
    }
    res.json({ message: '已移至回收站', entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to delete entry:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /entries/:id/relations — Add a relation to an entry
 */
knowledgeManagementRouter.post('/entries/:id/relations', async (req: Request, res: Response) => {
  try {
    const parsed = addRelationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '参数校验失败', details: parsed.error.issues });
      return;
    }

    const entry = await addRelation(String(req.params.id), parsed.data);
    if (!entry) {
      res.status(404).json({ error: '条目不存在' });
      return;
    }
    res.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to add relation:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /entries/:id/relations/:relationIndex — Remove a relation from an entry
 */
knowledgeManagementRouter.delete(
  '/entries/:id/relations/:relationIndex',
  async (req: Request, res: Response) => {
    try {
      const entry = await removeRelation(
        String(req.params.id),
        parseInt(String(req.params.relationIndex), 10),
      );
      if (!entry) {
        res.status(404).json({ error: '条目或关联不存在' });
        return;
      }
      res.json({ entry });
    } catch (err) {
      const message = err instanceof Error ? err.message : '内部错误';
      logger.error('Failed to remove relation:', err);
      res.status(500).json({ error: message });
    }
  },
);

// ============================================================
// Trash
// ============================================================

/**
 * GET /trash — List trashed entries
 */
knowledgeManagementRouter.get('/trash', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    const { entries, total } = await getTrashEntries(page, size);
    res.json({ entries, total, page, size, totalPages: Math.ceil(total / size) });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to get trash:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /trash/:id/restore — Restore an entry from trash
 */
knowledgeManagementRouter.post('/trash/:id/restore', async (req: Request, res: Response) => {
  try {
    const entry = await restoreEntry(String(req.params.id));
    if (!entry) {
      res.status(404).json({ error: '回收站中未找到该条目' });
      return;
    }
    res.json({ message: '已恢复', entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to restore entry:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /trash/empty — Permanently delete all trashed entries
 */
knowledgeManagementRouter.delete('/trash/empty', async (_req: Request, res: Response) => {
  try {
    const count = await emptyTrash();
    res.json({ message: `已清空回收站，永久删除 ${count} 个条目`, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to empty trash:', err);
    res.status(500).json({ error: message });
  }
});

// ============================================================
// Version History & Changes
// ============================================================

/**
 * GET /entries/:id/history — Get version history for an entry
 */
knowledgeManagementRouter.get('/entries/:id/history', async (req: Request, res: Response) => {
  try {
    const versions = await getVersionHistory(String(req.params.id));
    if (versions === null) {
      res.status(404).json({ error: '条目不存在' });
      return;
    }
    res.json({ versions });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to get version history:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /changes — Get recent changes feed
 */
knowledgeManagementRouter.get('/changes', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const changes = await getRecentChanges(limit);
    res.json({ changes });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to get recent changes:', err);
    res.status(500).json({ error: message });
  }
});

// ============================================================
// Graph
// ============================================================

// Load custom relation types on startup
loadCustomRelationTypes().catch((err) => logger.error('Failed to load relation types:', err));

/**
 * GET /graph — Get full graph data
 */
knowledgeManagementRouter.get('/graph', async (req: Request, res: Response) => {
  try {
    const parsed = graphQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: '参数校验失败', details: parsed.error.issues });
      return;
    }

    const categories = parsed.data.categories
      ? (parsed.data.categories as string).split(',').map((s: string) => s.trim())
      : undefined;
    const relationTypes = parsed.data.relationTypes
      ? (parsed.data.relationTypes as string).split(',').map((s: string) => s.trim())
      : undefined;

    const graph = await buildGraph({ categories, relationTypes });
    res.json(graph);
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to build graph:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /graph/node/:id — Get a node with N-degree relations
 */
knowledgeManagementRouter.get('/graph/node/:id', async (req: Request, res: Response) => {
  try {
    const parsed = nodeGraphQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: '参数校验失败', details: parsed.error.issues });
      return;
    }

    const graph = await getNodeWithRelations(String(req.params.id), parsed.data.depth);
    if (!graph) {
      res.status(404).json({ error: '节点不存在' });
      return;
    }
    res.json(graph);
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to get node graph:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /graph/relations — Get all relation type definitions
 */
knowledgeManagementRouter.get('/graph/relations', async (_req: Request, res: Response) => {
  try {
    const types = getAllRelationTypes();
    res.json({ types });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to get relation types:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /graph/relations — Add a custom relation type
 */
knowledgeManagementRouter.post('/graph/relations', async (req: Request, res: Response) => {
  try {
    const parsed = addRelationTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '参数校验失败', details: parsed.error.issues });
      return;
    }

    const types = await addCustomRelationType({
      ...parsed.data,
      isBuiltIn: false,
    });
    res.json({ types });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to add relation type:', err);
    res.status(500).json({ error: message });
  }
});

// ============================================================
// Export / Import
// ============================================================

/**
 * POST /export — Export knowledge base as ZIP
 */
knowledgeManagementRouter.post('/export', async (req: Request, res: Response) => {
  try {
    const parsed = exportBodySchema.safeParse(req.body);
    let categories: string[] | undefined;
    if (parsed.success && parsed.data.categories) {
      categories = parsed.data.categories;
    }
    await exportKnowledge(res, categories);
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to export:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * POST /import — Import knowledge base from ZIP
 */
knowledgeManagementRouter.post(
  '/import',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: '请上传ZIP文件' });
        return;
      }

      const result = await importKnowledge(req.file.buffer);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '内部错误';
      logger.error('Failed to import:', err);
      res.status(500).json({ error: message });
    }
  },
);

export default knowledgeManagementRouter;
