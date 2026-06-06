// client/src/components/brainstorm/SessionList.tsx
// Brainstorm session list — always visible

import { useState } from 'react';
import { useBrainstorm } from '../../hooks/useBrainstorm';
import { api } from '../../services/api';

export default function SessionList() {
  const sessions = useBrainstorm((s) => s.sessions);
  const sessionsLoading = useBrainstorm((s) => s.sessionsLoading);
  const currentSessionId = useBrainstorm((s) => s.currentSessionId);
  const selectSession = useBrainstorm((s) => s.selectSession);
  const createSession = useBrainstorm((s) => s.createSession);
  const deleteSession = useBrainstorm((s) => s.deleteSession);
  const [newTitle, setNewTitle] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const handleCreate = async () => { const title = newTitle.trim() || undefined; await createSession(title); setNewTitle(''); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleCreate(); };

  const handleExport = async (sessionId: string, title: string) => {
    try {
      const response = await api.get(`/api/v1/brainstorm/sessions/${sessionId}/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/markdown' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export session:', err);
    }
  };

  const filteredSessions = searchFilter.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(searchFilter.toLowerCase()))
    : sessions;

  return (
    <div className="w-64 border-r border-slate-100 flex flex-col bg-white">
      <div className="p-3 border-b border-slate-100">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">💬 会话列表</h3>
        <div className="flex gap-2 mb-2">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={handleKeyDown} placeholder="新会话标题（可选）" className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200" />
          <button type="button" onClick={handleCreate} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-700 text-white shadow-[0_4px_14px_0_rgba(124,58,237,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-4px_rgba(124,58,237,0.35)] transition-all duration-200 active:translate-y-0" title="创建新会话">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="🔍 搜索会话..."
          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {sessionsLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500" /></div>
        ) : filteredSessions.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">暂无会话</p>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSessions.map((session) => (
              <div key={session.id} onClick={() => selectSession(session.id)} className={`p-2.5 rounded-card cursor-pointer transition-colors group ${currentSessionId === session.id ? 'bg-violet-50 border border-violet-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-700 truncate">{session.title}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{new Date(session.createdAt).toLocaleDateString('zh-CN')}</span>
                      <span className="text-xs text-slate-400">{session.messageCount} 条消息</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(session.id, session.title); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-violet-500 transition-all text-xs"
                      title="导出会话"
                    >📥</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm('确定删除此会话？')) deleteSession(session.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all text-xs"
                      title="删除会话"
                    >🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
