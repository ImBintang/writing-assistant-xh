// client/src/services/brainstorm.ts
// API functions for Brainstorm endpoints (PRD-06)

import { api } from './api';

// --- Types ---

export interface BrainstormSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Array<{
    knowledgeId: string;
    knowledgeName: string;
    category: string;
  }>;
  timestamp: string;
  pinned?: boolean;
}

export interface BrainstormSessionContent {
  session: BrainstormSession;
  messages: ChatMessage[];
}

export interface BrainstormReply {
  reply: string;
  references: Array<{
    knowledgeId: string;
    knowledgeName: string;
    category: string;
    excerpt: string;
  }>;
}

export interface ExtractedConclusions {
  summary: string;
  decisions: Array<{
    text: string;
    category: string;
    confidence: number;
  }>;
  suggestedSettings: Array<{
    category: string;
    title: string;
    content: string;
  }>;
}

// --- API functions ---

export async function fetchSessions(): Promise<BrainstormSession[]> {
  const response = await api.get<BrainstormSession[]>('/api/v1/brainstorm/sessions');
  return response.data;
}

export async function createSession(title?: string): Promise<BrainstormSessionContent> {
  const response = await api.post<BrainstormSessionContent>(
    '/api/v1/brainstorm/sessions',
    { title },
  );
  return response.data;
}

export async function fetchSessionContent(
  id: string,
): Promise<BrainstormSessionContent> {
  const response = await api.get<BrainstormSessionContent>(
    `/api/v1/brainstorm/sessions/${encodeURIComponent(id)}`,
  );
  return response.data;
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/api/v1/brainstorm/sessions/${encodeURIComponent(id)}`);
}

export async function sendMessage(
  id: string,
  data: { message: string; references?: string[] },
): Promise<{ userMessage: ChatMessage; reply: BrainstormReply }> {
  const response = await api.post<{
    userMessage: ChatMessage;
    reply: BrainstormReply;
  }>(`/api/v1/brainstorm/sessions/${encodeURIComponent(id)}/message`, data);
  return response.data;
}

export async function extractConclusions(
  id: string,
): Promise<ExtractedConclusions> {
  const response = await api.post<ExtractedConclusions>(
    `/api/v1/brainstorm/sessions/${encodeURIComponent(id)}/extract`,
    {},
  );
  return response.data;
}

export async function convertDecisions(
  id: string,
  decisions: string[],
): Promise<{ settingIds: string[] }> {
  const response = await api.post<{ settingIds: string[] }>(
    `/api/v1/brainstorm/sessions/${encodeURIComponent(id)}/convert`,
    { decisions },
  );
  return response.data;
}
