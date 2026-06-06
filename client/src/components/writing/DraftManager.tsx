// client/src/components/writing/DraftManager.tsx
// Draft management modal

import { useState } from 'react';
import { useWriting } from '../../hooks/useWriting';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export default function DraftManager() {
  const { draftManagerOpen, closeDraftManager, drafts, draftsLoading, loadDraft, deleteDraftById, newDraft } = useWriting();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  if (!draftManagerOpen) return null;

  const handleDelete = async (id: string) => { await deleteDraftById(id); setConfirmDeleteId(null); };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr); const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return '刚刚'; if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`; if (diffDays < 7) return `${diffDays} 天前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <Modal open={true} onClose={closeDraftManager} title="草稿管理" size="md">
      <div className="flex items-center justify-between mb-3">
        <Button size="sm" onClick={newDraft}>+ 新建草稿</Button>
      </div>
      {draftsLoading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500"><span className="text-3xl mb-2">📝</span><p>暂无草稿</p></div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {drafts.map((draft) => (
            <div key={draft.id} className="px-1 py-3 hover:bg-slate-50 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-800 truncate">{draft.title || '未命名草稿'}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">第 {draft.targetChapter} 章</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-400">{formatDate(draft.updatedAt)}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-400">{draft.draft.length.toLocaleString()} 字</span>
                  </div>
                  {draft.outline && <p className="text-xs text-slate-500 mt-1 truncate">大纲：{draft.outline.slice(0, 60)}...</p>}
                </div>
                <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => loadDraft(draft.id)}>加载</Button>
                  {confirmDeleteId === draft.id ? (
                    <div className="flex items-center gap-1">
                      <Button variant="danger" size="sm" onClick={() => handleDelete(draft.id)}>确认</Button>
                      <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)}>取消</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(draft.id)} className="text-red-400 hover:bg-red-50">删除</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
