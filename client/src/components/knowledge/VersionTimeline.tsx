// client/src/components/knowledge/VersionTimeline.tsx
// Version history timeline component

import { Badge } from '../ui/Badge';
import type { VersionRecord } from '../../services/knowledge';

const REASON_LABELS: Record<string, string> = {
  extraction: '自动提取',
  manual_edit: '手动编辑',
  import: '导入',
};

const REASON_VARIANT: Record<string, 'success' | 'warning' | 'info'> = {
  extraction: 'success',
  manual_edit: 'warning',
  import: 'info',
};

interface Props {
  versions: VersionRecord[];
}

export default function VersionTimeline({ versions }: Props) {
  if (versions.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-sm">暂无版本历史</div>
    );
  }

  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold text-slate-600 mb-3">版本历史</h4>
      <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
        {[...versions].reverse().map((v, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 bg-white border-slate-300" />
            <div className="bg-slate-50 rounded-card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-slate-700">v{v.version}</span>
                <Badge variant={REASON_VARIANT[v.reason] || 'default'}>
                  {REASON_LABELS[v.reason] || v.reason}
                </Badge>
              </div>
              <div className="text-xs text-slate-400 mb-1">
                {new Date(v.timestamp).toLocaleString('zh-CN')}
              </div>
              {v.changedFields && v.changedFields.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {v.changedFields.map((field, j) => (
                    <span key={j} className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
                      {field}
                    </span>
                  ))}
                </div>
              )}
              {v.editorNote && (
                <p className="text-xs text-slate-500 mt-1">{v.editorNote}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
