import { typeLabels } from './AnomalyBadge';
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
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (value === null || value === undefined) {
    return '—';
  }
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

  const severityColorMap: Record<string, string> = {
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };
  const severityColor = severityColorMap[anomaly.severity] || 'bg-gray-100 text-gray-800';

  const details = anomaly.details || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-800">异常详情</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor}`}
            >
              {severityLabel}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Type and affected chapter */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">异常类型：</span>
              <span className="text-sm text-gray-900">{typeLabel}</span>
            </div>
            {chapter && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">涉及章节：</span>
                <span className="text-sm text-gray-900">
                  #{chapter.index} {chapter.title}
                </span>
              </div>
            )}
          </div>

          {/* Message */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-sm text-gray-700">{anomaly.message}</p>
          </div>

          {/* Details table */}
          {Object.keys(details).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">详细信息</h4>
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(details).map(([key, value]) => (
                    <tr key={key}>
                      <td className="py-1.5 pr-4 text-gray-500 whitespace-nowrap">
                        {formatDetailKey(key)}
                      </td>
                      <td className="py-1.5 text-gray-900 break-all">
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800 mb-2">
                该章节字数超过平均水平 3 倍，建议拆分为多个小节。
              </p>
              <button
                onClick={() => onSplitChapter(anomaly.chapterIndex)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
              >
                拆分此章节
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
