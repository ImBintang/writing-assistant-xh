import { useChapters } from '../../hooks/useChapters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface MergeModalProps {
  onClose: () => void;
}

export default function MergeModal({ onClose }: MergeModalProps) {
  const { chapters, selectedIds, mergeChapters } = useChapters();

  const selectedChapters = chapters.filter((ch) => selectedIds.includes(ch.index));

  const handleMerge = async () => {
    await mergeChapters();
    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="合并章节"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleMerge}
            className="bg-amber-600 hover:bg-amber-700 from-amber-600 to-amber-600"
          >
            确认合并
          </Button>
        </>
      }
    >
      <div className="mb-4">
        <p className="text-sm text-slate-600 mb-3">
          将合并以下相邻章节为单个章节：
        </p>
        <ul className="space-y-1">
          {selectedChapters.map((ch) => (
            <li key={ch.index} className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 w-8 text-right">#{ch.index}</span>
              <span className="text-slate-700">{ch.title}</span>
              <span className="text-slate-400 text-xs">({ch.charCount}字)</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-card p-3">
        <p className="text-sm text-amber-800">
          ⚠ 此操作不可撤销。合并后将无法自动恢复为原来的独立章节。
        </p>
      </div>
    </Modal>
  );
}
