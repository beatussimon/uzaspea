import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Megaphone, ShoppingCart, Shield, CreditCard, Settings, HelpCircle, Wallet } from 'lucide-react';
import SettingsPage from './SettingsPage';
import HelpCenterPage from './HelpCenterPage';

import DashboardOverview from './DashboardOverview';
import DashboardProducts from './DashboardProducts';
import DashboardPromotions from './DashboardPromotions';
import DashboardOrders from './DashboardOrders';
import PaymentNumbersManager from './PaymentNumbersManager';
import BillingPage from './BillingPage';
import TeamManagerPage from './TeamManagerPage';

// ============ Dashboard Layout ============
const DashboardLayout: React.FC = () => {
  const location = useLocation();

  const isBusiness = localStorage.getItem('tier') === 'business';
  const isSuperuser = localStorage.getItem('is_superuser') === 'true';

  const navItems = [
    { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { path: '/dashboard/products', label: 'Products', icon: Package },
    { path: '/dashboard/orders', label: 'Incoming Orders', icon: ShoppingCart },
    { path: '/dashboard/promotions', label: 'Promotions', icon: Megaphone },
    { path: '/dashboard/billing', label: 'Billing & Commission', icon: Wallet },
    { path: '/dashboard/payment-numbers', label: 'Payment Numbers', icon: CreditCard },
  ];

  if (isBusiness) {
    navItems.push({ path: '/dashboard/team', label: 'Team Members', icon: Shield });
  }

  return (
    <div className="max-w-6xl mx-auto p-4 flex flex-col lg:flex-row gap-6">
      {/* Sidebar */}
      <aside className="w-full lg:w-56 shrink-0">
        <nav className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {isSuperuser && (
            <>
              <hr className="my-2 border-gray-100 dark:border-gray-700" />
              <Link
                to="/staff-admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-brand-600 dark:text-brand-400 font-bold hover:bg-brand-50 dark:hover:bg-brand-900/10 transition"
              >
                <Shield size={18} />
                Staff Admin
              </Link>
            </>
          )}

          <hr className="my-2 border-gray-100 dark:border-gray-700" />
          <Link
            to="/dashboard/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
              location.pathname.startsWith('/dashboard/settings')
                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Settings size={18} />
            Account Settings
          </Link>
          <Link
            to="/dashboard/help-center"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
              location.pathname.startsWith('/dashboard/help-center')
                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <HelpCircle size={18} />
            Help Center
          </Link>
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 animate-fade-in">
        <Routes>
          <Route index element={<DashboardOverview />} />
          <Route path="products" element={<DashboardProducts />} />
          <Route path="orders" element={<DashboardOrders />} />
          <Route path="promotions" element={<DashboardPromotions />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="payment-numbers" element={<PaymentNumbersManager />} />
          {isBusiness && <Route path="team" element={<TeamManagerPage />} />}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help-center" element={<HelpCenterPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default DashboardLayout;
