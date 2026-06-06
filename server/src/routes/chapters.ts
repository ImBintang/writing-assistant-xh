// server/src/routes/chapters.ts

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { getSandbox } from '../sandbox';
import { createLogger } from '../utils/logger';
import { uploadMiddleware, normalizeMulterError } from '../middleware/upload';
import { splitChapters, validateChapters } from '../services/splitter';

const logger = createLogger('chapters');
const router = Router();

// ==============================================================================
// Helpers
// ==============================================================================

function computeHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-]/g, '_');
}

async function loadMeta(): Promise<any | null> {
  const sandbox = getSandbox();
  const exists = await sandbox.fileExists('chapters/_meta.json');
  if (!exists) return null;
  const raw = await sandbox.readFile('chapters/_meta.json');
  return JSON.parse(raw);
}

async function saveMeta(meta: any): Promise<void> {
  const sandbox = getSandbox();
  meta.updatedAt = new Date().toISOString();
  await sandbox.writeFile('chapters/_meta.json', JSON.stringify(meta, null, 2));
}

function normalizePath(...segments: string[]): string {
  // Join and replace backslashes with forward slashes for cross-platform safety
  return path.join(...segments).replace(/\\/g, '/');
}

// GET /anomalies — must come before /:id
router.get('/anomalies', async (_req: Request, res: Response) => {
  try {
    const meta = await loadMeta();
    if (!meta) {
      res.json({ anomalies: [], total: 0 });
      return;
    }

    const anomalies = meta.anomalies || [];
    res.json({ anomalies, total: anomalies.length });
  } catch (err: any) {
    logger.error(`Failed to get anomalies: ${err.message}`);
    res.status(500).json({ error: '获取异常列表失败' });
  }
});

// POST /upload
router.post(
  '/upload',
  uploadMiddleware,
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: '请选择要上传的 .txt 文件' });
        return;
      }

      // Normalize multer errors that Express didn't catch
      if ((req as any).__multerError) {
        normalizeMulterError((req as any).__multerError);
      }

      const sandbox = getSandbox();
      const fileHash = computeHash(file.buffer);

      // Check for duplicate by hash
      const existingMeta = await loadMeta();
      if (existingMeta && existingMeta.sourceHash === fileHash) {
        res.status(409).json({
          error: '该文件已上传过',
          existingSourceId: existingMeta.sourceId,
        });
        return;
      }

      // Sanitize filename and prepend hash prefix
      const safeName = sanitizeFilename(file.originalname);
      const storedName = `${fileHash.slice(0, 8)}_${safeName}`;
      const originalPath = normalizePath('originals', storedName);

      // Save original file to workspace/originals/
      await sandbox.writeFile(originalPath, file.buffer.toString('utf-8'));

      logger.info(`File saved: ${storedName} (${file.size} bytes)`);

      // Prepare paths for the Python splitter
      const sandboxRoot = sandbox.getRoot();
      const absoluteFilePath = path.join(sandboxRoot, originalPath);
      const absoluteChaptersDir = path.join(sandboxRoot, 'chapters');

      // Step 1: Split chapters
      let meta;
      try {
        meta = await splitChapters(
          absoluteFilePath,
          absoluteChaptersDir,
          storedName,
        );
      } catch (splitErr: any) {
        // Clean up original file on split failure
        try { await sandbox.deleteFile(originalPath); } catch { /* ignore */ }
        logger.error(`Split failed: ${splitErr.message}`);
        res.status(500).json({ error: `章节拆分失败: ${splitErr.message}` });
        return;
      }

      // Step 2: Validate (detect anomalies)
      const metaPath = path.join(absoluteChaptersDir, '_meta.json');
      try {
        meta = await validateChapters(metaPath);
      } catch (valErr: any) {
        logger.warn(`Validation failed (non-fatal): ${valErr.message}`);
        // Continue — splitting succeeded, validation is advisory
      }

      // Step 3: Add timestamps and save final meta
      const now = new Date().toISOString();
      meta.sourceFile = storedName;
      meta.sourceHash = fileHash;
      meta.sourceId = fileHash.slice(0, 8);
      meta.createdAt = now;
      meta.updatedAt = now;
      meta.status = 'pending';

      await saveMeta(meta);

      res.json({
        sourceId: meta.sourceId,
        sourceFile: storedName,
        totalChapters: meta.totalChapters,
        anomalies: meta.anomalies || [],
      });
    } catch (err: any) {
      logger.error(`Upload error: ${err.message}`);
      if (err.code === 'LIMIT_FILE_SIZE' || err.statusCode === 413) {
        res.status(413).json({ error: '文件大小超过限制（最大 50MB）' });
        return;
      }
      res.status(500).json({ error: `上传失败: ${err.message}` });
    }
  },
);

// POST /merge
router.post('/merge', async (req: Request, res: Response) => {
  try {
    const { chapterIds } = req.body as { chapterIds: number[] };

    if (!chapterIds || !Array.isArray(chapterIds) || chapterIds.length < 2) {
      res.status(400).json({ error: '请提供至少两个要合并的章节序号' });
      return;
    }

    // Sort and validate adjacency
    const sorted = [...chapterIds].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        res.status(400).json({
          error: `章节必须相邻才能合并（${sorted[i - 1]} 和 ${sorted[i]} 不连续）`,
        });
        return;
      }
    }

    const meta = await loadMeta();
    if (!meta) {
      res.status(404).json({ error: '未找到拆分结果，请先上传文件' });
      return;
    }

    const sandbox = getSandbox();

    // Read and concatenate all selected chapters
    let mergedContent = '';
    const chaptersToMerge = meta.chapters.filter((ch: any) =>
      sorted.includes(ch.index),
    );

    if (chaptersToMerge.length !== sorted.length) {
      res.status(400).json({ error: '部分章节序号不存在' });
      return;
    }

    for (const ch of chaptersToMerge.sort((a: any, b: any) => a.index - b.index)) {
      const content = await sandbox.readFile(
        normalizePath('chapters', ch.fileName),
      );
      mergedContent += content;
    }

    // Write merged content to the first chapter's slot
    const firstChapter = chaptersToMerge[0];
    await sandbox.writeFile(
      normalizePath('chapters', firstChapter.fileName),
      mergedContent,
    );

    // Remove the merged-away chapter files
    for (const ch of chaptersToMerge.slice(1)) {
      try {
        await sandbox.deleteFile(normalizePath('chapters', ch.fileName));
      } catch { /* file may not exist */ }
    }

    // Build merged title
    const mergedTitle = `${chaptersToMerge[0].title} ~ ${chaptersToMerge[chaptersToMerge.length - 1].title}`;

    // Update chapter record
    firstChapter.title = mergedTitle;
    firstChapter.charCount = mergedContent.length;
    firstChapter.lineEnd = chaptersToMerge[chaptersToMerge.length - 1].lineEnd;

    // Remove merged chapters from meta and renumber
    const removeIndices = new Set(sorted.slice(1));

    meta.chapters = meta.chapters.filter(
      (ch: any) => !removeIndices.has(ch.index),
    );

    // Renumber: chapters after the merge point get shifted
    const offset = sorted.length - 1;
    for (const ch of meta.chapters) {
      if (ch.index > sorted[sorted.length - 1]) {
        ch.index -= offset;
        ch.fileName = `chapter_${String(ch.index).padStart(3, '0')}.txt`;

        // Rename the file on disk (read old, write new, delete old)
        try {
          const oldFileName = `chapter_${String(ch.index + offset).padStart(3, '0')}.txt`;
          const oldContent = await sandbox.readFile(
            normalizePath('chapters', oldFileName),
          );
          await sandbox.writeFile(
            normalizePath('chapters', ch.fileName),
            oldContent,
          );
          await sandbox.deleteFile(normalizePath('chapters', oldFileName));
        } catch { /* skip rename if it fails */ }
      }
    }

    meta.totalChapters = meta.chapters.length;
    meta.anomalies = (meta.anomalies || []).filter(
      (a: any) => !removeIndices.has(a.chapterIndex),
    );

    await saveMeta(meta);

    res.json(meta.chapters.find((ch: any) => ch.index === firstChapter.index));
  } catch (err: any) {
    logger.error(`Merge error: ${err.message}`);
    res.status(500).json({ error: `合并失败: ${err.message}` });
  }
});

// POST /split
router.post('/split', async (req: Request, res: Response) => {
  try {
    const { chapterId, splitAtLine } = req.body as {
      chapterId: number;
      splitAtLine: number;
    };

    if (!chapterId || !splitAtLine || splitAtLine < 1) {
      res.status(400).json({ error: '请提供有效的章节序号和切分行号' });
      return;
    }

    const meta = await loadMeta();
    if (!meta) {
      res.status(404).json({ error: '未找到拆分结果，请先上传文件' });
      return;
    }

    const chapter = meta.chapters.find(
      (ch: any) => ch.index === chapterId,
    );
    if (!chapter) {
      res.status(404).json({ error: `未找到第 ${chapterId} 章` });
      return;
    }

    const sandbox = getSandbox();
    const content = await sandbox.readFile(
      normalizePath('chapters', chapter.fileName),
    );

    const lines = content.split('\n');
    if (splitAtLine >= lines.length) {
      res.status(400).json({ error: '切分行号超出章节范围' });
      return;
    }

    const part1Lines = lines.slice(0, splitAtLine);
    const part2Lines = lines.slice(splitAtLine);

    const content1 = part1Lines.join('\n');
    const content2 = part2Lines.join('\n');

    // Generate title for new (second) part
    const title1 = `${chapter.title}（上）`;
    const title2 = `${chapter.title}（下）`;

    // Shift all subsequent chapters by +1
    const offset = 1;
    for (const ch of meta.chapters) {
      if (ch.index > chapterId) {
        const oldName = ch.fileName;
        ch.index += offset;
        ch.fileName = `chapter_${String(ch.index).padStart(3, '0')}.txt`;
        // Rename on disk
        try {
          const contentCh = await sandbox.readFile(
            normalizePath('chapters', oldName),
          );
          await sandbox.writeFile(
            normalizePath('chapters', ch.fileName),
            contentCh,
          );
          await sandbox.deleteFile(normalizePath('chapters', oldName));
        } catch { /* skip */ }
      }
    }

    // Write both parts
    const newFile1 = `chapter_${String(chapterId).padStart(3, '0')}.txt`;
    const newFile2 = `chapter_${String(chapterId + 1).padStart(3, '0')}.txt`;

    await sandbox.writeFile(normalizePath('chapters', newFile1), content1);
    await sandbox.writeFile(normalizePath('chapters', newFile2), content2);

    // Update the original chapter record
    chapter.title = title1;
    chapter.charCount = content1.length;
    chapter.fileName = newFile1;

    // Insert the new second chapter
    const newChapter = {
      index: chapterId + 1,
      title: title2,
      fileName: newFile2,
      lineStart: chapter.lineStart + splitAtLine,
      lineEnd: chapter.lineEnd,
      charCount: content2.length,
      type: chapter.type || 'chapter',
    };

    meta.chapters.push(newChapter);
    meta.chapters.sort((a: any, b: any) => a.index - b.index);
    meta.totalChapters = meta.chapters.length;

    // Re-index anomalies
    for (const a of meta.anomalies || []) {
      if (a.chapterIndex > chapterId) {
        a.chapterIndex += 1;
      }
    }

    await saveMeta(meta);

    res.json([chapter, newChapter]);
  } catch (err: any) {
    logger.error(`Split error: ${err.message}`);
    res.status(500).json({ error: `拆分失败: ${err.message}` });
  }
});

// POST /confirm
router.post('/confirm', async (_req: Request, res: Response) => {
  try {
    const meta = await loadMeta();
    if (!meta) {
      res.status(404).json({ error: '未找到拆分结果，请先上传文件' });
      return;
    }

    meta.status = 'confirmed';
    await saveMeta(meta);

    logger.info('Chapter split confirmed');
    res.json({ status: 'confirmed' });
  } catch (err: any) {
    logger.error(`Confirm error: ${err.message}`);
    res.status(500).json({ error: `确认失败: ${err.message}` });
  }
});

// GET / — chapter list
router.get('/', async (req: Request, res: Response) => {
  try {
    const meta = await loadMeta();
    if (!meta) {
      res.json({ chapters: [], total: 0, status: 'empty', sourceFile: null });
      return;
    }

    let { chapters } = meta;
    const statusFilter = req.query.status as string | undefined;

    if (statusFilter === 'anomaly') {
      const anomalyIndices = new Set(
        (meta.anomalies || []).map((a: any) => a.chapterIndex),
      );
      chapters = chapters.filter((ch: any) => anomalyIndices.has(ch.index));
    }

    res.json({
      chapters,
      total: chapters.length,
      status: meta.status,
      sourceFile: meta.sourceFile,
    });
  } catch (err: any) {
    logger.error(`List chapters error: ${err.message}`);
    res.status(500).json({ error: '获取章节列表失败' });
  }
});

// GET /:id — chapter detail (must come after all specific GET routes)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的章节序号' });
      return;
    }

    const meta = await loadMeta();
    if (!meta) {
      res.status(404).json({ error: '未找到拆分结果' });
      return;
    }

    const chapter = meta.chapters.find((ch: any) => ch.index === id);
    if (!chapter) {
      res.status(404).json({ error: `未找到第 ${id} 章` });
      return;
    }

    const sandbox = getSandbox();
    const content = await sandbox.readFile(
      normalizePath('chapters', chapter.fileName),
    );

    res.json({ meta: chapter, content });
  } catch (err: any) {
    logger.error(`Get chapter error: ${err.message}`);
    res.status(500).json({ error: '获取章节内容失败' });
  }
});

// GET /:id/raw — raw chapter content with surrounding context
router.get('/:id/raw', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的章节序号' });
      return;
    }

    const meta = await loadMeta();
    if (!meta) {
      res.status(404).json({ error: '未找到拆分结果' });
      return;
    }

    const chapter = meta.chapters.find((ch: any) => ch.index === id);
    if (!chapter) {
      res.status(404).json({ error: `未找到第 ${id} 章` });
      return;
    }

    // Try to read from the original file for context
    const sandbox = getSandbox();
    try {
      // The original file name is in sourceFile
      const sourceFile = meta.sourceFile;
      if (!sourceFile) {
        res.json({ content: '', note: '原始文件信息缺失' });
        return;
      }

      const fullText = await sandbox.readFile(
        normalizePath('originals', sourceFile),
      );
      const lines = fullText.split('\n');

      // Get lines around the chapter boundary (20 lines of context)
      const contextBefore = Math.max(0, chapter.lineStart - 1 - 10);
      const contextAfter = Math.min(lines.length, chapter.lineEnd + 10);

      const rawSegment = lines
        .slice(contextBefore, contextAfter)
        .map((line, i) => {
          const lineNum = contextBefore + i + 1;
          const marker =
            lineNum === chapter.lineStart
              ? ' >>>> CHAPTER START >>>>'
              : lineNum === chapter.lineEnd
                ? ' <<<< CHAPTER END <<<<'
                : '';
          return `${String(lineNum).padStart(6, ' ')} | ${line}${marker}`;
        })
        .join('\n');

      res.json({
        content: rawSegment,
        contextStart: contextBefore + 1,
        contextEnd: contextAfter,
        chapterStart: chapter.lineStart,
        chapterEnd: chapter.lineEnd,
      });
    } catch {
      // Fall back to just the chapter content
      const content = await sandbox.readFile(
        normalizePath('chapters', chapter.fileName),
      );
      res.json({
        content,
        note: '原始文件不可用，仅显示章节内容',
      });
    }
  } catch (err: any) {
    logger.error(`Get raw chapter error: ${err.message}`);
    res.status(500).json({ error: '获取原始段落失败' });
  }
});

// PUT /:id — update chapter
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: '无效的章节序号' });
      return;
    }

    const { title, content } = req.body as {
      title?: string;
      content?: string;
    };

    if (!title && content === undefined) {
      res.status(400).json({ error: '请提供要更新的标题或内容' });
      return;
    }

    const meta = await loadMeta();
    if (!meta) {
      res.status(404).json({ error: '未找到拆分结果' });
      return;
    }

    const chapter = meta.chapters.find((ch: any) => ch.index === id);
    if (!chapter) {
      res.status(404).json({ error: `未找到第 ${id} 章` });
      return;
    }

    const sandbox = getSandbox();

    if (content !== undefined) {
      await sandbox.writeFile(
        normalizePath('chapters', chapter.fileName),
        content,
      );
      chapter.charCount = content.length;
    }

    if (title !== undefined) {
      chapter.title = title;
    }

    await saveMeta(meta);

    res.json(chapter);
  } catch (err: any) {
    logger.error(`Update chapter error: ${err.message}`);
    res.status(500).json({ error: `更新失败: ${err.message}` });
  }
});

export default router;
