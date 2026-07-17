import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'text-center py-12 px-4 bg-white/50 dark:bg-[#111]/50 rounded-card border border-dashed border-surface-border dark:border-surface-dark-border flex flex-col items-center justify-center max-w-lg mx-auto',
        className
      )}
    >
      <div className="w-12 h-12 bg-gray-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-4">
        {Icon ? (
          <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        ) : (
          <div className="w-1.5 h-1.5 bg-gray-300 dark:bg-neutral-700 rounded-full" />
        )}
      </div>
      <h3 className="text-heading-sm font-bold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="default" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
};
