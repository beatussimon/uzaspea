import React from 'react';
import { cn } from '../../lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({ className, size = 'md', ...props }) => {
  return (
    <span
      className={cn(
        'spinner inline-block shrink-0',
        size === 'sm' && 'w-4 h-4 border',
        size === 'md' && 'w-8 h-8 border-2',
        size === 'lg' && 'w-12 h-12 border-3',
        className
      )}
      {...props}
    />
  );
};
