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
    bg: 'bg-transparent',
    dot: 'bg-gray-400',
    icon: null,
  };

  const Icon = config.icon;
  const label = t(`status.${status}`, config.label || status.replace(/_/g, ' '));

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium shrink-0 select-none capitalize bg-transparent',
        config.color || 'text-gray-600 dark:text-gray-400',
        size === 'sm' ? 'text-[11px]' : 'text-xs',
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
