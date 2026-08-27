import React, { Suspense, lazy, useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, FileText, Package, 
  Wallet, CreditCard, TrendingUp, Shield, MessageSquare, 
  Lightbulb, ChevronLeft, ChevronRight, AlertCircle, Store,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../components/ui/Spinner';
import TeamsAccessDenied from './TeamsAccessDenied';
import TeamsOverview from './TeamsOverview';

// Lazy load shared operational modules
const DashboardOrders = lazy(() => import('../dashboard/DashboardOrders'));
const InvoicesPage = lazy(() => import('../dashboard/InvoicesPage'));
const DashboardPOS = lazy(() => import('../dashboard/DashboardPOS'));
const DashboardProducts = lazy(() => import('../dashboard/DashboardProducts'));
const ProductRequestsBoard = lazy(() => import('../dashboard/ProductRequestsBoard'));
const MessagesPage = lazy(() => import('../MessagesPage'));
const BillingPage = lazy(() => import('../dashboard/BillingPage'));
const PaymentNumbersManager = lazy(() => import('../dashboard/PaymentNumbersManager'));
const DashboardAnalytics = lazy(() => import('../dashboard/DashboardAnalytics'));
const MyTeamPage = lazy(() => import('../dashboard/MyTeamPage'));

export const TeamsDashboardLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const perms = user?.team_permissions || {};
  const isSuspended = user?.is_team_suspended;
  const isOwnerSubInactive = user?.is_owner_subscription_active === false;

  const allNavItems = [
    { 
      path: '/teams-dashboard', 
      label: t('overview', 'Overview'), 
      icon: LayoutDashboard, 
      show: true,
      exact: true
    },
    { 
      path: '/teams-dashboard/orders', 
      label: t('incoming_orders', 'Orders'), 
      icon: ShoppingCart, 
      show: !!perms.manage_orders 
    },
    { 
      path: '/teams-dashboard/invoices', 
      label: t('invoices_and_quotes', 'Invoices & Quotes'), 
      icon: FileText, 
      show: !!perms.manage_invoices 
    },
    { 
      path: '/teams-dashboard/pos', 
      label: t('point_of_sale', 'Point of Sale'), 
      icon: ShoppingCart, 
      show: !!perms.access_pos 
    },
    { 
      path: '/teams-dashboard/products', 
      label: t('products', 'Products & Stock'), 
      icon: Package, 
      show: !!perms.manage_products 
    },
    { 
      path: '/teams-dashboard/product-requests', 
      label: t('product_requests', 'Product Requests'), 
      icon: Lightbulb, 
      show: !!(perms.manage_requests || perms.manage_products) 
    },
    { 
      path: '/teams-dashboard/messages', 
      label: t('customer_messages', 'Messages'), 
      icon: MessageSquare, 
      show: !!perms.manage_messages 
    },
    { 
      path: '/teams-dashboard/payment-numbers', 
      label: t('payment_numbers', 'Payment Numbers'), 
      icon: CreditCard, 
      show: !!(perms.manage_payment_numbers || perms.manage_payments) 
    },
    { 
      path: '/teams-dashboard/billing', 
      label: t('billing_ledger', 'Billing & Ledger'), 
      icon: Wallet, 
      show: !!perms.manage_billing 
    },
    { 
      path: '/teams-dashboard/analytics', 
      label: t('analytics', 'Analytics'), 
      icon: TrendingUp, 
      show: !!perms.view_analytics 
    },
    { 
      path: '/teams-dashboard/my-role', 
      label: t('my_role_profile', 'My Role'), 
      icon: Shield, 
      show: true 
    },
  ];

  const navItems = allNavItems.filter(item => item.show);

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col gap-6 print:p-0 print:m-0">
      
      {/* Header Bar */}
      <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {user?.business_name || `@${user?.team_owner_username || 'business'}`}
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
                {user?.team_role_label || 'Team Member'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Logged in as @{user?.username} • Store Owner: @{user?.team_owner_username}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Warnings if suspended or inactive */}
      {isSuspended && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <h4 className="font-semibold">Team Access Suspended</h4>
            <p className="mt-0.5 text-gray-600 dark:text-gray-400">Your membership is currently suspended. Please contact your store owner.</p>
          </div>
        </div>
      )}

      {isOwnerSubInactive && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <h4 className="font-semibold">Business Plan Expired</h4>
            <p className="mt-0.5 text-gray-600 dark:text-gray-400">The business subscription for this store is inactive. Please notify the store owner to renew.</p>
          </div>
        </div>
      )}

      {/* Layout Body */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Sidebar */}
        <aside className={`w-full ${isSidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-56'} transition-all duration-200 shrink-0`}>
          <nav className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-xl p-2 space-y-1 relative h-full">
            
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex absolute -right-3 top-4 bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-full p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shadow-sm z-10"
              title={isSidebarCollapsed ? t('expand', 'Expand') : t('collapse', 'Collapse')}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>

            {navItems.map((item) => {
              const isActive = item.exact 
                ? location.pathname === item.path 
                : location.pathname === item.path || (item.path !== '/teams-dashboard' && location.pathname.startsWith(item.path));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-500 text-white dark:text-black font-semibold shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-900'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 min-w-0">
          <Suspense fallback={
            <div className="flex justify-center items-center py-16">
              <Spinner size="lg" />
            </div>
          }>
            <Routes>
              <Route index element={<TeamsOverview />} />
              
              <Route 
                path="orders/*" 
                element={perms.manage_orders ? <DashboardOrders /> : <TeamsAccessDenied requiredPermission="manage_orders" moduleName="Orders" />} 
              />
              
              <Route 
                path="invoices/*" 
                element={perms.manage_invoices ? <InvoicesPage /> : <TeamsAccessDenied requiredPermission="manage_invoices" moduleName="Invoices & Quotes" />} 
              />
              
              <Route 
                path="pos/*" 
                element={perms.access_pos ? <DashboardPOS /> : <TeamsAccessDenied requiredPermission="access_pos" moduleName="Point of Sale" />} 
              />
              
              <Route 
                path="products/*" 
                element={perms.manage_products ? <DashboardProducts /> : <TeamsAccessDenied requiredPermission="manage_products" moduleName="Products & Stock" />} 
              />
              
              <Route 
                path="product-requests/*" 
                element={(perms.manage_requests || perms.manage_products) ? <ProductRequestsBoard /> : <TeamsAccessDenied requiredPermission="manage_requests" moduleName="Product Requests" />} 
              />
              
              <Route 
                path="messages/*" 
                element={perms.manage_messages ? <MessagesPage /> : <TeamsAccessDenied requiredPermission="manage_messages" moduleName="Customer Messages" />} 
              />
              
              <Route 
                path="payment-numbers/*" 
                element={(perms.manage_payment_numbers || perms.manage_payments) ? <PaymentNumbersManager /> : <TeamsAccessDenied requiredPermission="manage_payment_numbers" moduleName="Payment Numbers" />} 
              />
              
              <Route 
                path="payments/*" 
                element={(perms.manage_payments || perms.manage_payment_numbers) ? <PaymentNumbersManager /> : <TeamsAccessDenied requiredPermission="manage_payments" moduleName="Payment Approvals" />} 
              />
              
              <Route 
                path="billing/*" 
                element={perms.manage_billing ? <BillingPage /> : <TeamsAccessDenied requiredPermission="manage_billing" moduleName="Billing & Ledger" />} 
              />
              
              <Route 
                path="analytics/*" 
                element={perms.view_analytics ? <DashboardAnalytics /> : <TeamsAccessDenied requiredPermission="view_analytics" moduleName="Sales Reports" />} 
              />
              
              <Route path="my-role" element={<MyTeamPage />} />
              
              <Route path="*" element={<Navigate to="/teams-dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>

      </div>
    </div>
  );
};

export default TeamsDashboardLayout;
