import { useChapters } from '../../hooks/useChapters';

interface ConfirmDialogProps {
  onClose: () => void;
}

export default function ConfirmDialog({ onClose }: ConfirmDialogProps) {
  const { totalChapters, anomalies, confirm } = useChapters();

  const anomalyCount = anomalies.length;
  const normalCount = totalChapters - anomalies.filter(
    (a) => a.chapterIndex <= totalChapters,
  ).length;

  const handleConfirm = async () => {
    await confirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">确认拆分结果</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">总章节数</span>
              <span className="font-semibold text-gray-800">
                {totalChapters}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">正常章节</span>
              <span className="font-semibold text-green-600">
                ~{normalCount}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">异常项</span>
              <span
                className={`font-semibold ${
                  anomalyCount > 0 ? 'text-yellow-600' : 'text-gray-400'
                }`}
              >
                {anomalyCount}
              </span>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
            <p className="text-sm text-indigo-800">
              ℹ 确认后章节拆分将被固化，不再允许自动重新拆分。建议先检查所有异常项。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            稍后再确认
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            确认拆分
          </button>
        </div>
      </div>
    </div>
  );
}
