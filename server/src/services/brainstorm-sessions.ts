// server/src/services/brainstorm-sessions.ts
// Brainstorm session management service for PRD-06
// Manages session .md files in workspace/settings/brainstorm/

import { createLogger } from '../utils/logger';
import { readFile, writeFile, deleteFile, listDir } from '../utils/file';
import type { BrainstormSession, BrainstormSessionContent, ChatMessage } from '../types/knowledge';

const logger = createLogger('brainstorm-sessions');

const SESSIONS_DIR = 'settings/brainstorm';

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `bs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique message ID.
 */
function generateMessageId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Save a session to disk as a .md file.
 */
async function saveSession(session: BrainstormSession, messages: ChatMessage[]): Promise<void> {
  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push(`id: ${session.id}`);
  lines.push(`title: ${session.title}`);
  lines.push(`createdAt: ${session.createdAt}`);
  lines.push(`updatedAt: ${session.updatedAt}`);
  lines.push('---');
  lines.push('');

  // Messages
  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? '用户' : '助手';
    const pinMarker = msg.pinned ? ' [pinned]' : '';
    const refText = msg.references && msg.references.length > 0
      ? `\n[@mentions: ${msg.references.map((r) => r.knowledgeId).join(', ')}]`
      : '';

    lines.push(`## ${roleLabel} — ${msg.timestamp}${pinMarker}`);
    lines.push(refText || '');
    lines.push(msg.content);
    lines.push('');
  }

  const filePath = `${SESSIONS_DIR}/${session.id}.md`;
  await writeFile(filePath, lines.join('\n'));
}

/**
 * Parse a session .md file into structured data.
 */
async function parseSessionFile(filename: string): Promise<BrainstormSessionContent | null> {
  try {
    const filePath = `${SESSIONS_DIR}/${filename}`;
    const raw = await readFile(filePath);

    // Parse frontmatter
    const lines = raw.split('\n');
    const frontmatter: Record<string, string> = {};
    let fmEnd = -1;

    if (lines[0]?.trim() === '---') {
      for (let i = 1; i < Math.min(lines.length, 30); i++) {
        if (lines[i].trim() === '---') {
          fmEnd = i;
          break;
        }
        const match = lines[i].match(/^(\w+):\s*(.*)$/);
        if (match) {
          frontmatter[match[1]] = match[2].trim();
        }
      }
    }

    const session: BrainstormSession = {
      id: frontmatter.id || filename.replace('.md', ''),
      title: frontmatter.title || '未命名会话',
      createdAt: frontmatter.createdAt || new Date().toISOString(),
      updatedAt: frontmatter.updatedAt || new Date().toISOString(),
      messageCount: 0,
    };

    // Parse messages
    const messages: ChatMessage[] = [];
    let currentMessage: {
      role: 'user' | 'assistant';
      timestamp: string;
      content: string;
      references: Array<{ knowledgeId: string; knowledgeName: string; category: string }>;
      pinned: boolean;
    } | null = null;

    for (let i = fmEnd + 1; i < lines.length; i++) {
      const line = lines[i];

      // Match message header: ## 用户/助手 — timestamp [pinned]
      const headerMatch = line.match(/^##\s+(用户|助手)\s*[—\-]\s*(.+)$/);
      if (headerMatch) {
        // Save previous message
        if (currentMessage) {
          messages.push({
            id: generateMessageId(),
            role: currentMessage.role,
            content: currentMessage.content.trim(),
            references: currentMessage.references.length > 0 ? currentMessage.references : undefined,
            timestamp: currentMessage.timestamp,
            pinned: currentMessage.pinned || undefined,
          });
        }

        const roleText = headerMatch[1];
        const tsAndPin = headerMatch[2].trim();
        const pinned = tsAndPin.includes('[pinned]');
        const timestamp = tsAndPin.replace(/\s*\[pinned\]/, '').trim();

        currentMessage = {
          role: roleText === '用户' ? 'user' : 'assistant',
          timestamp,
          content: '',
          references: [],
          pinned,
        };
        continue;
      }

      // Match @mentions line
      const mentionsMatch = line.match(/^\[@mentions:\s*(.+)\]$/);
      if (mentionsMatch && currentMessage) {
        const ids = mentionsMatch[1].split(',').map((s) => s.trim());
        currentMessage.references = ids.map((id) => ({
          knowledgeId: id,
          knowledgeName: '',
          category: '',
        }));
        continue;
      }

      // Skip [references: ...] lines (assistant replies with citations)
      if (line.match(/^\[references:/)) {
        continue;
      }

      // Accumulate content
      if (currentMessage) {
        currentMessage.content += (currentMessage.content ? '\n' : '') + line;
      }
    }

    // Save last message
    if (currentMessage) {
      messages.push({
        id: generateMessageId(),
        role: currentMessage.role,
        content: currentMessage.content.trim(),
        references: currentMessage.references.length > 0 ? currentMessage.references : undefined,
        timestamp: currentMessage.timestamp,
        pinned: currentMessage.pinned || undefined,
      });
    }

    session.messageCount = messages.length;

    return { session, messages };
  } catch (err) {
    logger.error(`Failed to parse session file ${filename}:`, err);
    return null;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * List all brainstorm sessions.
 */
export async function listSessions(): Promise<BrainstormSession[]> {
  const sessions: BrainstormSession[] = [];

  try {
    const files = await listDir(SESSIONS_DIR);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await parseSessionFile(file);
      if (content) {
        sessions.push(content.session);
      }
    }
  } catch {
    // Directory may not exist yet
  }

  sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return sessions;
}

/**
 * Create a new brainstorm session.
 */
export async function createSession(title?: string): Promise<BrainstormSessionContent> {
  const session: BrainstormSession = {
    id: generateSessionId(),
    title: title || `头脑风暴 ${new Date().toLocaleDateString('zh-CN')}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
  };

  const messages: ChatMessage[] = [];

  await saveSession(session, messages);
  logger.info(`Created brainstorm session: "${session.title}" (${session.id})`);

  return { session, messages };
}

/**
 * Get a session with all messages.
 */
export async function getSessionContent(id: string): Promise<BrainstormSessionContent | null> {
  const filename = `${id}.md`;
  return parseSessionFile(filename);
}

/**
 * Delete a session and its file.
 */
export async function deleteSession(id: string): Promise<boolean> {
  try {
    const filePath = `${SESSIONS_DIR}/${id}.md`;
    await deleteFile(filePath);
    logger.info(`Deleted brainstorm session: ${id}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Append a message to a session.
 */
export async function appendMessage(
  sessionId: string,
  message: ChatMessage,
): Promise<BrainstormSessionContent | null> {
  const content = await getSessionContent(sessionId);
  if (!content) return null;

  content.messages.push(message);
  content.session.messageCount = content.messages.length;
  content.session.updatedAt = new Date().toISOString();

  await saveSession(content.session, content.messages);

  return content;
}

/**
 * Toggle the pinned state of a message.
 */
export async function togglePin(
  sessionId: string,
  messageId: string,
  pinned: boolean,
): Promise<BrainstormSessionContent | null> {
  const content = await getSessionContent(sessionId);
  if (!content) return null;

  const msg = content.messages.find((m) => m.id === messageId);
  if (!msg) return null;

  msg.pinned = pinned;
  content.session.updatedAt = new Date().toISOString();

  await saveSession(content.session, content.messages);

  return content;
}

/**
 * Rename a session.
 */
export async function renameSession(
  id: string,
  newTitle: string,
): Promise<BrainstormSession | null> {
  const content = await getSessionContent(id);
  if (!content) return null;

  content.session.title = newTitle;
  content.session.updatedAt = new Date().toISOString();

  await saveSession(content.session, content.messages);

  return content.session;
}
