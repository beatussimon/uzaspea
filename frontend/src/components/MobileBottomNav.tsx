import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Home, PlusCircle, ShoppingBag, User, X, 
  LayoutDashboard, Package, ClipboardList, ShieldCheck, 
  Shield, Settings, HelpCircle, LogOut, ChevronRight, Menu, ShoppingCart, Moon, Sun, Globe, MessageSquare, Heart
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import VerifiedBadge from './VerifiedBadge';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMessages } from '../context/MessageContext';
import api, { API_BASE_URL } from '../api';

const MobileBottomNav = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { totalUnread: messageUnreadCount } = useMessages();
  const { t, i18n } = useTranslation();

  
  const { isAuthenticated, user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  
  const isVerified = user?.is_verified || false;
  const userTier = user?.tier || 'free';
  const isStaff = user?.is_staff || false;
  const isInspector = user?.is_inspector || false;
  const isSuperuser = user?.is_superuser || false;
  const username = user?.username || 'User';
  const isSeller = userTier === 'seller_pro' || userTier === 'business' || isStaff || isSuperuser;

  // Active state helper
  const isActive = (path: string) => location.pathname === path;

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Natural 1:1 scroll logic — hide on scroll down, show on scroll up
  const navRef = useRef<HTMLDivElement>(null);
  const currentOffset = useRef(0);
  const lastScrollY = useRef(0);

  const isHomepage = location.pathname === '/';
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reset initial state when route changes (show briefly, then hide)
    if (navRef.current) {
      currentOffset.current = 0;
      navRef.current.style.transition = 'transform 0.3s ease-out';
      navRef.current.style.transform = `translateY(0px)`;
      
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => {
        if (navRef.current && !isMenuOpen) {
          currentOffset.current = 100;
          navRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
          navRef.current.style.transform = `translateY(100px)`;
        }
      }, 2500);
    }
  }, [location.pathname, isMenuOpen]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (isMenuOpen) return;
      
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const snapContainer = document.querySelector('.snap-container') as HTMLElement;
          const currentY = snapContainer ? snapContainer.scrollTop : window.scrollY;
            
          const delta = currentY - lastScrollY.current;
          const maxHide = 100;
          
          if (Math.abs(delta) > 0) {
            if (delta > 0 && currentY > 50) {
              // Scrolling down -> hide immediately
              if (currentOffset.current !== maxHide) {
                currentOffset.current = maxHide;
                if (navRef.current) {
                  navRef.current.style.transition = 'transform 0.3s ease-out';
                  navRef.current.style.transform = `translateY(${maxHide}px)`;
                }
              }
              if (hideTimeout.current) clearTimeout(hideTimeout.current);
            } else {
              // Scrolling up -> show
              if (currentOffset.current !== 0) {
                currentOffset.current = 0;
                if (navRef.current) {
                  navRef.current.style.transition = 'transform 0.3s ease-out';
                  navRef.current.style.transform = `translateY(0px)`;
                }
              }
              
              // Reset hide timer so it auto-hides after inactivity
              if (hideTimeout.current) clearTimeout(hideTimeout.current);
              hideTimeout.current = setTimeout(() => {
                if (navRef.current && !isMenuOpen) {
                  currentOffset.current = maxHide;
                  navRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                  navRef.current.style.transform = `translateY(${maxHide}px)`;
                }
              }, 2000);
            }
          }

          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    // Listen on both window and capture phase to catch snap-container scrolling
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    
    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true } as any);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [isMenuOpen, isHomepage]);

  // Prevent background scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isMenuOpen]);

  // Fetch saved count
  const fetchSavedCount = () => {
    if (isAuthenticated) {
      api.get('/api/products/?saved=true&limit=1')
        .then(res => setSavedCount(res.data.count || 0))
        .catch(() => {});
    } else {
      setSavedCount(0);
    }
  };

  useEffect(() => {
    fetchSavedCount();
  }, [isAuthenticated, location.pathname]);

  // Listen for custom event from ProductCard to update saved count instantly
  useEffect(() => {
    const handleSavedChange = () => fetchSavedCount();
    window.addEventListener('savedItemsChanged', handleSavedChange);
    return () => window.removeEventListener('savedItemsChanged', handleSavedChange);
  }, [isAuthenticated]);

  return (
    <>
      {/* --- Overlay Backdrop --- */}
      {isMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[70] animate-fade-in print-hide"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* --- Slide-up Account Menu --- */}
      <div className={`lg:hidden fixed inset-x-0 bottom-0 z-[80] transition-transform duration-300 transform ${isMenuOpen ? 'translate-y-0' : 'translate-y-full'} print-hide`}>
        <div className="bg-white dark:bg-gray-900 rounded-t-[2rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col pb-safe">
          {/* Header Handle */}
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mt-2 mb-1" />

          <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
            {/* User Profile Summary */}
            {isAuthenticated ? (
              <Link to={`/${username}`} onClick={() => setIsMenuOpen(false)} className="block px-5 pb-4 pt-2 border-b border-gray-100 dark:border-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors group">
                <div className="flex items-center gap-3.5">
                  {user?.profile_picture ? (
                    <img src={user.profile_picture.startsWith('http') ? user.profile_picture : `${API_BASE_URL}${user.profile_picture}`} alt={username} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white text-xl font-bold shadow-sm">
                      {username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors">{username}</span>
                      <VerifiedBadge tier={userTier} isVerified={isVerified} className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize font-medium mt-0.5">{userTier} {t('member')}</p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="p-5 border-b border-gray-100 dark:border-neutral-900">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">{t('welcome_to')}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('login_or_create')}</p>
                <div className="flex gap-2">
                  <Link to="/login" onClick={() => setIsMenuOpen(false)} className="flex-1 btn-primary py-2 text-center text-sm font-bold bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors">{t('login')}</Link>
                  <Link to="/register" onClick={() => setIsMenuOpen(false)} className="flex-1 py-2 text-center text-sm font-bold border border-brand-500 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors">{t('register')}</Link>
                </div>
              </div>
            )}

            {/* Link Groups */}
            <div className="px-3 py-2">
              {isAuthenticated && (
                <>
                  {/* Personal Portal */}
                  <div className="mb-2">
                    <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('personal_portal')}</p>
                    <div className="space-y-0.5">
                      <Link to="/orders" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-700 dark:text-gray-300 transition-colors group" onClick={() => setIsMenuOpen(false)}>
                        <ShoppingBag size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                        <span className="text-sm font-medium">{t('my_orders')}</span>
                      </Link>
                      <Link to="/teams" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-700 dark:text-gray-300 transition-colors group">
                        <Shield size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                        <span className="text-sm font-medium">Teams</span>
                      </Link>
                      {(isSeller || isInspector) && (
                        <Link to="/inspections" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-700 dark:text-gray-300 transition-colors group" onClick={() => setIsMenuOpen(false)}>
                          <ClipboardList size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                          <span className="text-sm font-medium">{t('my_inspections')}</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Sell & Grow */}
                  <div className="mb-2 border-t border-gray-100 dark:border-neutral-900 pt-2 mt-2">
                    {isSeller ? (
                      <>
                        <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('sell_and_grow')}</p>
                        <div className="space-y-0.5">
                          <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-700 dark:text-gray-300 transition-colors group" onClick={() => setIsMenuOpen(false)}>
                            <LayoutDashboard size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                            <span className="text-sm font-medium">{t('seller_dashboard')}</span>
                          </Link>
                          <Link to="/dashboard/products#new" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-700 dark:text-gray-300 transition-colors group" onClick={() => setIsMenuOpen(false)}>
                            <Package size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                            <span className="text-sm font-medium">{t('add_new_product')}</span>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <div className="px-2 py-1">
                        <Link to="/upgrade" className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors group" onClick={() => setIsMenuOpen(false)}>
                          <PlusCircle size={20} className="group-hover:scale-110 transition-transform" />
                          <span className="font-semibold text-sm">{t('become_a_seller')}</span>
                        </Link>
                      </div>
                    )}
                  </div>

              {/* Management Group */}
              {(isStaff || isInspector) && (
                <div className="mb-2 border-t border-gray-100 dark:border-neutral-900 pt-2 mt-2">
                  <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('management')}</p>
                  <div className="space-y-0.5">
                    {isSuperuser && (
                      <Link to="/staff-admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-brand-600 dark:text-brand-400 transition-colors group" onClick={() => setIsMenuOpen(false)}>
                        <ShieldCheck size={20} />
                        <span className="text-sm font-semibold">{t('staff_admin_panel')}</span>
                      </Link>
                    )}
                    {(isStaff || isSuperuser) && (
                      <Link to="/staff" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-brand-600 dark:text-brand-400 transition-colors group" onClick={() => setIsMenuOpen(false)}>
                        <LayoutDashboard size={20} />
                        <span className="text-sm font-semibold">{t('staff_dashboard')}</span>
                      </Link>
                    )}
                    {isInspector && (
                      <Link to="/inspector/jobs" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-700 dark:text-gray-300 transition-colors group" onClick={() => setIsMenuOpen(false)}>
                        <Shield size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                        <span className="text-sm font-medium">{t('inspector_job_list')}</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* System/Other */}
              <div className="border-t border-gray-100 dark:border-neutral-900 pt-2 mt-2">
                <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('system')}</p>
                <div className="space-y-0.5">
                  <button onClick={toggleTheme} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg transition-colors group text-gray-700 dark:text-gray-300 text-left">
                    <div className="flex items-center gap-3">
                      {isDark ? <Sun size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" /> : <Moon size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />}
                      <span className="text-sm font-medium">{isDark ? t('light_mode') : t('dark_mode')}</span>
                    </div>
                  </button>
                  <button onClick={() => {
                    const currentLang = i18n.language?.split('-')[0] || 'en';
                    i18n.changeLanguage(currentLang === 'sw' ? 'en' : 'sw');
                  }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg transition-colors group text-gray-700 dark:text-gray-300 text-left">
                    <div className="flex items-center gap-3">
                      <Globe size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                      <span className="text-sm font-medium">{i18n.language?.split('-')[0] === 'sw' ? 'Kiswahili' : 'English'}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">Switch</span>
                  </button>
                  <Link to="/dashboard/settings" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg transition-colors group text-gray-700 dark:text-gray-300">
                    <Settings size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                    <span className="text-sm font-medium">{t('settings')}</span>
                  </Link>
                  <Link to="/help" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg transition-colors group text-gray-700 dark:text-gray-300">
                    <HelpCircle size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                    <span className="text-sm font-medium">{t('help')}</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            {isAuthenticated && (
              <div className="px-4 mt-4 mb-4">
                <button 
                  onClick={() => { logout(); sessionStorage.clear(); setIsMenuOpen(false); navigate('/'); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-500 font-semibold transition-colors"
                  >
                  <LogOut size={20} />
                  {t('sign_out')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Footer Base Navigation --- */}
      <div 
        ref={navRef}
        className={`lg:hidden fixed bottom-0 inset-x-0 z-[60] px-2 pb-safe pt-2 will-change-transform transition-colors duration-300 ${
          isHomepage 
            ? 'bg-transparent border-transparent shadow-none' 
            : 'bg-white/70 dark:bg-gray-950/70 backdrop-blur-2xl border-t border-surface-border/50 dark:border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]'
        } print-hide`}
      >
        <div className="flex items-center justify-around max-w-md mx-auto h-16 relative">
          
          {/* Home */}
          <Link 
            to="/" 
            className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
          >
            <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
              <Home size={24} className={`transition-colors ${isActive('/') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isActive('/') ? 2.5 : 2} />
              <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isActive('/') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400'}`}>{t('home')}</span>
            </motion.div>
            {isActive('/') && (
              <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-500 dark:bg-brand-500" />
            )}
          </Link>

          {/* Products */}
          <Link 
            to="/products" 
            className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
          >
            <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
              <ShoppingBag size={24} className={`transition-colors ${isActive('/products') && !location.search.includes('saved=true') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isActive('/products') && !location.search.includes('saved=true') ? 2.5 : 2} />
              <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isActive('/products') && !location.search.includes('saved=true') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400'}`}>{t('products_nav')}</span>
            </motion.div>
            {isActive('/products') && !location.search.includes('saved=true') && (
              <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-500 dark:bg-brand-500" />
            )}
          </Link>



          {/* Cart */}
          <Link 
            to="/cart" 
            className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
          >
            <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
              <div className="relative">
                <ShoppingCart size={24} className={`transition-colors ${isActive('/cart') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isActive('/cart') ? 2.5 : 2} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white dark:border-gray-900 px-1 shadow-sm">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isActive('/cart') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400'}`}>{t('cart')}</span>
            </motion.div>
            {isActive('/cart') && (
              <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-500 dark:bg-brand-500" />
            )}
          </Link>

          {/* Messages */}
          {isAuthenticated && (
            <Link 
              to="/messages" 
              className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
            >
              <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
                <div className="relative">
                  <MessageSquare size={24} className={`transition-colors ${isActive('/messages') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isActive('/messages') ? 2.5 : 2} />
                  {messageUnreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white dark:border-gray-900 px-1 shadow-sm animate-pulse">
                      {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isActive('/messages') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400'}`}>Chats</span>
              </motion.div>
              {isActive('/messages') && (
                <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-500 dark:bg-brand-500" />
              )}
            </Link>
          )}
          {/* Saved */}
          {isAuthenticated && (
            <Link 
              to="/products?saved=true" 
              className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
            >
              <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
                <div className="relative">
                  <Heart size={24} className={`transition-colors ${isActive('/products') && location.search.includes('saved=true') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isActive('/products') && location.search.includes('saved=true') ? 2.5 : 2} />
                  {savedCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-gray-500/80 backdrop-blur-sm text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white dark:border-gray-900 px-1 shadow-sm">
                      {savedCount > 99 ? '99+' : savedCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isActive('/products') && location.search.includes('saved=true') ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400'}`}>{t('saved', 'Saved')}</span>
              </motion.div>
              {isActive('/products') && location.search.includes('saved=true') && (
                <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-500 dark:bg-brand-500" />
              )}
            </Link>
          )}



          {/* Hamburger Menu (Toggles Slide-up Menu) */}
          <button 
            onClick={() => setIsMenuOpen(true)} 
            className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
          >
            <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
              <Menu size={24} className={`transition-colors ${isMenuOpen ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isMenuOpen ? 2.5 : 2} />
              <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isMenuOpen ? 'text-brand-500 dark:text-brand-500' : 'text-gray-400'}`}>{t('menu')}</span>
            </motion.div>
            {isMenuOpen && (
              <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-500 dark:bg-brand-500" />
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileBottomNav;
