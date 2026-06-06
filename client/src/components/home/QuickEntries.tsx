// client/src/components/home/QuickEntries.tsx
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface QuickEntryItem {
  title: string;
  description: string;
  icon: ReactNode;
  to: string;
  hasAlert?: boolean;
}

interface QuickEntriesProps {
  entries: QuickEntryItem[];
}

export function QuickEntries({ entries }: QuickEntriesProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {entries.map((entry) => (
        <QuickEntryCard key={entry.to} {...entry} />
      ))}
    </div>
  );
}

function QuickEntryCard({ title, description, icon, to, hasAlert }: QuickEntryItem) {
  const navigate = useNavigate();

  return (
    <div
      className={[
        'group bg-white rounded-card border border-slate-100 p-4',
        'hover:shadow-cardHover hover:border-indigo-200 hover:-translate-y-1',
        'transition-all duration-300 cursor-pointer',
        'relative',
      ].join(' ')}
      onClick={() => navigate(to)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(to); }}
    >
      {/* 提醒红点 */}
      {hasAlert && (
        <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
      )}

      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-100 flex-shrink-0">
          <div className="w-5 h-5 text-indigo-600">
            {icon}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 mb-0.5 group-hover:text-indigo-700 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-slate-500 line-clamp-1">{description}</p>
        </div>

        {/* 悬停箭头 */}
        <div className="flex-shrink-0 self-center ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}