import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  trend?: {
    value: string | number;
    direction: 'up' | 'down';
  };
  color?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color,
  className,
}) => {
  return (
    <div className={cn('card p-5 flex flex-col relative overflow-hidden', className)}>
      {Icon && (
        <div className="absolute right-4 top-4 text-gray-100 dark:text-neutral-900 opacity-20 dark:opacity-30 select-none pointer-events-none">
          <Icon size={44} strokeWidth={1.5} />
        </div>
      )}
      <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
        {label}
      </span>
      <span
        className="text-heading-md font-black text-gray-900 dark:text-white"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      {(sub || trend) && (
        <div className="flex items-center gap-1.5 mt-1 text-2xs font-bold select-none">
          {trend && (
            <span
              className={cn(
                trend.direction === 'up' ? 'text-green-500' : 'text-red-500'
              )}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {sub && <span className="text-gray-400 dark:text-gray-500">{sub}</span>}
        </div>
      )}
    </div>
  );
};
