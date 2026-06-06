import { useChapters } from '../../hooks/useChapters';

interface MergeModalProps {
  onClose: () => void;
}

export default function MergeModal({ onClose }: MergeModalProps) {
  const { chapters, selectedIds, mergeChapters } = useChapters();

  const selectedChapters = chapters.filter((ch) =>
    selectedIds.includes(ch.index),
  );

  const handleMerge = async () => {
    await mergeChapters();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">合并章节</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              将合并以下相邻章节为单个章节：
            </p>
            <ul className="space-y-1">
              {selectedChapters.map((ch) => (
                <li key={ch.index} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 w-8 text-right">
                    #{ch.index}
                  </span>
                  <span className="text-gray-700">{ch.title}</span>
                  <span className="text-gray-400 text-xs">
                    ({ch.charCount}字)
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              ⚠ 此操作不可撤销。合并后将无法自动恢复为原来的独立章节。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleMerge}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
          >
            确认合并
          </button>
        </div>
      </div>
    </div>
  );
}
