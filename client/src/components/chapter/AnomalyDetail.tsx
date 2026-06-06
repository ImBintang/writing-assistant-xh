import { typeLabels } from './AnomalyBadge';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { AnomalyRecord, ChapterMeta } from '../../services/chapters';

interface AnomalyDetailProps {
  anomaly: AnomalyRecord;
  chapter?: ChapterMeta;
  onClose: () => void;
  onSplitChapter?: (chapterIndex: number) => void;
}

const severityLabels: Record<string, string> = {
  warning: '警告',
  error: '错误',
  info: '提示',
};

const severityVariant: Record<string, 'warning' | 'error' | 'info'> = {
  warning: 'warning',
  error: 'error',
  info: 'info',
};

function formatDetailKey(key: string): string {
  const keyMap: Record<string, string> = {
    score: '评分（/10）',
    blankLineScore: '空行隔离评分',
    contentScore: '内容量评分',
    uniquenessScore: '唯一性评分',
    positionScore: '位置评分',
    titleOccurrences: '标题出现次数',
    title: '章节标题',
    matchedPattern: '匹配模式',
    prevChapter: '前一章序号',
    nextChapter: '后一章序号',
    missingIndex: '缺失序号',
    count: '重复次数',
    titles: '章节标题列表',
    charCount: '字数',
    average: '平均字数',
    threshold: '阈值',
    ratio: '比例',
  };
  return keyMap[key] || key;
}

function formatDetailValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '—';
  return String(value);
}

export default function AnomalyDetail({
  anomaly,
  chapter,
  onClose,
  onSplitChapter,
}: AnomalyDetailProps) {
  const typeLabel = typeLabels[anomaly.type] || anomaly.type;
  const severityLabel = severityLabels[anomaly.severity] || anomaly.severity;
  const details = anomaly.details || {};

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>异常详情</span>
          <Badge variant={severityVariant[anomaly.severity] || 'info'}>
            {severityLabel}
          </Badge>
        </div>
      }
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Type and affected chapter */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-slate-700">异常类型：</span>
            <span className="text-sm text-slate-900">{typeLabel}</span>
          </div>
          {chapter && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">涉及章节：</span>
              <span className="text-sm text-slate-900">
                #{chapter.index} {chapter.title}
              </span>
            </div>
          )}
        </div>

        {/* Message */}
        <div className="bg-slate-50 border border-slate-200 rounded-card p-3">
          <p className="text-sm text-slate-700">{anomaly.message}</p>
        </div>

        {/* Details table */}
        {Object.keys(details).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">详细信息</h4>
            <table className="min-w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {Object.entries(details).map(([key, value]) => (
                  <tr key={key}>
                    <td className="py-1.5 pr-4 text-slate-500 whitespace-nowrap">
                      {formatDetailKey(key)}
                    </td>
                    <td className="py-1.5 text-slate-900 break-all">
                      {formatDetailValue(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Contextual action for oversized chapters */}
        {anomaly.type === 'oversized_chapter' && onSplitChapter && (
          <div className="bg-amber-50 border border-amber-200 rounded-card p-3">
            <p className="text-sm text-amber-800 mb-2">
              该章节字数超过平均水平 3 倍，建议拆分为多个小节。
            </p>
            <Button
              onClick={() => onSplitChapter(anomaly.chapterIndex)}
              className="bg-amber-600 hover:bg-amber-700 from-amber-600 to-amber-600"
              size="sm"
            >
              拆分此章节
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
