// client/src/pages/Brainstorm.tsx
// Brainstorm page — violet-themed per Corporate Trust secondary color

import { useEffect, useCallback, useRef } from 'react';
import { useBrainstorm } from '../hooks/useBrainstorm';
import SessionList from '../components/brainstorm/SessionList';
import ChatWindow from '../components/brainstorm/ChatWindow';
import ConclusionPanel from '../components/brainstorm/ConclusionPanel';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';

export default function BrainstormPage() {
  const loadSessions = useBrainstorm((s) => s.loadSessions);
  const session = useBrainstorm((s) => s.session);
  const currentSessionId = useBrainstorm((s) => s.currentSessionId);
  const inputValue = useBrainstorm((s) => s.inputValue);
  const setInputValue = useBrainstorm((s) => s.setInputValue);
  const sendMessage = useBrainstorm((s) => s.sendMessage);
  const sendingMessage = useBrainstorm((s) => s.sendingMessage);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentSessionId]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || sendingMessage) return;

    // Parse @mentions and resolve to knowledge entry IDs
    const mentionRegex = /@(\S+)/g;
    const mentionNames: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentionNames.push(match[1]);
    }

    // Resolve @mentions to knowledge entry IDs via search API
    let referenceIds: string[] = [];
    if (mentionNames.length > 0) {
      try {
        const resolved: string[] = [];
        for (const name of mentionNames) {
          const response = await api.get('/api/v1/knowledge/search', {
            params: { q: name, size: 5 },
          });
          const results = response.data.results || [];
          // Match exact or fuzzy results
          const match =
            results.find((r: { name: string }) => r.name === name) ||
            results.find((r: { name: string }) => r.name.includes(name));
          if (match) {
            resolved.push(match.id);
          }
        }
        referenceIds = resolved;
      } catch (err) {
        console.warn('Failed to resolve @mentions:', err);
      }
    }

    await sendMessage(text, referenceIds);
  }, [inputValue, sendingMessage, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <SessionList />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Warning banner — violet replaces purple */}
        {session && (
          <div className="px-4 py-2 bg-violet-50 border-b border-violet-200 text-xs text-violet-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>💬</span>
              <span>头脑风暴内容仅保存为对话记录，不会影响知识库</span>
            </div>
            <span className="text-violet-400">{session.title}</span>
          </div>
        )}

        {/* Chat messages */}
        <ChatWindow />

        {/* Input area */}
        <div className="border-t border-slate-200 px-4 py-3 bg-white">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的想法... 按 Enter 发送"
              disabled={sendingMessage}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow duration-standard disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || sendingMessage}
              isLoading={sendingMessage}
              className="bg-violet-600 hover:bg-violet-700 from-violet-600 to-violet-600"
            >
              发送
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            可以使用 @条目名 引用知识库中的内容
          </p>
        </div>
      </div>

      <ConclusionPanel />
    </div>
  );
}
