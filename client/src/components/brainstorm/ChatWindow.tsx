// client/src/components/brainstorm/ChatWindow.tsx
// Chat message display with user/AI bubbles and @mention highlighting

import { useEffect, useRef } from 'react';
import { useBrainstorm } from '../../hooks/useBrainstorm';
import type { ChatMessage } from '../../services/brainstorm';

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-purple-500 text-white'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {/* Pin toggle */}
        <div className="flex items-center gap-2 mb-1">
          {isUser ? (
            <span className="text-xs text-purple-200">你</span>
          ) : (
            <span className="text-xs text-gray-500">AI 助手</span>
          )}
          {message.pinned && (
            <span className="text-xs">📌</span>
          )}
        </div>

        {/* Content with @mention highlighting */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {/* Knowledge references */}
        {message.references && message.references.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.references.map((ref, idx) => (
              <span
                key={idx}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  isUser
                    ? 'bg-purple-400 text-purple-100'
                    : 'bg-purple-100 text-purple-700'
                }`}
              >
                @{ref.knowledgeName || ref.knowledgeId}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-xs mt-1.5 ${
            isUser ? 'text-purple-200' : 'text-gray-400'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow() {
  const messages = useBrainstorm((s) => s.messages);
  const sendingMessage = useBrainstorm((s) => s.sendingMessage);
  const error = useBrainstorm((s) => s.error);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0 && !sendingMessage) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-3 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p>开始你的剧情头脑风暴</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-4 py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Loading indicator */}
      {sendingMessage && (
        <div className="flex justify-start mb-4">
          <div className="bg-gray-100 rounded-xl px-4 py-3">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm mb-4">
          {error}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
