import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path: string;
}

const Breadcrumbs = ({ extra = [] }: { extra?: BreadcrumbItem[] }) => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Map path fragments to labels (optional customization)
  const labelMap: Record<string, string> = {
    staff: 'Staff Panel',
    'staff-admin': 'Admin Dashboard',
    inspections: 'Inspections',
    dashboard: 'User Dashboard',
    profile: 'Profile',
    products: 'Products',
    orders: 'Orders',
  };

  const breadcrumbs = pathnames.map((value, index) => {
    const last = index === pathnames.length - 1;
    const to = `/${pathnames.slice(0, index + 1).join('/')}`;
    
    return {
      label: labelMap[value] || value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' '),
      path: to,
      active: last && extra.length === 0,
    };
  });

  const allItems = [...breadcrumbs, ...extra];

  if (allItems.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 overflow-x-auto no-scrollbar whitespace-nowrap">
      <Link to="/" className="hover:text-brand-600 transition-colors flex items-center gap-1">
        <Home size={12} />
        <span>Home</span>
      </Link>
      
      {allItems.map((item, idx) => (
        <React.Fragment key={item.path}>
          <ChevronRight size={12} className="shrink-0" />
          {idx === allItems.length - 1 ? (
            <span className="text-gray-600 dark:text-gray-300 font-bold">{item.label}</span>
          ) : (
            <Link to={item.path} className="hover:text-brand-600 transition-colors">
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
