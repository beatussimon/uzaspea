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

  const getValueFontSize = () => {
    const strVal = String(value);
    const len = strVal.length;
    if (len > 15) return 'text-xs sm:text-sm';
    if (len > 11) return 'text-xs sm:text-sm lg:text-sm xl:text-base';
    if (len > 7) return 'text-sm sm:text-base lg:text-base xl:text-lg';
    if (len > 5) return 'text-base sm:text-lg lg:text-lg xl:text-xl';
    return 'text-lg sm:text-xl';
  };

  return (
    <div 
      ref={cardRef}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(prev => !prev);
      }}
      className={cn('card p-3 sm:p-3.5 relative overflow-hidden group cursor-pointer select-none active:scale-[0.98] transition-all hover:shadow-xs hover:border-gray-900/20 dark:hover:border-white/20', className)}
    >
      {isOpen && (
        <div className="absolute inset-x-2 top-2 z-30 bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-2 rounded-xl shadow-2xl text-center text-xs font-bold border border-white/10 dark:border-black/10 animate-fade-in">
          <p className="text-[10px] opacity-75 mb-0.5 font-medium">{label}</p>
          <p className="text-xs sm:text-sm font-bold tracking-tight">{displayTooltip}</p>
        </div>
      )}

      <div>
        <div className="flex items-center gap-1.5 mb-1 min-w-0">
          {Icon && (
            <Icon 
              size={14} 
              className={cn("shrink-0", color ? "" : "text-brand-500")} 
              style={color ? { color } : undefined} 
            />
          )}
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-snug line-clamp-1" title={label}>
            {label}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
          <span
            className={cn(
              "font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight whitespace-nowrap",
              getValueFontSize()
            )}
            style={color ? { color } : undefined}
            title={displayTooltip}
          >
            {value}
          </span>
          {trend && (
            <span
              className={cn(
                'text-[11px] font-bold shrink-0 inline-flex items-center',
                trend.direction === 'up' ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {trend.direction === 'up' ? '↑' : '↓'}{trend.value}
            </span>
          )}
          {sub && (
            <span className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 truncate leading-tight shrink-0">
              {sub}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
