import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Package, Megaphone, ShoppingCart, Shield, CreditCard, Settings, HelpCircle, Wallet, Lightbulb, FileText, ChevronLeft, ChevronRight, QrCode, Menu, ArrowDownToLine } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useAuth, useUserRoles } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import SettingsPage from './SettingsPage';
import HelpCenterPage from './HelpCenterPage';
import DashboardOverview from './DashboardOverview';
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
import SubscriptionExpiredView from './SubscriptionExpiredView';

// ============ Dashboard Layout ============
const DashboardLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  const sidebarRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipeGestureRef = useRef<boolean | null>(null);
  const currentDragXRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const closeTimerRef = useRef<any>(null);

  // Auto-close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsClosing(false);
    setHasEntered(false);
  }, [location.pathname]);

  // Clean up close timer on unmount
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
    if (logoRef.current) {
      logoRef.current.style.animation = '';
      logoRef.current.style.transition = 'none';
      logoRef.current.style.transform = '';
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
      if (logoRef.current) {
        logoRef.current.style.transform = '';
        logoRef.current.style.transition = '';
        logoRef.current.style.animation = '';
      }
    }, 220);
  };

  // Lock body scroll and handle Escape key when mobile menu is open
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMobileMenuAnimated();
      }
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

    // Detect gesture direction after small movement threshold (6px)
    if (isSwipeGestureRef.current === null) {
      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);
      if (absX > 6 || absY > 6) {
        // Horizontal left swipe
        if (absX > absY && diffX < -3) {
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
          if (logoRef.current) {
            logoRef.current.style.animation = 'none';
            logoRef.current.style.transition = 'none';
            logoRef.current.classList.remove('animate-logo-shake', 'animate-logo-recoil');
          }
        } else {
          isSwipeGestureRef.current = false;
        }
      }
    }

    if (isSwipeGestureRef.current) {
      // Only drag to the left (<= 0)
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

      // Reactive logo feedback: as the drawer is pulled left, the logo tilts back in perspective and leans away
      if (logoRef.current) {
        const tiltX = -progress * 16;
        const tiltZ = -progress * 3.5;
        const nudgeX = -progress * 6;
        logoRef.current.style.transform = `perspective(400px) rotateX(${tiltX}deg) rotateZ(${tiltZ}deg) translateX(${nudgeX}px)`;
      }
    }
  };

  const handleTouchEnd = () => {
    if (isClosing) return;

    if (isSwipeGestureRef.current) {
      const dragX = currentDragXRef.current;
      const drawerWidth = drawerRef.current?.offsetWidth || 288;
      if (dragX < -50 || Math.abs(dragX) / drawerWidth > 0.2) {
        // Swiped past threshold -> close with smooth animation
        closeMobileMenuAnimated();
      } else {
        // Released before threshold -> spring back to open position
        if (drawerRef.current) {
          drawerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          drawerRef.current.style.transform = 'translateX(0)';
        }
        if (backdropRef.current) {
          backdropRef.current.style.transition = 'opacity 0.25s ease-out';
          backdropRef.current.style.opacity = '1';
        }
        if (logoRef.current) {
          logoRef.current.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
          logoRef.current.style.transform = 'perspective(400px) rotateX(0deg) rotateZ(0deg) translateX(0)';
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

  const roles = useUserRoles();

  // Pure customers must NEVER access the seller dashboard - redirect to settings
  if (roles.isPureCustomer) {
    return <Navigate to="/settings" replace />;
  }

  // When seller subscription has expired or user cannot access seller tools, lock out the entire dashboard and show renewal view
  if (roles.isExpiredSeller || !roles.canAccessSellerDashboard) {
    return <SubscriptionExpiredView />;
  }

  const isBusiness = roles.isBusiness;
  const isWorker = roles.isTeamMember;
  const isSuperuser = roles.isSuperuser;
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
        aria-label={t('seller_dashboard_menu', 'Seller Dashboard Menu')}
        title={t('seller_dashboard_menu', 'Seller Dashboard Menu')}
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
              {/* Drawer Header (Aligned horizontally with dashboard page headings) */}
              <div className="pb-2">
                <h2 className="font-bold text-2xl text-gray-900 dark:text-white truncate tracking-tight">
                  {t('seller_dashboard', 'Seller Dashboard')}
                </h2>
                {user?.username && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight mt-1 font-medium">
                    @{user.username}
                  </p>
                )}
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeMobileMenuAnimated}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm transition ${
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

                {isSuperuser && (
                  <Link
                    to="/staff-admin"
                    onClick={closeMobileMenuAnimated}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm text-brand-500 dark:text-brand-500 font-bold hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition"
                  >
                    <Shield size={18} className="shrink-0" />
                    <span className="truncate">{t('staff_admin', 'Staff Admin')}</span>
                  </Link>
                )}

                <Link
                  to="/dashboard/settings"
                  onClick={closeMobileMenuAnimated}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm transition ${
                    location.pathname.startsWith('/dashboard/settings')
                      ? 'text-brand-500 dark:text-brand-500 font-bold'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50 font-medium'
                  }`}
                >
                  <Settings size={18} className="shrink-0" />
                  <span className="truncate">{t('account_settings', 'Account Settings')}</span>
                </Link>
                <Link
                  to="/dashboard/help-center"
                  onClick={closeMobileMenuAnimated}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm transition ${
                    location.pathname.startsWith('/dashboard/help-center')
                      ? 'text-brand-500 dark:text-brand-500 font-bold'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50 font-medium'
                  }`}
                >
                  <HelpCircle size={18} className="shrink-0" />
                  <span className="truncate">{t('help_center', 'Help Center')}</span>
                </Link>
              </nav>
            </div>

            {/* Store QR Code at bottom of mobile drawer */}
            {user?.username && (
              <div className="pt-3 mt-4 text-center select-none space-y-2">
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
                    onClick={() => {
                      downloadStoreQrCode();
                      closeMobileMenuAnimated();
                    }}
                    className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white hover:underline transition cursor-pointer"
                  >
                    <ArrowDownToLine size={12} className="shrink-0" />
                    <span>Download QR</span>
                  </button>
                  <Link
                    to={`/${user.username}`}
                    onClick={closeMobileMenuAnimated}
                    className="block text-2xs text-gray-500 hover:text-brand-600 dark:text-neutral-400 dark:hover:text-brand-400 hover:underline transition truncate"
                  >
                    View Storefront &rarr;
                  </Link>
                </div>
              </div>
            )}
          </aside>

          {/* Centered Brand Logo - Seamlessly visible above the drawer & backdrop at navbar height with physical inertia shake */}
          <div 
            className="fixed left-1/2 -translate-x-1/2 flex items-center justify-center shrink-0 z-50 pointer-events-auto select-none"
            style={{ top: 'env(safe-area-inset-top, 0px)', height: '3.5rem' }}
          >
            <div ref={logoRef} className={`origin-bottom flex items-center justify-center ${
              isClosing ? 'animate-logo-recoil' : !hasEntered ? 'animate-logo-shake' : ''
            }`} style={{ willChange: 'transform' }}>
              <Link to="/" onClick={closeMobileMenuAnimated} className="flex items-center group">
                <img 
                  src="/logo_dark.png"
                  alt="OKO Logo" 
                  className="h-14 md:h-16 w-auto object-contain transition-transform duration-200 hover:scale-105 select-none"
                />
              </Link>
            </div>
          </div>
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
              <Link
                to="/staff-admin"
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-btn text-sm text-brand-500 dark:text-brand-500 font-bold   transition`}
                title={isSidebarCollapsed ? t('staff_admin', 'Staff Admin') : undefined}
              >
                <Shield size={18} className="shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">{t('staff_admin', 'Staff Admin')}</span>}
              </Link>
            )}

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
          <Route path="analytics" element={<Navigate to="/dashboard" replace />} />
          <Route path="products" element={(!isWorker || perms.manage_products) ? <DashboardProducts /> : <Navigate to="/dashboard" replace />} />
          <Route path="product-requests" element={(!isWorker || perms.manage_products) ? <ProductRequestsBoard /> : <Navigate to="/dashboard" replace />} />
          <Route path="pos" element={(!isWorker || perms.manage_orders) ? <DashboardPOS /> : <Navigate to="/dashboard" replace />} />
          <Route path="orders" element={(!isWorker || perms.manage_orders) ? <DashboardOrders /> : <Navigate to="/dashboard" replace />} />
          <Route path="invoices" element={(!isWorker || perms.manage_orders) ? <InvoicesPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="promotions" element={(!isWorker || perms.manage_products) ? <DashboardPromotions /> : <Navigate to="/dashboard" replace />} />
          <Route path="billing" element={(!isWorker || perms.view_analytics) ? <BillingPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="payment-numbers" element={(!isWorker || perms.view_analytics) ? <PaymentNumbersManager /> : <Navigate to="/dashboard" replace />} />
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
