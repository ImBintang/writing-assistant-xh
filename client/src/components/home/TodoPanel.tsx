// client/src/components/home/TodoPanel.tsx
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/Badge';

export interface TodoItemData {
  id: string;
  type: 'conflict' | 'anomaly' | 'unconfirmed_chapter' | 'unmigrated_setting';
  severity: 'high' | 'medium' | 'low' | 'info';
  label: string;
  count: number;
  navigateTo: string;
}

interface TodoPanelProps {
  items: TodoItemData[];
  loading?: boolean;
}

const severityConfig = {
  high: { dot: 'bg-red-500', badge: 'error' as const, label: '高' },
  medium: { dot: 'bg-amber-500', badge: 'warning' as const, label: '中' },
  low: { dot: 'bg-yellow-400', badge: 'warning' as const, label: '低' },
  info: { dot: 'bg-blue-400', badge: 'info' as const, label: '信息' },
};

export function TodoPanel({ items, loading }: TodoPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-card border border-slate-100 shadow-card">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">
          ⚡ 待办提醒
        </h3>
      </div>

      <div className="divide-y divide-slate-50">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-4 flex-1 bg-slate-100 rounded animate-pulse" />
                <div className="h-5 w-8 bg-slate-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-2xl mb-2">✅</div>
            <p className="text-sm text-slate-500">一切就绪，没有需要处理的事项</p>
          </div>
        ) : (
          items.map((item) => {
            const sev = severityConfig[item.severity];
            return (
              <div
                key={item.id}
                className={[
                  'flex items-center gap-3 px-4 py-2.5',
                  'hover:bg-slate-50 cursor-pointer transition-colors duration-150',
                ].join(' ')}
                onClick={() => navigate(item.navigateTo)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(item.navigateTo); }}
              >
                {/* 严重程度圆点 */}
                <span className={['h-2.5 w-2.5 rounded-full flex-shrink-0', sev.dot].join(' ')} />

                {/* 事项名称 */}
                <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">
                  {item.label}
                </span>

                {/* 数量 Badge */}
                <Badge variant={sev.badge}>{item.count}</Badge>

                {/* 右箭头 */}
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}