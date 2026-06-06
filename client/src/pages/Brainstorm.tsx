// client/src/pages/Brainstorm.tsx
// Brainstorm page (PRD-06)
// Layout: session list + chat window + conclusion panel

import { useEffect, useCallback, useRef } from 'react';
import { useBrainstorm } from '../hooks/useBrainstorm';
import SessionList from '../components/brainstorm/SessionList';
import ChatWindow from '../components/brainstorm/ChatWindow';
import ConclusionPanel from '../components/brainstorm/ConclusionPanel';

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

  // Focus input when session changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentSessionId]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || sendingMessage) return;

    // Extract @mentions from the message
    const mentionRegex = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    // For now, references are empty (no knowledge ID mapping in frontend yet)
    await sendMessage(text, []);
  }, [inputValue, sendingMessage, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 140px)' }}>
      <SessionList />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Warning banner */}
        {session && (
          <div className="px-4 py-2 bg-purple-50 border-b border-purple-200 text-xs text-purple-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>💬</span>
              <span>头脑风暴内容仅保存为对话记录，不会影响知识库</span>
            </div>
            <span className="text-purple-400">{session.title}</span>
          </div>
        )}

        {/* Chat messages */}
        <ChatWindow />

        {/* Input area */}
        <div className="border-t border-gray-200 px-4 py-3 bg-white">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的想法... 按 Enter 发送"
              disabled={sendingMessage}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || sendingMessage}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                !inputValue.trim() || sendingMessage
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
            >
              {sendingMessage ? '...' : '发送'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            可以使用 @条目名 引用知识库中的内容
          </p>
        </div>
      </div>

      <ConclusionPanel />
    </div>
  );
}
