// client/src/components/knowledge/TrashPanel.tsx
// Trash panel — list and restore deleted entries (PRD-04 Section 2.2.2)

import { useKnowledgeManagement } from '../../hooks/useKnowledgeManagement';

const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

interface Props {
  onClose: () => void;
}

export default function TrashPanel({ onClose }: Props) {
  const { trashEntries, trashTotal, trashLoading, restoreEntry, emptyTrash } =
    useKnowledgeManagement();

  const handleRestore = async (id: string) => {
    await restoreEntry(id);
  };

  const handleEmpty = async () => {
    if (!confirm('确定要永久删除回收站中的所有条目吗？此操作不可恢复。')) return;
    await emptyTrash();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-16 pb-10">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            回收站 ({trashTotal})
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {trashLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : trashEntries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <p>回收站为空</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trashEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="font-medium text-gray-700">{entry.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {CATEGORY_NAMES[entry.category] || entry.category}
                    </span>
                    {entry.deletedAt && (
                      <span className="text-xs text-gray-400 ml-2">
                        删除于 {new Date(entry.deletedAt).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestore(entry.id)}
                    className="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    恢复
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={handleEmpty}
            disabled={trashEntries.length === 0}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            清空回收站
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
