import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Home, PlusCircle, ShoppingBag, User, X, 
  LayoutDashboard, Package, ClipboardList, ShieldCheck, 
  Shield, Settings, HelpCircle, LogOut, ChevronRight, Menu, ShoppingCart, Moon, Sun, Globe
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import VerifiedBadge from './VerifiedBadge';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const MobileBottomNav = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useCart();
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

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (isMenuOpen) return;
      
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.pageYOffset;
          const delta = currentY - lastScrollY.current;
          
          // Smart Grace Zone & Normal Scroll
          if (delta > 0) {
            // Scrolling down
            const maxHide = 80;
            currentOffset.current = Math.min(maxHide, currentOffset.current + delta);
          } else if (delta < 0) {
            // Scrolling up
            if (currentY <= 60) {
              // Smart Grace Zone: Snap to fully visible if near top and scrolling up
              currentOffset.current = 0;
            } else {
              currentOffset.current = Math.max(0, currentOffset.current + delta);
            }
          }

          if (navRef.current) {
            navRef.current.style.transform = `translateY(${currentOffset.current}px)`;
          }

          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMenuOpen]);

  // Prevent background scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isMenuOpen]);

  return (
    <>
      {/* --- Overlay Backdrop --- */}
      {isMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[70] animate-fade-in"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* --- Slide-up Account Menu --- */}
      <div className={`lg:hidden fixed inset-x-0 bottom-0 z-[80] transition-transform duration-300 transform ${isMenuOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-white dark:bg-gray-900 rounded-t-[2rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          {/* Header Handle */}
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border dark:border-surface-dark-border">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('main_menu')}</h2>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
            {/* User Profile Summary */}
            {isAuthenticated ? (
              <div className="p-6 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{username}</span>
                    <VerifiedBadge tier={userTier} isVerified={isVerified} className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{userTier} {t('member')}</p>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('welcome_to')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('login_or_create')}</p>
                <div className="flex gap-3">
                  <Link to="/login" onClick={() => setIsMenuOpen(false)} className="flex-1 btn-primary py-2 text-center text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg">{t('login')}</Link>
                  <Link to="/register" onClick={() => setIsMenuOpen(false)} className="flex-1 py-2 text-center text-sm font-bold border-2 border-brand-600 text-brand-600 rounded-lg">{t('register')}</Link>
                </div>
              </div>
            )}

            {/* Link Groups */}
            <div className="px-4 space-y-6 mt-2">
              {isAuthenticated && (
                <>
                  {/* Personal Portal */}
                  <div>
                    <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t('personal_portal')}</p>
                    <div className="grid grid-cols-1 gap-2">
                      <Link to={`/profile/${username}`} className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                        <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                          <User size={20} className="text-brand-600" />
                          <span className="font-medium">{t('my_profile')}</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                      </Link>
                      <Link to="/orders" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                        <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                          <ShoppingBag size={20} className="text-brand-600" />
                          <span className="font-medium">{t('my_orders')}</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                      </Link>
                      {(isSeller || isInspector) && (
                        <Link to="/inspections" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                          <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                            <ClipboardList size={20} className="text-brand-600" />
                            <span className="font-medium">{t('my_inspections')}</span>
                          </div>
                          <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Sell & Grow (Conditional dashboard links vs upgrade callout) */}
                  <div>
                    {isSeller ? (
                      <>
                        <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t('sell_and_grow')}</p>
                        <div className="grid grid-cols-1 gap-2">
                          <Link to="/dashboard" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                            <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                              <LayoutDashboard size={20} className="text-brand-600" />
                              <span className="font-medium">{t('seller_dashboard')}</span>
                            </div>
                            <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                          </Link>
                          <Link to="/dashboard/products#new" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                            <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                              <Package size={20} className="text-brand-600" />
                              <span className="font-medium">{t('add_new_product')}</span>
                            </div>
                            <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        <Link to="/upgrade" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                          <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                            <PlusCircle size={20} className="text-brand-600" />
                            <span className="font-medium">{t('become_a_seller')}</span>
                          </div>
                          <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                        </Link>
                      </div>
                    )}
                  </div>

              {/* Management Group */}
              {(isStaff || isInspector) && (
                <div>
                  <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t('management')}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {isSuperuser && (
                      <Link to="/staff-admin" className="flex items-center justify-between p-3 rounded-btn bg-brand-50/50 dark:bg-brand-900/10 hover:bg-brand-100 dark:hover:bg-brand-900/30 group transition-colors">
                        <div className="flex items-center gap-4 text-brand-700 dark:text-brand-300">
                          <ShieldCheck size={20} />
                          <span className="font-bold">{t('staff_admin_panel')}</span>
                        </div>
                        <ChevronRight size={18} className="text-brand-400" />
                      </Link>
                    )}
                    {(isStaff || isSuperuser) && (
                      <Link to="/staff" className="flex items-center justify-between p-3 rounded-btn bg-brand-50/50 dark:bg-brand-900/10 hover:bg-brand-100 dark:hover:bg-brand-900/30 group transition-colors">
                        <div className="flex items-center gap-4 text-brand-700 dark:text-brand-300">
                          <LayoutDashboard size={20} />
                          <span className="font-bold">{t('staff_dashboard')}</span>
                        </div>
                        <ChevronRight size={18} className="text-brand-400" />
                      </Link>
                    )}
                    {isInspector && (
                      <Link to="/inspector/jobs" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                        <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                          <Shield size={20} className="text-brand-600" />
                          <span className="font-medium">{t('inspector_job_list')}</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* System/Other */}
              <div>
                <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t('system')}</p>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <button onClick={toggleTheme} className="flex items-center gap-4 p-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-btn transition-colors text-left w-full">
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    <span>{isDark ? t('light_mode') : t('dark_mode')}</span>
                  </button>
                  <button onClick={() => i18n.changeLanguage(i18n.language?.startsWith('sw') ? 'en' : 'sw')} className="flex items-center gap-4 p-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-btn transition-colors text-left w-full">
                    <Globe size={20} />
                    <span>{i18n.language?.startsWith('sw') ? 'English' : 'Kiswahili'}</span>
                  </button>
                  <Link to="/dashboard/settings" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-btn transition-colors">
                    <Settings size={20} />
                    <span>{t('settings')}</span>
                  </Link>
                  <Link to="/help" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-btn transition-colors">
                    <HelpCircle size={20} />
                    <span>{t('help')}</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            {isAuthenticated && (
              <div className="px-6 mt-8 mb-4">
                <button 
                  onClick={() => { logout(); sessionStorage.clear(); setIsMenuOpen(false); navigate('/'); }}
                  className="w-full flex items-center justify-center gap-3 p-4 rounded-btn border-2 border-red-100 dark:border-red-900/30 text-red-600 font-bold active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
                  >
                  <LogOut size={20} />
                  {t('sign_out_from')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Footer Base Navigation --- */}
      <div 
        ref={navRef}
        className="lg:hidden fixed bottom-0 inset-x-0 z-[60] bg-white/70 dark:bg-gray-950/70 backdrop-blur-2xl border-t border-surface-border/50 dark:border-white/5 px-2 pb-safe pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] will-change-transform"
      >
        <div className="flex items-center justify-around max-w-md mx-auto h-16 relative">
          
          {/* Home */}
          <Link 
            to="/" 
            className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
          >
            <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
              <Home size={24} className={`transition-colors ${isActive('/') ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isActive('/') ? 2.5 : 2} />
              <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isActive('/') ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>{t('home')}</span>
            </motion.div>
            {isActive('/') && (
              <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-600 dark:bg-brand-400" />
            )}
          </Link>

          {/* Products */}
          <Link 
            to="/products" 
            className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
          >
            <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
              <ShoppingBag size={24} className={`transition-colors ${isActive('/products') ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isActive('/products') ? 2.5 : 2} />
              <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isActive('/products') ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>{t('products_nav')}</span>
            </motion.div>
            {isActive('/products') && (
              <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-600 dark:bg-brand-400" />
            )}
          </Link>

          {/* Cart */}
          <Link 
            to="/cart" 
            className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
          >
            <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
              <div className="relative">
                <ShoppingCart size={24} className={`transition-colors ${isActive('/cart') ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isActive('/cart') ? 2.5 : 2} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white dark:border-gray-900 px-1 shadow-sm">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isActive('/cart') ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>{t('cart')}</span>
            </motion.div>
            {isActive('/cart') && (
              <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-600 dark:bg-brand-400" />
            )}
          </Link>

          {/* Hamburger Menu (Toggles Slide-up Menu) */}
          <button 
            onClick={() => setIsMenuOpen(true)} 
            className="relative flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent group"
          >
            <motion.div whileTap={{ scale: 0.85 }} className="relative flex flex-col items-center z-10">
              <Menu size={24} className={`transition-colors ${isMenuOpen ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} strokeWidth={isMenuOpen ? 2.5 : 2} />
              <span className={`text-[10px] font-bold tracking-wide mt-1 transition-colors ${isMenuOpen ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>{t('menu')}</span>
            </motion.div>
            {isMenuOpen && (
              <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-full bg-brand-600 dark:bg-brand-400" />
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileBottomNav;
