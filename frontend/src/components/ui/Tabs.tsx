import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TabItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: 'underline' | 'pills';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeKey,
  onChange,
  variant = 'underline',
  className,
}) => {
  return (
    <div
      className={cn(
        'flex overflow-x-auto no-scrollbar border-b border-surface-border dark:border-surface-dark-border gap-2 select-none mb-6',
        variant === 'pills' && 'border-b-0 bg-surface-muted dark:bg-[#111] p-1 rounded-btn',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 shrink-0 whitespace-nowrap',
              variant === 'underline' && [
                'border-b-2 -mb-px',
                isActive
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-extrabold'
                  : 'border-transparent text-gray-550 hover:text-gray-900 dark:hover:text-white',
              ],
              variant === 'pills' && [
                'rounded-btn',
                isActive
                  ? 'bg-white dark:bg-[#0A0A0A] text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
              ]
            )}
          >
            {Icon && <Icon size={14} className="shrink-0" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold shrink-0',
                  isActive
                    ? 'bg-brand-100 text-brand-850 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-neutral-900 dark:text-gray-400'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
