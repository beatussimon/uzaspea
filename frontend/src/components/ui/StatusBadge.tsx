import React from 'react';
import { useTranslation } from 'react-i18next';
import { ORDER_STATUS_CONFIG } from '../../constants/orderStatus';
import { cn } from '../../lib/utils';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  className,
  showIcon = false,
}) => {
  const { t } = useTranslation();
  const config = ORDER_STATUS_CONFIG[status] || {
    label: status,
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-500/10 border-gray-500/20',
    dot: 'bg-gray-400',
    icon: null,
  };

  const Icon = config.icon;
  const label = t(`status.${status}`, config.label || status.replace(/_/g, ' '));

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium shrink-0 select-none border capitalize',
        config.bg || 'bg-gray-500/10 border-gray-500/20',
        config.color || 'text-gray-600 dark:text-gray-400',
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        className
      )}
    >
      {showIcon && Icon ? (
        <Icon size={size === 'sm' ? 12 : 14} className="shrink-0" />
      ) : (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dot || 'bg-gray-400')} />
      )}
      <span>{label}</span>
    </span>
  );
};
