// client/src/components/knowledge/TrashPanel.tsx
// Trash panel — restore deleted entries

import { useKnowledgeManagement } from '../../hooks/useKnowledgeManagement';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

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
    <Modal
      open={true}
      onClose={onClose}
      title={`回收站 (${trashTotal})`}
      size="2xl"
      position="top"
      footer={
        <>
          <Button
            variant="danger"
            onClick={handleEmpty}
            disabled={trashEntries.length === 0}
          >
            清空回收站
          </Button>
          <Button variant="secondary" onClick={onClose}>关闭</Button>
        </>
      }
    >
      {trashLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : trashEntries.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <p>回收站为空</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trashEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between bg-slate-50 rounded-card px-4 py-3">
              <div>
                <span className="font-medium text-slate-700">{entry.name}</span>
                <span className="text-xs text-slate-400 ml-2">
                  {CATEGORY_NAMES[entry.category] || entry.category}
                </span>
                {entry.deletedAt && (
                  <span className="text-xs text-slate-400 ml-2">
                    删除于 {new Date(entry.deletedAt).toLocaleDateString('zh-CN')}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleRestore(entry.id)}>
                恢复
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
