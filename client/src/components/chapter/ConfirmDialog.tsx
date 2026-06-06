import { useChapters } from '../../hooks/useChapters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ConfirmDialogProps {
  onClose: () => void;
}

export default function ConfirmDialog({ onClose }: ConfirmDialogProps) {
  const { totalChapters, anomalies, confirm } = useChapters();

  const anomalyCount = anomalies.length;
  const normalCount =
    totalChapters - anomalies.filter((a) => a.chapterIndex <= totalChapters).length;

  const handleConfirm = async () => {
    await confirm();
    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="确认拆分结果"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            稍后再确认
          </Button>
          <Button onClick={handleConfirm}>确认拆分</Button>
        </>
      }
    >
      <div className="mb-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">总章节数</span>
          <span className="font-semibold text-slate-800">{totalChapters}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">正常章节</span>
          <span className="font-semibold text-emerald-600">~{normalCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">异常项</span>
          <span
            className={`font-semibold ${
              anomalyCount > 0 ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            {anomalyCount}
          </span>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-card p-3">
        <p className="text-sm text-indigo-800">
          ℹ 确认后章节拆分将被固化，不再允许自动重新拆分。建议先检查所有异常项。
        </p>
      </div>
    </Modal>
  );
}
