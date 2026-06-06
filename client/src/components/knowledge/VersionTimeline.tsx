// client/src/components/knowledge/VersionTimeline.tsx
// Version history timeline component (PRD-04 Section 2.3)

import type { VersionRecord } from '../../services/knowledge';

const REASON_LABELS: Record<string, string> = {
  extraction: '自动提取',
  manual_edit: '手动编辑',
  import: '导入',
};

const REASON_COLORS: Record<string, string> = {
  extraction: 'bg-green-100 text-green-700 border-green-300',
  manual_edit: 'bg-amber-100 text-amber-700 border-amber-300',
  import: 'bg-blue-100 text-blue-700 border-blue-300',
};

interface Props {
  versions: VersionRecord[];
}

export default function VersionTimeline({ versions }: Props) {
  if (versions.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        暂无版本历史
      </div>
    );
  }

  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold text-gray-600 mb-3">版本历史</h4>
      <div className="relative pl-6 border-l-2 border-gray-200 space-y-4">
        {[...versions].reverse().map((v, i) => (
          <div key={i} className="relative">
            {/* Timeline dot */}
            <div className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 ${REASON_COLORS[v.reason]?.split(' ')[2] || 'border-gray-300'} ${REASON_COLORS[v.reason]?.split(' ')[1] || 'bg-gray-100'}`} />

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-gray-700">v{v.version}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${REASON_COLORS[v.reason] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {REASON_LABELS[v.reason] || v.reason}
                </span>
              </div>
              <div className="text-xs text-gray-400 mb-1">
                {new Date(v.timestamp).toLocaleString('zh-CN')}
              </div>
              {v.changedFields && v.changedFields.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {v.changedFields.map((field, j) => (
                    <span key={j} className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-500">
                      {field}
                    </span>
                  ))}
                </div>
              )}
              {v.editorNote && (
                <p className="text-xs text-gray-500 mt-1">{v.editorNote}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
