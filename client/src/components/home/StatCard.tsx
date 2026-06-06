// client/src/components/home/StatCard.tsx
import type { ReactNode } from 'react';

const colorMap = {
  indigo: {
    bg: 'bg-indigo-100',
    icon: 'text-indigo-600',
    value: 'text-indigo-700',
  },
  violet: {
    bg: 'bg-violet-100',
    icon: 'text-violet-600',
    value: 'text-violet-700',
  },
  emerald: {
    bg: 'bg-emerald-100',
    icon: 'text-emerald-600',
    value: 'text-emerald-700',
  },
  amber: {
    bg: 'bg-amber-100',
    icon: 'text-amber-600',
    value: 'text-amber-700',
  },
} as const;

export type StatColor = keyof typeof colorMap;

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  color: StatColor;
  loading?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}

export function StatCard({ label, value, icon, color, loading, highlight, onClick }: StatCardProps) {
  const c = colorMap[color];

  const cardClasses = [
    'bg-white rounded-card border border-slate-100 p-4 sm:p-5',
    'transition-all duration-300',
    onClick && 'cursor-pointer',
    onClick && !highlight && 'hover:shadow-cardHover hover:-translate-y-1',
    highlight
      ? 'shadow-glow border-amber-200 ring-1 ring-amber-100'
      : 'shadow-card',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClasses} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={['flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex-shrink-0', c.bg].join(' ')}>
          <div className={['w-5 h-5', c.icon].join(' ')}>
            {icon}
          </div>
        </div>
        <div className="min-w-0">
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-7 w-16 bg-slate-200 rounded animate-pulse" />
              <div className="h-3.5 w-12 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <div className={['text-xl sm:text-2xl font-bold tracking-tight', c.value].join(' ')}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}