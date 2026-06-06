// server/src/routes/brainstorm.ts
// Brainstorm REST API routes for PRD-06
// Mounted at /api/v1/brainstorm/sessions

import { Router, Request, Response } from 'express';
import * as sessionService from '../services/brainstorm-sessions';
import { sendBrainstormMessage, extractConclusions } from '../agents/brainstorm';
import { createSetting } from '../services/settings';
import {
  createSessionSchema,
  sendMessageSchema,
  convertDecisionsSchema,
} from '../types/knowledge';
import type { ChatMessage } from '../types/knowledge';
import { createLogger } from '../utils/logger';

const logger = createLogger('routes-brainstorm');
const brainstormRouter = Router();

function generateMessageId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// GET /api/v1/brainstorm/sessions — list all sessions
brainstormRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const sessions = await sessionService.listSessions();
    res.json(sessions);
  } catch (err) {
    logger.error('Failed to list brainstorm sessions:', err);
    res.status(500).json({ error: '获取会话列表失败' });
  }
});

// POST /api/v1/brainstorm/sessions — create a new session
brainstormRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数校验失败', details: parsed.error.errors });
    return;
  }

  try {
    const content = await sessionService.createSession(parsed.data.title);
    res.status(201).json(content);
  } catch (err) {
    logger.error('Failed to create brainstorm session:', err);
    res.status(500).json({ error: '创建会话失败' });
  }
});

// GET /api/v1/brainstorm/sessions/:id — get session content
brainstormRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const content = await sessionService.getSessionContent(String(req.params.id));
    if (!content) {
      res.status(404).json({ error: '会话不存在' });
      return;
    }
    res.json(content);
  } catch (err) {
    logger.error('Failed to get session:', err);
    res.status(500).json({ error: '获取会话内容失败' });
  }
});

// DELETE /api/v1/brainstorm/sessions/:id — delete a session
brainstormRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await sessionService.deleteSession(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: '会话不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete session:', err);
    res.status(500).json({ error: '删除会话失败' });
  }
});

// POST /api/v1/brainstorm/sessions/:id/message — send a message and get AI reply
brainstormRouter.post('/:id/message', async (req: Request, res: Response) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数校验失败', details: parsed.error.errors });
    return;
  }

  try {
    const sessionId = String(req.params.id);
    const content = await sessionService.getSessionContent(sessionId);
    if (!content) {
      res.status(404).json({ error: '会话不存在' });
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: parsed.data.message,
      references: (parsed.data.references || []).map((id: string) => ({
        knowledgeId: id,
        knowledgeName: '',
        category: '',
      })),
      timestamp: new Date().toISOString(),
    };
    content.messages.push(userMsg);

    // Get AI reply
    const reply = await sendBrainstormMessage({
      conversationHistory: content.messages,
      referenceIds: parsed.data.references || [],
    });

    // Add assistant message
    const assistantMsg: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: reply.reply,
      references: reply.references.map((r) => ({
        knowledgeId: r.knowledgeId,
        knowledgeName: r.knowledgeName,
        category: r.category,
      })),
      timestamp: new Date().toISOString(),
    };
    content.messages.push(assistantMsg);

    // Save session
    await sessionService.appendMessage(sessionId, userMsg);
    await sessionService.appendMessage(sessionId, assistantMsg);

    res.json({ userMessage: userMsg, reply });
  } catch (err) {
    logger.error('Failed to send brainstorm message:', err);
    res.status(500).json({ error: '发送消息失败' });
  }
});

// POST /api/v1/brainstorm/sessions/:id/extract — extract conclusions
brainstormRouter.post('/:id/extract', async (req: Request, res: Response) => {
  try {
    const content = await sessionService.getSessionContent(String(req.params.id));
    if (!content) {
      res.status(404).json({ error: '会话不存在' });
      return;
    }

    const conclusions = await extractConclusions(content.messages);
    res.json(conclusions);
  } catch (err) {
    logger.error('Failed to extract conclusions:', err);
    res.status(500).json({ error: '提取结论失败' });
  }
});

// POST /api/v1/brainstorm/sessions/:id/convert — convert decisions to settings
brainstormRouter.post('/:id/convert', async (req: Request, res: Response) => {
  const parsed = convertDecisionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数校验失败', details: parsed.error.errors });
    return;
  }

  try {
    const content = await sessionService.getSessionContent(String(req.params.id));
    if (!content) {
      res.status(404).json({ error: '会话不存在' });
      return;
    }

    const conclusions = await extractConclusions(content.messages);
    const settingIds: string[] = [];

    for (const decisionText of parsed.data.decisions) {
      const match = conclusions.suggestedSettings.find(
        (s) => s.content?.includes(decisionText.slice(0, 30)),
      );

      if (match) {
        try {
          const setting = await createSetting({
            title: match.title,
            category: match.category as import('../types/knowledge').SettingCategory,
            content: match.content || decisionText,
          });
          settingIds.push(setting.id);
        } catch (err) {
          logger.error('Failed to create setting from decision:', err);
        }
      }
    }

    res.json({ settingIds });
  } catch (err) {
    logger.error('Failed to convert decisions:', err);
    res.status(500).json({ error: '转换设定失败' });
  }
});

export default brainstormRouter;
