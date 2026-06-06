// client/src/components/writing/DraftManager.tsx
// Draft management modal for PRD-05

import { useState } from 'react';
import { useWriting } from '../../hooks/useWriting';

export default function DraftManager() {
  const {
    draftManagerOpen,
    closeDraftManager,
    drafts,
    draftsLoading,
    loadDraft,
    deleteDraftById,
    newDraft,
  } = useWriting();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!draftManagerOpen) return null;

  const handleDelete = async (id: string) => {
    await deleteDraftById(id);
    setConfirmDeleteId(null);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-2xl w-[540px] max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">草稿管理</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={newDraft}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              + 新建草稿
            </button>
            <button
              type="button"
              onClick={closeDraftManager}
              className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {draftsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <span className="text-3xl mb-2">📝</span>
              <p>暂无草稿</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="px-5 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-800 truncate">
                        {draft.title || '未命名草稿'}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          第 {draft.targetChapter} 章
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">
                          {formatDate(draft.updatedAt)}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">
                          {draft.draft.length.toLocaleString()} 字
                        </span>
                      </div>
                      {draft.outline && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          大纲：{draft.outline.slice(0, 60)}...
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => loadDraft(draft.id)}
                        className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                      >
                        加载
                      </button>
                      {confirmDeleteId === draft.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(draft.id)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded cursor-pointer"
                          >
                            确认
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded cursor-pointer"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(draft.id)}
                          className="px-2 py-1 text-xs text-red-400 hover:bg-red-50 rounded cursor-pointer"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
