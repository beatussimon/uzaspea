import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Moon, Sun, Shield, User, Settings, ShoppingBag, 
  LayoutDashboard, ShieldCheck, LogOut, HelpCircle, 
  ChevronDown, PlusCircle, MessageSquare, ClipboardList, ShoppingCart, Globe, Heart, Search
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VerifiedBadge from '../VerifiedBadge';
import { useCart } from '../../context/CartContext';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMessages } from '../../context/MessageContext';
import { useSearch } from '../../context/SearchContext';

const Navbar = () => {
  const [profileOpen, setProfileOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { cartCount } = useCart();
  const { totalUnread: messageUnreadCount, toggleDesktopChat, isMessengerListOpen } = useMessages();
  const { openSearch } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();

  const [isAtTop, setIsAtTop] = useState(true);
  const lastScrollY = useRef(0);
  const currentOffset = useRef(0);
  const navbarRef = useRef<HTMLElement>(null);

  const isVerified = user?.is_verified || false;
  const userTier = user?.tier || 'free';
  const isStaff = user?.is_staff || false;
  const isInspector = user?.is_inspector || false;
  const isSuperuser = user?.is_superuser || false;
  const username = user?.username || 'User';
  const isSeller = userTier === 'seller_pro' || userTier === 'business' || isStaff || isSuperuser;

  // Reset scroll and state on route change (skip for modal product overlays)
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    const isModalOpen = !!(location.state as any)?.backgroundLocation;
    const isReturningFromProduct = prevPathRef.current.startsWith('/product/');
    prevPathRef.current = location.pathname;

    // Completely skip navbar reset if we are just opening or closing a modal overlay
    if (isModalOpen || isReturningFromProduct) {
      return;
    }

    setIsAtTop(true);
    currentOffset.current = 0;
    if (navbarRef.current) {
      navbarRef.current.style.transform = 'translateY(0px)';
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth scroll listener with direct 1:1 hardware-accelerated movement
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const snapContainer = document.querySelector('.snap-container') as HTMLElement;
          const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          const currentY = snapContainer 
            ? snapContainer.scrollTop 
            : Math.max(0, Math.min(maxScrollY, window.pageYOffset || document.documentElement.scrollTop));
          const delta = currentY - lastScrollY.current;
          const nav = navbarRef.current;

          // Toggle background class based on scroll position (120px ensures navbar is fully hidden before bg change)
          setIsAtTop(currentY < 120);

          if (nav) {
            const maxHide = nav.offsetHeight || 80;
            if (delta > 0) {
              // Scrolling down: hide the navbar instantly as we scroll
              currentOffset.current = Math.min(maxHide, currentOffset.current + delta);
              if (hideTimeout.current) clearTimeout(hideTimeout.current);
            } else if (delta < 0) {
              // Scrolling up: show the navbar instantly as we scroll
              if (currentY <= 60) {
                // Near top: snap to fully visible
                currentOffset.current = 0;
                if (hideTimeout.current) clearTimeout(hideTimeout.current);
              } else {
                currentOffset.current = Math.max(0, currentOffset.current + delta);
                
                // Auto-hide the navbar after a short delay when scrolling upwards
                if (hideTimeout.current) clearTimeout(hideTimeout.current);
                hideTimeout.current = setTimeout(() => {
                  if (navbarRef.current) {
                    const snapCheck = document.querySelector('.snap-container') as HTMLElement;
                    const yCheck = snapCheck ? snapCheck.scrollTop : window.pageYOffset;
                    if (yCheck > 120) {
                      currentOffset.current = maxHide;
                      navbarRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                      navbarRef.current.style.transform = `translateY(-${maxHide}px)`;
                      
                      // Remove transition after it completes so manual scrolling feels instant again
                      setTimeout(() => {
                        if (navbarRef.current) navbarRef.current.style.transition = '';
                      }, 400);
                    }
                  }
                }, 1500); // 1.5 seconds delay before auto-hiding
              }
            }
            nav.style.transform = `translateY(-${currentOffset.current}px)`;
          }

          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    handleScroll(); // Initial run
    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true } as any);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, []);


  // Close dropdowns on outside click
  useEffect(() => {
    const close = () => { 
      setProfileOpen(false); 
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);


  const isHomepage = location.pathname === '/';
  const useLightStyle = isDark || isHomepage;

  const bellClass = useLightStyle
    ? 'text-white/85 hover:text-white'
    : 'text-gray-600 dark:text-gray-300';

  const iconButtonClass = useLightStyle
    ? 'group relative p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300'
    : 'group relative p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-full transition-all duration-300';

  const getIconBtnClass = (isActive: boolean) => {
    if (!isActive) return iconButtonClass;
    return useLightStyle
      ? 'group relative p-2 text-white bg-white/20 rounded-full transition-all duration-300'
      : 'group relative p-2 text-black dark:text-brand-400 bg-gray-100 dark:bg-brand-900/20 rounded-full transition-all duration-300';
  };

  const themeButtonClass = useLightStyle
    ? 'group relative p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300'
    : 'group relative p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-full transition-all duration-300';

  const tooltipClass = "absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-bold rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[9999]";

  const navBackgroundClass = (isHomepage || isAtTop)
    ? 'bg-transparent border-none backdrop-blur-none shadow-none'
    : 'glass border-none shadow-sm';

  return (
    <nav 
      ref={navbarRef}
      className={`fixed top-0 inset-x-0 z-50 pt-safe transition-[background-color,backdrop-filter,box-shadow] duration-300 ${navBackgroundClass}`}
      style={{ willChange: 'transform' }}
    >
      <div className="container-page relative flex items-center justify-between h-14 md:h-20 w-full">

        {/* ---- Left Navigation Links ---- */}
        <div className="flex-1 max-w-[calc(50%-80px)] md:max-w-[calc(50%-100px)] lg:max-w-[380px] flex items-center justify-start pl-8 md:pl-12 gap-6">
          {/* Sell button (Only visible to verified sellers) */}
          {isAuthenticated && isSeller && (
            <Link 
              to="/dashboard/products#new" 
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full transition-all active:scale-95 shadow-sm ${
                useLightStyle
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900'
              }`}
            >
              <PlusCircle size={14} />
              <span>{t('sell')}</span>
            </Link>
          )}
          {[
            { path: '/', label: t('home', 'Home') },
            { path: '/products', label: t('products_nav') },
            { path: '/help', label: t('help') }
          ].map((link) => {
            const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
            return (
              <Link 
                key={link.path}
                to={link.path} 
                className={`relative hidden md:inline-flex items-center py-1 text-sm font-semibold transition-colors ${
                  isActive
                    ? (useLightStyle ? 'text-white' : 'text-gray-900 dark:text-white')
                    : (useLightStyle ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white')
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="navbar-active-indicator"
                    className={`absolute -bottom-1 left-0 right-0 h-0.5 rounded-full ${useLightStyle ? 'bg-white' : 'bg-brand-500 dark:bg-brand-400'}`}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* ---- Center: Centered Clickable Brand Logo ---- */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center shrink-0 z-20">
          <Link to="/" className="flex items-center group">
            <img 
              src="/logo_dark.png"
              alt="OKO Logo" 
              className="h-14 md:h-16 w-auto object-contain transition-transform duration-200 hover:scale-105 select-none"
            />
          </Link>
        </div>

        {/* ---- Right: Desktop Actions / Mobile Notifications ---- */}
        <div className="flex items-center justify-end flex-1 max-w-[calc(50%-80px)] md:max-w-[calc(50%-100px)] lg:max-w-[380px] gap-2.5 z-10">
          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-2">
            {isAuthenticated && (
              <>

                <Link to="/products?saved=true" className={getIconBtnClass(location.pathname === '/products' && location.search.includes('saved=true'))} aria-label="View saved items">
                  <Heart size={18} className={location.pathname === '/products' && location.search.includes('saved=true') ? (useLightStyle ? 'fill-white' : 'fill-black dark:fill-brand-400') : ''} />
                  <span className={tooltipClass}>{t('saved', 'Saved')}</span>
                </Link>

                <div className="group relative flex">
                  <NotificationBell className={getIconBtnClass(false)} activeClassName={getIconBtnClass(true)} />
                  <span className={tooltipClass}>{t('notifications', 'Notifications')}</span>
                </div>

                <button 
                  onClick={toggleDesktopChat} 
                  className={getIconBtnClass(isMessengerListOpen)} 
                  aria-label="View messages"
                >
                  <MessageSquare size={18} className={isMessengerListOpen ? (useLightStyle ? 'fill-white' : 'fill-black dark:fill-brand-400 text-black dark:text-brand-400') : ''} />
                  {messageUnreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-white dark:border-gray-950 animate-pulse">
                      {messageUnreadCount > 99 ? '99' : messageUnreadCount}
                    </span>
                  )}
                  <span className={tooltipClass}>{t('messages', 'Messages')}</span>
                </button>

                <Link to="/cart" className={getIconBtnClass(location.pathname === '/cart')} aria-label="View shopping cart">
                  <ShoppingCart size={18} className={location.pathname === '/cart' ? (useLightStyle ? 'fill-white' : 'fill-black dark:fill-brand-400 text-black dark:text-brand-400') : ''} />
                  {cartCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-white dark:border-gray-950">
                      {cartCount > 99 ? '99' : cartCount}
                    </span>
                  )}
                  <span className={tooltipClass}>{t('cart', 'Cart')}</span>
                </Link>

              </>
            )}

            {/* Core Utility Icons (Visible to All) */}
            <button onClick={openSearch} className={iconButtonClass} aria-label="Search">
              <Search size={18} />
              <span className={tooltipClass}>{t('search', 'Search')}</span>
            </button>

            <button onClick={toggleTheme} className={themeButtonClass} aria-label="Toggle theme">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
              <span className={tooltipClass}>{isDark ? t('light_mode', 'Light Mode') : t('dark_mode', 'Dark Mode')}</span>
            </button>
            <button 
              onClick={() => {
                const currentLang = i18n.language?.split('-')[0] || 'en';
                i18n.changeLanguage(currentLang === 'sw' ? 'en' : 'sw');
              }} 
              className={`${themeButtonClass} inline-flex items-center justify-center gap-1 min-w-[50px]`}
              aria-label="Toggle Language"
            >
              <Globe size={18} />
              <span className="text-[10px] font-bold uppercase">
                {i18n.language?.split('-')[0] || 'EN'}
              </span>
              <span className={tooltipClass}>{i18n.language?.split('-')[0] === 'sw' ? 'English' : 'Swahili'}</span>
            </button>
          </div>

          {/* User Profile / Login (Desktop & Mobile handles profile differently) */}
          <div className="hidden lg:block">
            {isAuthenticated ? (
              /* User Dropdown */
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => setProfileOpen(!profileOpen)} 
                  className={`group relative flex items-center gap-1 p-0.5 rounded-full transition-all focus:outline-none ${
                    profileOpen
                      ? (useLightStyle ? 'bg-white/20' : 'bg-gray-200 dark:bg-neutral-800 ring-2 ring-brand-500/20')
                      : (useLightStyle ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-neutral-900')
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner transition-colors ${
                    useLightStyle 
                      ? 'bg-white/20 text-white hover:bg-white/30' 
                      : 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                  }`}>
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown size={14} className={useLightStyle ? 'text-white/80 mr-0.5' : 'text-gray-400 dark:text-gray-500 mr-0.5'} />
                  <span className={tooltipClass}>{t('profile', 'Profile')}</span>
                </button>

                {profileOpen && (
                  <div className="absolute top-[calc(100%+8px)] right-0 w-72 bg-white dark:bg-black rounded-card shadow-card-hover border border-gray-100 dark:border-neutral-900 z-50 animate-scale-in overflow-hidden">
                    {/* Account Header */}
                    <div className="p-4 bg-gray-50/50 dark:bg-neutral-950/50 border-b border-gray-100 dark:border-neutral-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-white dark:ring-neutral-950">
                          {username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm text-gray-900 dark:text-white truncate leading-none">{username}</p>
                            <VerifiedBadge tier={userTier} isVerified={isVerified} className="shrink-0 w-3.5 h-3.5" />
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate font-semibold capitalize">{userTier} {t('member')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto no-scrollbar py-2 px-1.5">
                      {/* Personal Portal */}
                      <div className="mb-2">
                        <p className="px-3 py-1 text-[10px] font-bold text-brand-500 mb-1">{t('personal_portal')}</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          <Link to={`/${username}`} className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === `/${username}` ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === `/${username}` ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                              <User size={14} />
                            </div>
                            <span className="font-medium">{t('my_profile')}</span>
                          </Link>
                          <Link to="/orders" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/orders' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/orders' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                              <ShoppingBag size={14} />
                            </div>
                            <span className="font-medium">{t('my_orders')}</span>
                          </Link>
                          <Link to="/teams" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/teams' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/teams' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                              <Shield size={14} />
                            </div>
                            <span className="font-medium">Teams</span>
                          </Link>
                          {(isSeller || isInspector) && (
                            <Link to="/inspections" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/inspections' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/inspections' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                <ClipboardList size={14} />
                              </div>
                              <span className="font-medium">{t('my_inspections')}</span>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Sell & Grow (Conditional dashboard links vs upgrade callout) */}
                      <div className="mb-2 pt-2 border-t border-gray-100 dark:border-neutral-900">
                        {isSeller ? (
                          <>
                            <p className="px-3 py-1 text-[10px] font-bold text-brand-500 mb-1">{t('sell_and_grow')}</p>
                            <div className="grid grid-cols-1 gap-0.5">
                              <Link to="/dashboard" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/dashboard' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/dashboard' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <LayoutDashboard size={14} />
                                </div>
                                <span className="font-medium">{t('seller_dashboard')}</span>
                              </Link>
                              <Link to="/dashboard/products#new" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/dashboard/products' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/dashboard/products' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <PlusCircle size={14} />
                                </div>
                                <span className="font-medium">{t('add_new_product')}</span>
                              </Link>
                            </div>
                          </>
                        ) : (
                          <div className="grid grid-cols-1 gap-0.5">
                            <Link to="/upgrade" className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500" onClick={() => setProfileOpen(false)}>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white">
                                <PlusCircle size={14} />
                              </div>
                              <span className="font-medium">{t('become_a_seller')}</span>
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* Management Group */}
                      {(isStaff || isInspector) && (
                        <div className="mb-2 pt-2 border-t border-gray-100 dark:border-neutral-900">
                          <p className="px-3 py-1 text-[10px] font-bold text-brand-500 mb-1">{t('management')}</p>
                          <div className="grid grid-cols-1 gap-0.5">
                            {isSuperuser && (
                              <Link to="/staff-admin" className={`flex items-center gap-2.5 px-3 py-2 text-sm font-bold rounded-btn transition-all group ${location.pathname === '/staff-admin' ? 'text-brand-500 bg-brand-500/10' : 'text-brand-500 hover:bg-brand-500/10'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/staff-admin' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <ShieldCheck size={14} />
                                </div>
                                {t('admin_panel')}
                              </Link>
                            )}
                            {(isStaff || isSuperuser) && (
                              <Link to="/staff" className={`flex items-center gap-2.5 px-3 py-2 text-sm font-bold rounded-btn transition-all group ${location.pathname === '/staff' ? 'text-brand-500 bg-brand-500/10' : 'text-brand-500 hover:bg-brand-500/10'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/staff' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <LayoutDashboard size={14} />
                                </div>
                                {t('staff_dashboard')}
                              </Link>
                            )}
                            {isInspector && (
                              <Link to="/inspector/jobs" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/inspector/jobs' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/inspector/jobs' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <Shield size={14} />
                                </div>
                                <span className="font-medium">{t('inspector_portal')}</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Support Group */}
                      <div className="pt-2 border-t border-gray-100 dark:border-neutral-900">
                        <p className="px-3 py-1 text-[10px] font-bold text-brand-500 mb-1">{t('system')}</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          <Link to="/dashboard/settings" onClick={() => setProfileOpen(false)} className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/dashboard/settings' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/dashboard/settings' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                              <Settings size={14} />
                            </div>
                            <span className="font-medium">{t('settings')}</span>
                          </Link>
                          <Link to="/dashboard/help-center" onClick={() => setProfileOpen(false)} className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/dashboard/help-center' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/dashboard/help-center' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                              <HelpCircle size={14} />
                            </div>
                            <span className="font-medium">{t('support')}</span>
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-gray-50/50 dark:bg-neutral-950/50 border-t border-gray-100 dark:border-neutral-900">
                      <button 
                        onClick={() => { logout(); sessionStorage.clear(); setProfileOpen(false); navigate('/'); }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-btn transition-all active:scale-95 border border-red-500/10"
                      >
                        <LogOut size={14} /> {t('sign_out')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                to="/login" 
                className={`px-5 py-1.5 active:scale-95 text-sm font-bold rounded-btn transition-all duration-200 ${
                  useLightStyle
                    ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-md'
                    : 'bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/10 hover:shadow-brand-500/25'
                }`}
              >
                {t('login')}
              </Link>
            )}
          </div>

          {/* Mobile Right Actions: Notification Bell & Search */}
          <div className="lg:hidden flex items-center gap-1">
            <button onClick={openSearch} className={getIconBtnClass(false)} aria-label="Search">
              <Search size={20} />
            </button>
            <NotificationBell className={getIconBtnClass(false)} activeClassName={getIconBtnClass(true)} />
          </div>
        </div>
      </div>

    </nav>
  );
};

export default Navbar;

