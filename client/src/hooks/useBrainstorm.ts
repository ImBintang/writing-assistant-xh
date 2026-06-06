// client/src/hooks/useBrainstorm.ts
// Zustand store for Brainstorm page (PRD-06)

import { create } from 'zustand';
import * as brainstormApi from '../services/brainstorm';
import type {
  BrainstormSession,
  ChatMessage,
  ExtractedConclusions,
} from '../services/brainstorm';

export type {
  BrainstormSession,
  ChatMessage,
} from '../services/brainstorm';

interface BrainstormState {
  // Data
  sessions: BrainstormSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  session: BrainstormSession | null;
  sessionsLoading: boolean;

  // Chat
  sendingMessage: boolean;
  error: string | null;

  // Conclusions
  conclusions: ExtractedConclusions | null;
  showConclusionPanel: boolean;
  extracting: boolean;

  // UI
  showSessionList: boolean;
  inputValue: string;

  // Actions
  loadSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<BrainstormSession | null>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (message: string, references?: string[]) => Promise<void>;
  togglePin: (messageId: string) => Promise<void>;
  extractConclusions: () => Promise<void>;
  convertDecisionsToSettings: (decisions: string[]) => Promise<string[]>;
  setInputValue: (value: string) => void;
  toggleSessionList: () => void;
  toggleConclusionPanel: () => void;
}

export const useBrainstorm = create<BrainstormState>((set, get) => ({
  // Initial state
  sessions: [],
  currentSessionId: null,
  messages: [],
  session: null,
  sessionsLoading: false,
  sendingMessage: false,
  error: null,
  conclusions: null,
  showConclusionPanel: false,
  extracting: false,
  showSessionList: true,
  inputValue: '',

  // Load sessions list
  loadSessions: async () => {
    set({ sessionsLoading: true });
    try {
      const sessions = await brainstormApi.fetchSessions();
      set({ sessions, sessionsLoading: false });
    } catch (err) {
      console.error('Failed to load brainstorm sessions:', err);
      set({ sessionsLoading: false });
    }
  },

  // Create new session
  createSession: async (title) => {
    try {
      const content = await brainstormApi.createSession(title);
      const { sessions } = get();
      set({
        sessions: [content.session, ...sessions],
        currentSessionId: content.session.id,
        session: content.session,
        messages: content.messages,
        showSessionList: false,
        conclusions: null,
      });
      return content.session;
    } catch (err) {
      console.error('Failed to create brainstorm session:', err);
      return null;
    }
  },

  // Select and load a session
  selectSession: async (id) => {
    try {
      const content = await brainstormApi.fetchSessionContent(id);
      set({
        currentSessionId: id,
        session: content.session,
        messages: content.messages,
        showSessionList: false,
        conclusions: null,
      });
    } catch (err) {
      console.error('Failed to load session content:', err);
    }
  },

  // Delete a session
  deleteSession: async (id) => {
    try {
      await brainstormApi.deleteSession(id);
      const { sessions, currentSessionId } = get();
      set({
        sessions: sessions.filter((s) => s.id !== id),
        currentSessionId: currentSessionId === id ? null : currentSessionId,
        messages: currentSessionId === id ? [] : get().messages,
        session: currentSessionId === id ? null : get().session,
      });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  },

  // Send a message and get AI reply
  sendMessage: async (message, references) => {
    const { currentSessionId, messages, session } = get();
    if (!currentSessionId) return;

    set({ sendingMessage: true, error: null });

    try {
      const result = await brainstormApi.sendMessage(currentSessionId, {
        message,
        references,
      });

      const newMessages = [...messages, result.userMessage];

      // Optimistically add AI response
      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now().toString(36)}`,
        role: 'assistant',
        content: result.reply.reply,
        references: result.reply.references.map((r) => ({
          knowledgeId: r.knowledgeId,
          knowledgeName: r.knowledgeName,
          category: r.category,
        })),
        timestamp: new Date().toISOString(),
      };
      newMessages.push(aiMsg);

      set({
        messages: newMessages,
        session: session
          ? { ...session, messageCount: newMessages.length, updatedAt: new Date().toISOString() }
          : null,
        sendingMessage: false,
        inputValue: '',
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      set({ error: '发送消息失败', sendingMessage: false });
    }
  },

  // Toggle pin on a message
  togglePin: async (messageId) => {
    const { currentSessionId, messages } = get();
    if (!currentSessionId) return;

    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    // Optimistic update
    const updatedMessages = messages.map((m) =>
      m.id === messageId ? { ...m, pinned: !m.pinned } : m,
    );
    set({ messages: updatedMessages });

    // Note: Pin toggling is handled at the service level when session is saved
    // The message pinned state is persisted through session auto-save
  },

  // Extract conclusions from the current session
  extractConclusions: async () => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    set({ extracting: true });
    try {
      const conclusions = await brainstormApi.extractConclusions(currentSessionId);
      set({
        conclusions,
        showConclusionPanel: true,
        extracting: false,
      });
    } catch (err) {
      console.error('Failed to extract conclusions:', err);
      set({ error: '提取结论失败', extracting: false });
    }
  },

  // Convert selected decisions to setting files
  convertDecisionsToSettings: async (decisions) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return [];

    try {
      const result = await brainstormApi.convertDecisions(currentSessionId, decisions);
      return result.settingIds;
    } catch (err) {
      console.error('Failed to convert decisions:', err);
      return [];
    }
  },

  // UI actions
  setInputValue: (value) => set({ inputValue: value }),
  toggleSessionList: () => set((s) => ({ showSessionList: !s.showSessionList })),
  toggleConclusionPanel: () =>
    set((s) => ({ showConclusionPanel: !s.showConclusionPanel })),
}));
