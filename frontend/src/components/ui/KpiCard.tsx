import React, { useState, useEffect, useRef } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface KpiCardProps {
  label: string;
  value: string | number;
  fullValue?: string | number;
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
  fullValue,
  sub,
  icon: Icon,
  trend,
  color,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClose = (event?: Event) => {
      if (event && event.type === 'click' && cardRef.current && cardRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('click', handleClose);
      window.addEventListener('scroll', handleClose, { capture: true });
    }
    return () => {
      document.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, { capture: true });
    };
  }, [isOpen]);

  const displayTooltip = fullValue !== undefined ? String(fullValue) : String(value);

  return (
    <div 
      ref={cardRef}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(prev => !prev);
      }}
      className={cn('card p-5 flex flex-col relative overflow-hidden group cursor-pointer select-none active:scale-[0.98] transition-all', className)}
    >
      {isOpen && (
        <div className="absolute inset-x-2 top-2 z-30 bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-2.5 rounded-xl shadow-2xl text-center text-xs font-black border border-white/10 dark:border-black/10 animate-fade-in">
          <p className="text-[9px] uppercase tracking-wider opacity-70 mb-0.5 font-bold">{label}</p>
          <p className="text-xs sm:text-sm font-black tracking-tight">{displayTooltip}</p>
        </div>
      )}

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
