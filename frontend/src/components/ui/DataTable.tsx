import React from 'react';
import { cn } from '../../lib/utils';

export interface Column<T> {
  header: string;
  accessor: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full overflow-hidden card', className)}>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-surface-border dark:border-surface-dark-border bg-surface-muted dark:bg-[#111]/40 text-2xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none">
              {columns.map((col, idx) => (
                <th key={idx} className={cn('px-6 py-3.5 font-bold', col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border text-sm text-gray-700 dark:text-gray-300">
            {loading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r} className="border-b border-surface-border/40 dark:border-surface-dark-border/40">
                  {columns.map((col, c) => (
                    <td key={c} className={cn('px-6 py-4', col.className)}>
                      <div
                        className={cn(
                          'relative overflow-hidden bg-gray-200 dark:bg-white/5 h-4 rounded-md animate-pulse',
                          c === 0 ? 'w-4/5' : c === columns.length - 1 ? 'w-1/2 ml-auto' : 'w-2/3'
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-xs font-bold uppercase tracking-wider text-gray-400 select-none">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={cn(
                    'transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-surface-muted dark:hover:bg-white/5' : 'hover:bg-surface-muted/30 dark:hover:bg-white/[0.02]'
                  )}
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={cn('px-6 py-4.5', col.className)}>
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
