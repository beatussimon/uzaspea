import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-btn text-body-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.97]',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-black hover:bg-brand-700 shadow-sm dark:bg-brand-500 dark:hover:bg-brand-600',
        outline: 'border border-surface-border dark:border-surface-dark-border bg-transparent hover:bg-surface-muted dark:hover:bg-white/5 text-gray-900 dark:text-white',
        ghost: 'hover:bg-surface-muted dark:hover:bg-white/5 text-gray-700 dark:text-gray-300',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
      },
      size: {
        default: 'h-10 px-5 py-2.5',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-8 text-body',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref" | "children">,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={loading ? undefined : { scale: 0.97 }}
        disabled={loading || props.disabled}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
