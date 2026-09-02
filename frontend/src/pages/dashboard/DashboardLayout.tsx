import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Megaphone, ShoppingCart, Shield, CreditCard, Settings, HelpCircle, Wallet, AlertCircle, Lightbulb, FileText, ChevronLeft, ChevronRight, TrendingUp, QrCode, Menu, X, ArrowDownToLine } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import SettingsPage from './SettingsPage';
import HelpCenterPage from './HelpCenterPage';
import DashboardOverview from './DashboardOverview';
import DashboardAnalytics from './DashboardAnalytics';
import DashboardProducts from './DashboardProducts';
import DashboardPromotions from './DashboardPromotions';
import DashboardOrders from './DashboardOrders';
import PaymentNumbersManager from './PaymentNumbersManager';
import BillingPage from './BillingPage';
import TeamManagerPage from './TeamManagerPage';
import MyTeamPage from './MyTeamPage';
import DashboardPOS from './DashboardPOS';
import ProductRequestsBoard from './ProductRequestsBoard';
import InvoicesPage from './InvoicesPage';

// ============ Dashboard Layout ============
const DashboardLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Auto-close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const updateStickyPosition = () => {
      const el = sidebarRef.current;
      if (!el) return;

      if (window.innerWidth < 1024) {
        el.style.position = '';
        el.style.top = '';
        return;
      }

      const navbarOffset = 88; // Top navbar clearance
      const bottomMargin = 24; // Margin at bottom
      const windowHeight = window.innerHeight;
      const sidebarHeight = el.offsetHeight;

      // When the sidebar is shorter than the viewport, stick cleanly at the top (under navbar)
      if (sidebarHeight + navbarOffset + bottomMargin <= windowHeight) {
        el.style.position = 'sticky';
        el.style.top = `${navbarOffset}px`;
      } else {
        // When sidebar is taller than viewport, stick so the bottom (including QR code) stays in full view
        const targetTop = windowHeight - sidebarHeight - bottomMargin;
        el.style.position = 'sticky';
        el.style.top = `${targetTop}px`;
      }
    };

    updateStickyPosition();
    window.addEventListener('resize', updateStickyPosition);
    window.addEventListener('scroll', updateStickyPosition, { passive: true });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && sidebarRef.current) {
      observer = new ResizeObserver(updateStickyPosition);
      observer.observe(sidebarRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateStickyPosition);
      window.removeEventListener('scroll', updateStickyPosition);
      if (observer) observer.disconnect();
    };
  }, [isSidebarCollapsed]);

  const isBusiness = user?.tier === 'business' || localStorage.getItem('tier') === 'business';
  const isWorker = user?.tier === 'worker' || localStorage.getItem('tier') === 'worker';
  const isSuperuser = user?.is_superuser || localStorage.getItem('is_superuser') === 'true';

  const perms = user?.team_permissions || {};

  const downloadStoreQrCode = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const svg = document.getElementById('store-sidebar-qr-svg') as SVGElement | null;
    if (!svg) {
      toast.error('Could not find QR code');
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const qrImg = new Image();
    const logoImg = new Image();
    logoImg.src = '/qr_black_logo.png';

    qrImg.onload = () => {
      const padding = 32;
      const qrSize = 360;
      canvas.width = qrSize + padding * 2;
      canvas.height = qrSize + padding * 2 + 50;
      if (ctx) {
        // Crisp White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw QR code
        ctx.drawImage(qrImg, padding, padding, qrSize, qrSize);

        const finishDownload = () => {
          // Draw center black logo on white cutout if loaded
          if (logoImg.complete && logoImg.naturalWidth > 0) {
            const logoSize = qrSize * 0.22;
            const logoX = (canvas.width - logoSize) / 2;
            const logoY = padding + (qrSize - logoSize) / 2;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            if (typeof (ctx as any).roundRect === 'function') {
              (ctx as any).roundRect(logoX - 4, logoY - 4, logoSize + 8, logoSize + 8, 6);
            } else {
              ctx.rect(logoX - 4, logoY - 4, logoSize + 8, logoSize + 8);
            }
            ctx.fill();

            ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
          }

          // Store text below
          ctx.fillStyle = '#111827';
          ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`@${user?.username || 'store'}`, canvas.width / 2, canvas.height - 28);

          ctx.fillStyle = '#6B7280';
          ctx.font = '500 12px system-ui, -apple-system, sans-serif';
          ctx.fillText('Scan to visit store on SokoniMax', canvas.width / 2, canvas.height - 12);

          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.download = `${user?.username || 'store'}-qr.png`;
          downloadLink.href = pngUrl;
          downloadLink.click();
          toast.success('Store QR code downloaded');
        };

        if (logoImg.complete) {
          finishDownload();
        } else {
          logoImg.onload = finishDownload;
          logoImg.onerror = finishDownload;
        }
      }
    };
    qrImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const allNavItems = [
    { path: '/dashboard', label: t('overview', 'Overview'), icon: LayoutDashboard, show: !isWorker || perms.view_analytics },
    { path: '/dashboard/analytics', label: t('analytics', 'Analytics'), icon: TrendingUp, show: !isWorker || perms.view_analytics },
    { path: '/dashboard/products', label: t('products', 'Products'), icon: Package, show: !isWorker || perms.manage_products },
    { path: '/dashboard/product-requests', label: t('product_requests', 'Product Requests'), icon: Lightbulb, show: !isWorker || perms.manage_products },
    { path: '/dashboard/orders', label: t('incoming_orders', 'Incoming Orders'), icon: ShoppingCart, show: !isWorker || perms.manage_orders },
    { path: '/dashboard/invoices', label: t('invoices_and_quotes', 'Invoices & Quotes'), icon: FileText, show: !isWorker || perms.manage_orders },
    { path: '/dashboard/promotions', label: t('promotions', 'Promotions'), icon: Megaphone, show: !isWorker || perms.manage_products },
    { path: '/dashboard/pos', label: t('point_of_sale', 'Point of Sale'), icon: ShoppingCart, show: !isWorker || perms.manage_orders },
    { path: '/dashboard/billing', label: t('billing_commission', 'Billing & Commission'), icon: Wallet, show: !isWorker || perms.view_analytics },
    { path: '/dashboard/payment-numbers', label: t('payment_numbers', 'Payment Numbers'), icon: CreditCard, show: !isWorker || perms.view_analytics },
    { path: '/dashboard/team', label: t('team_members', 'Team Members'), icon: Shield, show: isBusiness },
    { path: '/dashboard/my-team', label: t('teams', 'Teams'), icon: Shield, show: isWorker },
  ];

  const navItems = allNavItems.filter(item => item.show);

  return (
    <div className="max-w-6xl mx-auto p-4 flex flex-col gap-6 print:p-0 print:m-0 print:gap-0">
      {/* Expired Subscription Banner */}
      {user?.subscription_active === false && (
        <div className="  border border-red-500 dark:border-red-500 text-red-500 dark:text-red-500 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} className="text-red-500" />
            <div>
              <h4 className="font-bold">Subscription Expired</h4>
              <p className="text-sm">Your seller subscription has expired. Please renew it to keep your account active and avoid listing suspension.</p>
            </div>
          </div>
          <Link to="/dashboard/billing" className="btn-primary py-2 px-4 bg-red-500 hover:bg-red-500 border-none text-white text-sm whitespace-nowrap">
            Renew Now
          </Link>
        </div>
      )}

      {/* Floating Mobile Hamburger Menu Button */}
      <div className="fixed bottom-20 left-4 z-40 lg:hidden print:hidden animate-fade-in">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex items-center gap-2 bg-gray-900/95 dark:bg-neutral-900/95 text-white dark:text-gray-100 hover:bg-black dark:hover:bg-neutral-800 px-3.5 py-2.5 rounded-full shadow-xl border border-gray-700/60 dark:border-neutral-700/60 backdrop-blur-md transition-all active:scale-95 text-xs font-semibold select-none"
          aria-label="Open Dashboard Navigation"
          title="Dashboard Menu"
        >
          <Menu size={15} />
          <span>Menu</span>
        </button>
      </div>

      {/* Mobile Slide-Over Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-[#0A0A0A] border-r border-surface-border dark:border-surface-dark-border z-50 flex flex-col justify-between p-4 shadow-2xl overflow-y-auto animate-fade-in">
            <div className="space-y-4">
              {/* Drawer Close Button */}
              <div className="flex justify-end pb-1">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm transition ${
                        isActive
                          ? 'text-brand-500 dark:text-brand-500 font-medium bg-gray-50 dark:bg-neutral-900/40'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50'
                      }`}
                    >
                      <item.icon size={18} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}

                {isSuperuser && (
                  <>
                    <hr className="my-2 border-surface-border dark:border-surface-dark-border" />
                    <Link
                      to="/staff-admin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm text-brand-500 dark:text-brand-500 font-bold hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition"
                    >
                      <Shield size={18} className="shrink-0" />
                      <span className="truncate">{t('staff_admin', 'Staff Admin')}</span>
                    </Link>
                  </>
                )}

                <hr className="my-2 border-surface-border dark:border-surface-dark-border" />
                <Link
                  to="/dashboard/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm transition ${
                    location.pathname.startsWith('/dashboard/settings')
                      ? 'text-brand-500 dark:text-brand-500 font-medium bg-gray-50 dark:bg-neutral-900/40'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50'
                  }`}
                >
                  <Settings size={18} className="shrink-0" />
                  <span className="truncate">{t('account_settings', 'Account Settings')}</span>
                </Link>
                <Link
                  to="/dashboard/help-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm transition ${
                    location.pathname.startsWith('/dashboard/help-center')
                      ? 'text-brand-500 dark:text-brand-500 font-medium bg-gray-50 dark:bg-neutral-900/40'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50'
                  }`}
                >
                  <HelpCircle size={18} className="shrink-0" />
                  <span className="truncate">{t('help_center', 'Help Center')}</span>
                </Link>
              </nav>
            </div>

            {/* Store QR Code at bottom of mobile drawer */}
            {user?.username && (
              <div className="pt-3 border-t border-surface-border dark:border-surface-dark-border mt-4 text-center select-none space-y-2">
                <div className="bg-white p-3 rounded-2xl border border-gray-200/90 dark:border-neutral-700/80 flex justify-center items-center shadow-xs mx-auto w-fit">
                  <QRCodeSVG
                    value={`${window.location.origin}/${user.username}`}
                    size={104}
                    level="H"
                    includeMargin={false}
                    fgColor="#000000"
                    imageSettings={{
                      src: '/qr_black_logo.png',
                      height: 28,
                      width: 28,
                      excavate: true,
                    }}
                  />
                </div>
                <div className="space-y-1 pt-1 text-center">
                  <button
                    type="button"
                    onClick={downloadStoreQrCode}
                    className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white hover:underline transition cursor-pointer"
                  >
                    <ArrowDownToLine size={12} className="shrink-0" />
                    <span>Download QR</span>
                  </button>
                  <a
                    href={`/${user.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-2xs text-gray-500 hover:text-brand-600 dark:text-neutral-400 dark:hover:text-brand-400 hover:underline transition truncate"
                  >
                    View Storefront &rarr;
                  </a>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 print:gap-0 print:m-0 items-start">
        {/* Sticky Sidebar on Desktop - hidden on mobile in favor of floating hamburger menu */}
        <aside 
          ref={sidebarRef}
          className={`w-full ${isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-56'} transition-all duration-300 shrink-0 relative h-fit hidden lg:block`}
        >
          
          {/* Toggle Expand/Collapse Button (Never clipped) */}
          <button 
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex absolute -right-3 top-4 bg-white dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border rounded-full p-1 shadow-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors z-30"
            title={isSidebarCollapsed ? t('expand', 'Expand') : t('collapse', 'Collapse')}
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <nav className="bg-white dark:bg-[#0A0A0A] rounded-card shadow-sm border border-surface-border dark:border-surface-dark-border p-2 space-y-1 relative">
            <div>
              {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-btn text-sm transition ${
                    isActive
                      ? '  text-brand-500 dark:text-brand-500 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <item.icon size={18} className="shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}

            {isSuperuser && (
              <>
                <hr className="my-2 border-surface-border dark:border-surface-dark-border" />
                <Link
                  to="/staff-admin"
                  className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-btn text-sm text-brand-500 dark:text-brand-500 font-bold   transition`}
                  title={isSidebarCollapsed ? t('staff_admin', 'Staff Admin') : undefined}
                >
                  <Shield size={18} className="shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{t('staff_admin', 'Staff Admin')}</span>}
                </Link>
              </>
            )}

            <hr className="my-2 border-surface-border dark:border-surface-dark-border" />
            <Link
              to="/dashboard/settings"
              className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-btn text-sm transition ${
                location.pathname.startsWith('/dashboard/settings')
                  ? '  text-brand-500 dark:text-brand-500 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50'
              }`}
              title={isSidebarCollapsed ? t('account_settings', 'Account Settings') : undefined}
            >
              <Settings size={18} className="shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">{t('account_settings', 'Account Settings')}</span>}
            </Link>
            <Link
              to="/dashboard/help-center"
              className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-btn text-sm transition ${
                location.pathname.startsWith('/dashboard/help-center')
                  ? '  text-brand-500 dark:text-brand-500 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50'
              }`}
              title={isSidebarCollapsed ? t('help_center', 'Help Center') : undefined}
            >
              <HelpCircle size={18} className="shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">{t('help_center', 'Help Center')}</span>}
            </Link>
          </div>

          {/* Store QR Code at the end of the sidebar list */}
          {user?.username && (
            <div className="pt-2">
              <hr className="mb-2 border-surface-border dark:border-surface-dark-border" />
              {!isSidebarCollapsed ? (
                <div className="py-2 px-1 space-y-2 text-center select-none">
                  <div className="bg-white p-3 rounded-2xl border border-gray-200/90 dark:border-neutral-700/80 flex justify-center items-center shadow-xs mx-auto w-fit">
                    <QRCodeSVG
                      id="store-sidebar-qr-svg"
                      value={`${window.location.origin}/${user.username}`}
                      size={104}
                      level="H"
                      includeMargin={false}
                      fgColor="#000000"
                      imageSettings={{
                        src: '/qr_black_logo.png',
                        height: 28,
                        width: 28,
                        excavate: true,
                      }}
                    />
                  </div>
                  <div className="space-y-1 pt-1 text-center">
                    <button
                      type="button"
                      onClick={downloadStoreQrCode}
                      className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white hover:underline transition cursor-pointer"
                    >
                      <ArrowDownToLine size={12} className="shrink-0" />
                      <span>Download QR</span>
                    </button>
                    <a
                      href={`/${user.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-2xs text-gray-500 hover:text-brand-600 dark:text-neutral-400 dark:hover:text-brand-400 hover:underline transition truncate"
                    >
                      View Storefront &rarr;
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={downloadStoreQrCode}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900 transition flex items-center justify-center"
                    title="Download Store QR Code"
                  >
                    <QrCode size={18} />
                  </button>
                  <div className="hidden">
                    <QRCodeSVG
                      id="store-sidebar-qr-svg"
                      value={`${window.location.origin}/${user.username}`}
                      size={160}
                      level="H"
                      includeMargin={false}
                      fgColor="#000000"
                      imageSettings={{
                        src: '/qr_black_logo.png',
                        height: 42,
                        width: 42,
                        excavate: true,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 animate-fade-in w-full">
        <Routes>
          <Route index element={<DashboardOverview />} />
          <Route path="analytics" element={<DashboardAnalytics />} />
          <Route path="products" element={<DashboardProducts />} />
          <Route path="product-requests" element={<ProductRequestsBoard />} />
          <Route path="pos" element={<DashboardPOS />} />
          <Route path="orders" element={<DashboardOrders />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="promotions" element={<DashboardPromotions />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="payment-numbers" element={<PaymentNumbersManager />} />
          {isBusiness && <Route path="team" element={<TeamManagerPage />} />}
          {isWorker && <Route path="my-team" element={<MyTeamPage />} />}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help-center" element={<HelpCenterPage />} />
        </Routes>
      </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
