import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, FileText, Package, 
  Wallet, CreditCard, MessageSquare, 
  Lightbulb, ChevronLeft, ChevronRight, AlertCircle, Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import TeamsAccessDenied from './TeamsAccessDenied';
import TeamsOverview from './TeamsOverview';

// Shared operational modules
import DashboardOrders from '../dashboard/DashboardOrders';
import InvoicesPage from '../dashboard/InvoicesPage';
import DashboardPOS from '../dashboard/DashboardPOS';
import DashboardProducts from '../dashboard/DashboardProducts';
import ProductRequestsBoard from '../dashboard/ProductRequestsBoard';
import MessagesPage from '../MessagesPage';
import BillingPage from '../dashboard/BillingPage';
import PaymentNumbersManager from '../dashboard/PaymentNumbersManager';
import MyTeamPage from '../dashboard/MyTeamPage';

export const TeamsDashboardLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  const sidebarRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipeGestureRef = useRef<boolean | null>(null);
  const currentDragXRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const closeTimerRef = useRef<any>(null);

  const closeMobileMenuInstant = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsMobileMenuOpen(false);
    setIsClosing(false);
    setHasEntered(false);
  };

  const handleNavAction = (targetPath: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    const isCurrent =
      location.pathname === targetPath ||
      (targetPath !== '/teams-dashboard' && location.pathname.startsWith(targetPath));

    if (isCurrent) {
      closeMobileMenuInstant();
      return;
    }

    navigate(targetPath);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    if (isMobileMenuOpen || isClosing || hasEntered) {
      setIsMobileMenuOpen(false);
      setIsClosing(false);
      setHasEntered(false);
    }
  }

  useLayoutEffect(() => {
    closeMobileMenuInstant();
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const closeMobileMenuAnimated = () => {
    if (isClosing) return;
    setIsClosing(true);

    if (drawerRef.current) {
      drawerRef.current.classList.remove('animate-slide-in-left');
      drawerRef.current.classList.add('animate-slide-out-left');
      drawerRef.current.style.animation = '';
      drawerRef.current.style.transition = 'transform 0.22s cubic-bezier(0.32, 0, 0.67, 0)';
      drawerRef.current.style.transform = 'translateX(-100%)';
    }
    if (backdropRef.current) {
      backdropRef.current.classList.remove('animate-fade-in');
      backdropRef.current.classList.add('animate-fade-out');
      backdropRef.current.style.animation = '';
      backdropRef.current.style.transition = 'opacity 0.22s ease-out';
      backdropRef.current.style.opacity = '0';
    }

    closeTimerRef.current = setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsClosing(false);
      setHasEntered(false);
      if (drawerRef.current) {
        drawerRef.current.style.transform = '';
        drawerRef.current.style.transition = '';
        drawerRef.current.style.animation = '';
        drawerRef.current.classList.remove('animate-slide-out-left');
      }
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '';
        backdropRef.current.style.transition = '';
        backdropRef.current.style.animation = '';
        backdropRef.current.classList.remove('animate-fade-out');
      }
    }, 220);
  };

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileMenuAnimated();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen, isClosing]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isClosing || e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isSwipeGestureRef.current = null;
    currentDragXRef.current = 0;
    hasDraggedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isClosing || e.touches.length !== 1) return;
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const diffX = touchX - touchStartXRef.current;
    const diffY = touchY - touchStartYRef.current;

    if (isSwipeGestureRef.current === null) {
      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);
      if (absX > 12 || absY > 12) {
        if (absX > absY && diffX < -10) {
          isSwipeGestureRef.current = true;
          hasDraggedRef.current = true;
          setHasEntered(true);
          if (drawerRef.current) {
            drawerRef.current.classList.remove('animate-slide-in-left', 'animate-slide-out-left');
            drawerRef.current.style.animation = 'none';
            drawerRef.current.style.transition = 'none';
          }
          if (backdropRef.current) {
            backdropRef.current.classList.remove('animate-fade-in', 'animate-fade-out');
            backdropRef.current.style.animation = 'none';
            backdropRef.current.style.transition = 'none';
          }
        } else {
          isSwipeGestureRef.current = false;
        }
      }
    }

    if (isSwipeGestureRef.current) {
      const dragX = Math.min(0, diffX);
      currentDragXRef.current = dragX;
      if (drawerRef.current) {
        drawerRef.current.style.transform = `translateX(${dragX}px)`;
      }
      const drawerWidth = drawerRef.current?.offsetWidth || 288;
      const progress = Math.min(1, Math.abs(dragX) / drawerWidth);
      if (backdropRef.current) {
        backdropRef.current.style.opacity = `${Math.max(0, 1 - progress * 0.8)}`;
      }
    }
  };

  const handleTouchEnd = () => {
    if (isClosing) return;
    if (isSwipeGestureRef.current) {
      const dragX = currentDragXRef.current;
      const drawerWidth = drawerRef.current?.offsetWidth || 288;
      if (dragX < -50 || Math.abs(dragX) / drawerWidth > 0.2) {
        closeMobileMenuAnimated();
      } else {
        if (drawerRef.current) {
          drawerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          drawerRef.current.style.transform = 'translateX(0)';
        }
        if (backdropRef.current) {
          backdropRef.current.style.transition = 'opacity 0.25s ease-out';
          backdropRef.current.style.opacity = '1';
        }
      }
    }
    isSwipeGestureRef.current = null;
    currentDragXRef.current = 0;
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 100);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  useEffect(() => {
    const updateStickyPosition = () => {
      const el = sidebarRef.current;
      if (!el) return;
      if (window.innerWidth < 1024) {
        el.style.position = '';
        el.style.top = '';
        return;
      }
      const navbarOffset = 88;
      const bottomMargin = 24;
      const windowHeight = window.innerHeight;
      const sidebarHeight = el.offsetHeight;
      if (sidebarHeight + navbarOffset + bottomMargin > windowHeight) {
        el.style.position = 'sticky';
        el.style.top = `${windowHeight - sidebarHeight - bottomMargin}px`;
      } else {
        el.style.position = 'sticky';
        el.style.top = `${navbarOffset}px`;
      }
    };
    updateStickyPosition();
    window.addEventListener('resize', updateStickyPosition, { passive: true });
    window.addEventListener('scroll', updateStickyPosition, { passive: true });
    return () => {
      window.removeEventListener('resize', updateStickyPosition);
      window.removeEventListener('scroll', updateStickyPosition);
    };
  }, [isSidebarCollapsed]);

  const rawPerms = (user?.team_permissions || {}) as Record<string, boolean>;
  const perms: Record<string, boolean> = {
    ...rawPerms,
    access_pos: !!(rawPerms.access_pos || rawPerms.pos_access),
    pos_access: !!(rawPerms.access_pos || rawPerms.pos_access),
  };
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
      show: !!(perms.access_pos || perms.pos_access) 
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
  ];

  const navItems = allNavItems.filter(item => item.show);

  return (
    <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-24 lg:pb-8 flex flex-col gap-6 print:p-0 print:m-0 print:gap-0 min-w-0">
      
      {/* Floating Mobile Hamburger Menu Button (Positioned on the left side) */}
      <button
        type="button"
        onClick={() => {
          setIsClosing(false);
          setHasEntered(false);
          setIsMobileMenuOpen(true);
        }}
        className="fixed z-40 p-3 rounded-full shadow-lg bg-white dark:bg-[#111111] text-gray-900 dark:text-white border border-gray-200 dark:border-[#222222] transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center lg:hidden print:hidden cursor-pointer select-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          left: '20px'
        }}
        aria-label={t('team_dashboard_menu', 'Team Dashboard Menu')}
        title={t('team_dashboard_menu', 'Team Dashboard Menu')}
      >
        <Menu size={20} />
      </button>

      {/* Mobile Slide-Over Navigation Drawer */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 lg:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onClickCapture={handleClickCapture}
        >
          {/* Backdrop */}
          <div 
            ref={backdropRef}
            className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity ${
              isClosing ? 'animate-fade-out' : hasEntered ? '' : 'animate-fade-in'
            }`}
            onClick={closeMobileMenuAnimated}
          />

          {/* Drawer */}
          <aside 
            ref={drawerRef}
            className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-[#0A0A0A] z-50 flex flex-col justify-between p-4 pt-[calc(env(safe-area-inset-top,0px)+5.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] shadow-2xl overflow-y-auto ${
              isClosing ? 'animate-slide-out-left' : hasEntered ? '' : 'animate-slide-in-left'
            }`}
            style={{ touchAction: 'pan-y', willChange: 'transform' }}
            onAnimationEnd={(e) => {
              if (e.animationName === 'slide-in-left' && drawerRef.current) {
                setHasEntered(true);
                drawerRef.current.classList.remove('animate-slide-in-left');
              }
            }}
          >
            <div className="space-y-4">
              <div className="pb-2">
                <h2 className="font-bold text-2xl text-gray-900 dark:text-white truncate tracking-tight">
                  {t('team_portal', 'Team Portal')}
                </h2>
                {user?.username && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight mt-1 font-medium">
                    @{user.username}{user?.team_role_label ? ` • ${user.team_role_label}` : ''}
                  </p>
                )}
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = item.exact 
                    ? location.pathname === item.path 
                    : location.pathname === item.path || (item.path !== '/teams-dashboard' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavAction(item.path);
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm cursor-pointer touch-manipulation select-none active:scale-[0.98] transition-all ${
                        isActive
                          ? 'text-brand-500 dark:text-brand-500 font-bold'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50 font-medium'
                      }`}
                    >
                      <item.icon size={18} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Warnings if suspended or inactive */}
      {isSuspended && (
        <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <h4 className="font-semibold">Team Access Suspended</h4>
            <p className="mt-0.5 text-gray-600 dark:text-gray-400">Your membership is currently suspended. Please contact your store owner.</p>
          </div>
        </div>
      )}

      {isOwnerSubInactive && (
        <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <h4 className="font-semibold">Business Plan Expired</h4>
            <p className="mt-0.5 text-gray-600 dark:text-gray-400">The business subscription for this store is inactive. Please notify the store owner to renew.</p>
          </div>
        </div>
      )}

      {/* Layout Body */}
      <div className="flex flex-col lg:flex-row gap-6 print:gap-0 print:m-0 items-start w-full min-w-0">
        
        {/* Sticky Sidebar on Desktop - hidden on mobile in favor of floating hamburger menu */}
        <aside 
          ref={sidebarRef}
          className={`w-full ${isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-56'} transition-all duration-300 shrink-0 relative h-fit hidden lg:block`}
        >
          {/* Toggle Expand/Collapse Button (Never clipped) */}
          <button 
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex absolute -right-3 top-4 w-6 h-6 items-center justify-center bg-white dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border rounded-full p-0 shadow-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors z-30 cursor-pointer"
            title={isSidebarCollapsed ? t('expand', 'Expand') : t('collapse', 'Collapse')}
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <nav className="p-2 space-y-1 relative">
            <div>
              {navItems.map((item) => {
                const isActive = item.exact 
                  ? location.pathname === item.path 
                  : location.pathname === item.path || (item.path !== '/teams-dashboard' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center h-10 ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} rounded-btn text-sm transition ${
                      isActive
                        ? 'text-brand-500 dark:text-brand-500 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50'
                    }`}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon size={18} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 min-w-0 animate-fade-in w-full lg:pt-2">
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
              element={(perms.access_pos || perms.pos_access) ? <DashboardPOS /> : <TeamsAccessDenied requiredPermission="access_pos" moduleName="Point of Sale" />} 
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
              element={<Navigate to="/teams-dashboard" replace />} 
            />
            
            <Route path="my-role" element={<MyTeamPage />} />
            
            <Route path="*" element={<Navigate to="/teams-dashboard" replace />} />
          </Routes>
        </main>

      </div>
    </div>
  );
};

export default TeamsDashboardLayout;
