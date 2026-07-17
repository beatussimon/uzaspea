import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'bg-brand-100 text-brand-850 dark:bg-brand-950/40 dark:text-brand-400',
        secondary: 'bg-surface-muted text-gray-800 dark:bg-surface-dark-border dark:text-gray-300',
        destructive: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
        success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400',
        warning: 'bg-orange-100 text-orange-850 dark:bg-orange-950/40 dark:text-orange-400',
        outline: 'text-gray-900 dark:text-white border border-surface-border dark:border-surface-dark-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full mr-1.5 shrink-0',
            variant === 'success' && 'bg-emerald-500',
            variant === 'destructive' && 'bg-red-500',
            variant === 'info' && 'bg-blue-500',
            variant === 'warning' && 'bg-orange-500',
            variant === 'default' && 'bg-brand-500',
            (!variant || variant === 'secondary' || variant === 'outline') && 'bg-gray-400'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
