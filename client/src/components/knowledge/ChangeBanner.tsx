// client/src/components/knowledge/ChangeBanner.tsx
// Recent changes notification banner

import { Card } from '../ui/Card';
import type { ChangeRecord } from '../../services/knowledge';

interface Props {
  changes: ChangeRecord[];
  loading: boolean;
  onEntryClick: (entryId: string) => void;
  onRefresh: () => void;
  onDismiss: () => void;
  visible: boolean;
}

export default function ChangeBanner({ changes, loading, onEntryClick, onRefresh, onDismiss, visible }: Props) {
  if (!visible) return null;

  return (
    <Card padding="md" className="mb-4 bg-indigo-50 border-indigo-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          最近更新
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="text-xs text-indigo-600 hover:text-indigo-800">刷新</button>
          <button onClick={onDismiss} className="text-xs text-slate-400 hover:text-slate-600">&times;</button>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-2">
          <div className="animate-spin inline-block rounded-full h-4 w-4 border-b-2 border-indigo-600" />
        </div>
      ) : changes.length === 0 ? (
        <p className="text-sm text-slate-500">暂无变更记录</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {changes.slice(0, 10).map((change, i) => (
            <div
              key={i}
              onClick={() => onEntryClick(change.entryId)}
              className="text-sm text-slate-600 hover:bg-indigo-100/70 rounded px-2 py-1 cursor-pointer transition-colors"
            >
              <span className="text-indigo-700 font-medium">{change.entryName}</span>
              <span className="text-slate-400 mx-1">·</span>
              <span className="text-slate-500">
                {change.changeType === 'created' ? '新建' : change.changeType === 'deleted' ? '删除' : change.changeType === 'restored' ? '恢复' : '更新'}
              </span>
              <span className="text-slate-400 mx-1">·</span>
              <span className="text-xs text-slate-400">
                {new Date(change.timestamp).toLocaleString('zh-CN')}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
