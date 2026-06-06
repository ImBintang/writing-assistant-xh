// client/src/components/home/StatCards.tsx
import { StatCard, type StatColor } from './StatCard';
import type { ReactNode } from 'react';

export interface StatItem {
  label: string;
  value: number | string;
  icon: ReactNode;
  color: StatColor;
  loading?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}

interface StatCardsProps {
  stats: StatItem[];
}

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}