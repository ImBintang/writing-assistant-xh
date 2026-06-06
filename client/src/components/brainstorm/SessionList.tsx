// client/src/components/brainstorm/SessionList.tsx
// Brainstorm session list sidebar with create/rename/delete

import { useState } from 'react';
import { useBrainstorm } from '../../hooks/useBrainstorm';

export default function SessionList() {
  const sessions = useBrainstorm((s) => s.sessions);
  const sessionsLoading = useBrainstorm((s) => s.sessionsLoading);
  const currentSessionId = useBrainstorm((s) => s.currentSessionId);
  const selectSession = useBrainstorm((s) => s.selectSession);
  const createSession = useBrainstorm((s) => s.createSession);
  const deleteSession = useBrainstorm((s) => s.deleteSession);
  const showSessionList = useBrainstorm((s) => s.showSessionList);
  const toggleSessionList = useBrainstorm((s) => s.toggleSessionList);

  const [newTitle, setNewTitle] = useState('');

  const handleCreate = async () => {
    const title = newTitle.trim() || undefined;
    await createSession(title);
    setNewTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  if (!showSessionList) {
    return (
      <button
        onClick={toggleSessionList}
        className="fixed left-4 top-32 px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors border border-purple-300 z-10"
      >
        💬 会话
      </button>
    );
  }

  return (
    <div className="w-64 border-r border-purple-200 flex flex-col bg-white">
      {/* Header */}
      <div className="p-3 border-b border-purple-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">💬 会话列表</h3>
          <button
            onClick={toggleSessionList}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        {/* Create */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="新会话标题（可选）"
            className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            ＋
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-auto">
        {sessionsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">暂无会话</p>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => selectSession(session.id)}
                className={`p-2.5 rounded-lg cursor-pointer transition-colors group ${
                  currentSessionId === session.id
                    ? 'bg-purple-50 border border-purple-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-700 truncate">
                      {session.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {new Date(session.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                      <span className="text-xs text-gray-400">
                        {session.messageCount} 条消息
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('确定删除此会话？')) {
                        deleteSession(session.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all text-xs"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
