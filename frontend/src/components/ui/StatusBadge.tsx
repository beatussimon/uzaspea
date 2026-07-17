import React from 'react';
import { useTranslation } from 'react-i18next';
import { ORDER_STATUS_CONFIG } from '../../constants/orderStatus';
import { cn } from '../../lib/utils';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  className,
}) => {
  const { t } = useTranslation();
  const config = ORDER_STATUS_CONFIG[status] || {
    label: status,
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800',
    icon: null,
  };

  const Icon = config.icon;
  const label = t(`status.${status}`, config.label);

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-pill font-bold tracking-tight shrink-0 select-none',
        config.bg,
        config.color,
        size === 'sm' ? 'px-2.5 py-0.5 text-[10px] gap-1' : 'px-3.5 py-1 text-xs gap-1.5',
        className
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 12 : 14} className="shrink-0" />}
      <span>{label}</span>
    </div>
  );
};
