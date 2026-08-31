

import React from 'react';
import { cn } from '../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => (
  <div
    className={cn(
      'relative overflow-hidden bg-gray-200/60 dark:bg-white/[0.04] rounded-md',
      className
    )}
    {...props}
  >
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/[0.04] to-transparent" />
  </div>
);

/**
 * Standard Page Header Skeleton (Title, description, and action buttons)
 */
export const PageHeaderSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4', className)}>
    <div className="space-y-2">
      <Skeleton className="h-6 w-40 rounded-md" />
      <Skeleton className="h-3.5 w-60 max-w-full rounded-md" />
    </div>
    <div className="flex items-center gap-2">
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
  </div>
);

/**
 * Standard KPI Cards Grid Skeleton matching standard KpiCard height (~72px)
 */
export const KpiGridSkeleton: React.FC<{
  count?: number;
  cols?: 2 | 3 | 4 | 5 | 6 | 8;
  className?: string;
}> = ({ count = 4, cols = 4, className }) => {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
    8: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8',
  }[cols] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={cn('grid gap-3.5', colClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card p-3 sm:p-3.5 flex flex-col justify-between h-[76px] relative overflow-hidden"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Skeleton className="w-3.5 h-3.5 rounded-full shrink-0" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-3 w-10 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Standard Table Skeleton with header and configurable rows/cols
 */
export const TableSkeleton: React.FC<{
  rows?: number;
  cols?: number;
  className?: string;
}> = ({ rows = 4, cols = 4, className }) => (
  <div className={cn('card overflow-hidden', className)}>
    <div className="p-3.5 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex justify-between items-center">
      <Skeleton className="h-4 w-28 rounded" />
      <Skeleton className="h-7 w-32 rounded-lg" />
    </div>
    <div className="p-3.5 space-y-2.5">
      {/* Table Header */}
      <div className="grid gap-4 pb-2 border-b border-surface-border dark:border-surface-dark-border" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-2/3 rounded" />
        ))}
      </div>
      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 py-2.5 items-center border-b border-surface-border/40 dark:border-surface-dark-border/40 last:border-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn(
                'h-3 rounded',
                c === 0 ? 'w-4/5' : c === cols - 1 ? 'w-1/2 ml-auto' : 'w-2/3'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/**
 * Standard Card List Skeleton (Stacked rows for Orders, Invoices, Reviews, Disputes, etc.)
 */
export const CardListSkeleton: React.FC<{
  count?: number;
  className?: string;
}> = ({ count = 3, className }) => (
  <div className={cn('space-y-3', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3.5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-44 max-w-full rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center">
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Standard Responsive Card Grid Skeleton (Entities, Applications, Verifications, etc.)
 */
export const CardGridSkeleton: React.FC<{
  count?: number;
  cols?: 2 | 3 | 4;
  className?: string;
}> = ({ count = 3, cols = 3, className }) => {
  const colClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[cols] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={cn('grid gap-4', colClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
              <div className="space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            </div>
            <Skeleton className="h-5 w-14 rounded-full shrink-0" />
          </div>
          <div className="space-y-1.5 py-1">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
          <div className="pt-2 border-t border-surface-border dark:border-surface-dark-border flex items-center justify-between">
            <Skeleton className="h-3.5 w-16 rounded" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Product Card Grid Skeleton (POS & Store Catalog)
 */
export const ProductGridSkeleton: React.FC<{
  count?: number;
  className?: string;
}> = ({ count = 4, className }) => (
  <div className={cn('grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card p-3 flex flex-col justify-between space-y-2">
        <Skeleton className="aspect-[4/3] rounded-btn w-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
        <Skeleton className="h-7 w-full rounded-btn mt-2" />
      </div>
    ))}
  </div>
);

/**
 * Product Card Skeleton (Single item list or grid mode)
 */
export const ProductCardSkeleton: React.FC<{ viewMode?: 'grid' | 'list'; className?: string }> = ({
  viewMode = 'grid',
  className = '',
}) => {
  if (viewMode === 'list') {
    return (
      <div className={cn('card overflow-hidden flex flex-row items-center p-2.5 gap-4 border border-surface-border dark:border-surface-dark-border', className)}>
        <Skeleton className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-lg" />
        <div className="flex-1 min-w-0 py-1 space-y-2">
          <Skeleton className="w-24 h-3 rounded" />
          <Skeleton className="w-3/4 h-4 rounded" />
          <div className="flex items-end justify-between pt-1">
            <Skeleton className="w-20 h-5 rounded" />
            <Skeleton className="w-14 h-3 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('card overflow-hidden flex flex-col h-full bg-white dark:bg-gray-800 border border-surface-border dark:border-surface-dark-border', className)}>
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-3.5 flex flex-col flex-1">
        <Skeleton className="w-full h-4 mb-2 rounded" />
        <Skeleton className="w-2/3 h-3 mb-4 rounded" />
        <div className="mt-auto pt-2 flex justify-between items-center border-t border-surface-border/40 dark:border-surface-dark-border/40">
          <Skeleton className="w-16 h-4 rounded" />
          <Skeleton className="w-12 h-3 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * Chart Skeleton (Area, Bar, or Pie)
 */
export const ChartSkeleton: React.FC<{
  type?: 'area' | 'bar' | 'pie';
  className?: string;
}> = ({ type = 'area', className }) => (
  <div className={cn('card p-5 flex flex-col h-[320px] justify-between', className)}>
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-4 w-32 rounded" />
      <Skeleton className="h-4 w-12 rounded" />
    </div>
    <div className="flex-1 w-full flex items-end gap-2 pb-4 pt-2">
      {type === 'pie' ? (
        <div className="flex items-center justify-center w-full h-full">
          <Skeleton className="w-40 h-40 rounded-full" />
        </div>
      ) : (
        Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end h-full gap-1 items-center">
            <Skeleton
              className="w-full rounded-t"
              style={{ height: `${Math.max(20, Math.floor(Math.sin((i + 1) * 0.8) * 80 + 30))}%` }}
            />
            <Skeleton className="h-2.5 w-6 rounded" />
          </div>
        ))
      )}
    </div>
  </div>
);

/**
 * Form Skeleton
 */
export const FormSkeleton: React.FC<{
  fields?: number;
  className?: string;
}> = ({ fields = 4, className }) => (
  <div className={cn('card p-5 space-y-4', className)}>
    <div className="space-y-1 pb-2 border-b border-surface-border dark:border-surface-dark-border">
      <Skeleton className="h-5 w-40 rounded" />
      <Skeleton className="h-3.5 w-64 rounded" />
    </div>
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="space-y-1.5">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    ))}
    <div className="pt-2 flex justify-end gap-2">
      <Skeleton className="h-9 w-20 rounded-lg" />
      <Skeleton className="h-9 w-28 rounded-lg" />
    </div>
  </div>
);

/**
 * Kanban Board Skeleton
 */
export const KanbanSkeleton: React.FC<{
  columns?: number;
  className?: string;
}> = ({ columns = 4, className }) => (
  <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
    {Array.from({ length: columns }).map((_, c) => (
      <div key={c} className="card p-3 space-y-3 bg-surface-muted/30 dark:bg-[#141414]">
        <div className="flex items-center justify-between pb-2 border-b border-surface-border dark:border-surface-dark-border">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-6 rounded-full" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-3 space-y-2 bg-white dark:bg-[#1a1a1a]">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
            <div className="pt-2 flex justify-between items-center">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="w-5 h-5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

/**
 * Chat Skeleton
 */
export const ChatSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('card overflow-hidden flex flex-col h-[500px]', className)}>
    <div className="p-3.5 border-b border-surface-border dark:border-surface-dark-border flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
    </div>
    <div className="flex-1 p-4 space-y-3 overflow-hidden flex flex-col justify-end">
      <div className="flex items-start gap-2 max-w-[70%]">
        <Skeleton className="w-7 h-7 rounded-full shrink-0" />
        <Skeleton className="h-14 w-52 rounded-2xl" />
      </div>
      <div className="flex items-start gap-2 max-w-[70%] self-end">
        <Skeleton className="h-10 w-44 rounded-2xl" />
      </div>
      <div className="flex items-start gap-2 max-w-[70%]">
        <Skeleton className="w-7 h-7 rounded-full shrink-0" />
        <Skeleton className="h-16 w-60 rounded-2xl" />
      </div>
    </div>
    <div className="p-3 border-t border-surface-border dark:border-surface-dark-border flex gap-2">
      <Skeleton className="h-9 flex-1 rounded-lg" />
      <Skeleton className="h-9 w-10 rounded-lg" />
    </div>
  </div>
);

export default Skeleton;
