import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
        secondary: 'bg-surface-muted text-gray-800 dark:bg-surface-dark-border dark:text-gray-300',
        destructive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
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
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
