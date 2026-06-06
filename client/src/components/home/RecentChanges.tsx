// client/src/components/home/RecentChanges.tsx
import type { ChangeRecord } from '../../services/knowledge';
import { Badge } from '../ui/Badge';

interface RecentChangesProps {
  changes: ChangeRecord[];
  loading?: boolean;
}

const changeTypeConfig: Record<string, { icon: string; label: string }> = {
  created: { icon: '+', label: '新增' },
  updated: { icon: '✏', label: '修改' },
  deleted: { icon: '🗑', label: '删除' },
  restored: { icon: '↩', label: '恢复' },
};

function formatTime(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHr < 24) return `${diffHr}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return date.toLocaleDateString('zh-CN');
}

export function RecentChanges({ changes, loading }: RecentChangesProps) {
  return (
    <div className="bg-white rounded-card border border-slate-100 shadow-card mt-4">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">
          📋 最近变更
        </h3>
      </div>

      <div className="divide-y divide-slate-50">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-8 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 flex-1 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-14 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : changes.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-slate-400">暂无变更记录</p>
          </div>
        ) : (
          changes.map((change, i) => {
            const cfg = changeTypeConfig[change.changeType] ?? { icon: '·', label: '' };
            return (
              <div
                key={`${change.entryId}-${change.version}-${i}`}
                className="flex items-center gap-2.5 px-4 py-2"
              >
                {/* 操作类型标签 */}
                <span className="text-xs font-medium text-slate-400 w-8 flex-shrink-0">
                  {cfg.icon} {cfg.label}
                </span>

                {/* 条目名称 */}
                <span className="text-xs text-slate-700 flex-1 min-w-0 truncate">
                  {change.entryName}
                </span>

                {/* 分类 */}
                <Badge variant="muted" className="text-[10px] px-1.5 py-0">
                  {change.category}
                </Badge>

                {/* 时间 */}
                <span className="text-[10px] text-slate-400 flex-shrink-0">
                  {formatTime(change.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}