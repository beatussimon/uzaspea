import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

export interface DashboardNavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  show?: boolean;
  exact?: boolean;
  badge?: string | number;
  badgeColor?: string;
}

export interface DashboardMobileDrawerProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  navItems: DashboardNavItem[];
  footerContent?: React.ReactNode;
  menuButtonAriaLabel?: string;
  brandLogoUrl?: string;
}

export const DashboardMobileDrawer: React.FC<DashboardMobileDrawerProps> = ({
  title,
  subtitle,
  badgeText,
  navItems,
  footerContent,
  menuButtonAriaLabel = 'Dashboard Menu',
  brandLogoUrl = '/logo_dark.png',
}) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

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

  const visibleNavItems = navItems.filter((item) => item.show === undefined || item.show);

  return (
    <>
      {/* Floating Mobile Hamburger Menu Button (Positioned at bottom-left above mobile bottom dock) */}
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
          left: '20px',
        }}
        aria-label={menuButtonAriaLabel}
        title={menuButtonAriaLabel}
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

          {/* Drawer Container */}
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
              {/* Drawer Header */}
              <div className="pb-2 border-b border-surface-border dark:border-surface-dark-border">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-2xl text-gray-900 dark:text-white truncate tracking-tight">
                    {title}
                  </h2>
                  {badgeText && (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-500 border border-brand-500/20">
                      {badgeText}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight mt-1 font-medium">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1">
                {visibleNavItems.map((item) => {
                  const isActive =
                    item.exact !== undefined
                      ? item.exact
                        ? location.pathname === item.path
                        : location.pathname.startsWith(item.path)
                      : location.pathname === item.path ||
                        (item.path !== '/' &&
                          item.path !== '/staff-admin' &&
                          item.path !== '/staff' &&
                          item.path !== '/dashboard' &&
                          location.pathname.startsWith(item.path));

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeMobileMenuAnimated}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-btn text-sm transition ${
                        isActive
                          ? 'text-brand-500 font-bold bg-brand-500/5 dark:bg-brand-500/10'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <item.icon size={18} className="shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                            item.badgeColor ||
                            'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Optional Custom Footer / Quick Links */}
            {footerContent && (
              <div className="pt-4 border-t border-surface-border dark:border-surface-dark-border mt-4">
                {footerContent}
              </div>
            )}
          </aside>

          {/* Centered Brand Logo Overlay at Navbar Height with physics inertia animation */}
          <div
            className="fixed left-1/2 -translate-x-1/2 flex items-center justify-center shrink-0 z-50 pointer-events-auto select-none"
            style={{ top: 'env(safe-area-inset-top, 0px)', height: '3.5rem' }}
          >
            <div
              ref={logoRef}
              className={`origin-bottom flex items-center justify-center ${
                isClosing ? 'animate-logo-recoil' : !hasEntered ? 'animate-logo-shake' : ''
              }`}
              style={{ willChange: 'transform' }}
            >
              <Link to="/" onClick={closeMobileMenuAnimated} className="flex items-center group">
                <img
                  src={brandLogoUrl}
                  alt="App Logo"
                  className="h-14 md:h-16 w-auto object-contain transition-transform duration-200 hover:scale-105 select-none"
                />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardMobileDrawer;
