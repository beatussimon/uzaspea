import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Breadcrumb {
  label: string;
  path?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-1.5 mb-6', className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none mb-1">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {crumb.path && !isLast ? (
                  <Link to={crumb.path} className="hover:text-gray-900 dark:hover:text-white transition">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={cn(isLast && 'font-bold text-gray-700 dark:text-gray-300')}>
                    {crumb.label}
                  </span>
                )}
                {!isLast && <ChevronRight size={10} className="shrink-0" />}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Main Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-heading-md font-black tracking-tight text-gray-900 dark:text-white uppercase">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
