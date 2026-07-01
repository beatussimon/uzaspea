import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Moon, Sun, Shield, User, Settings, ShoppingBag, 
  LayoutDashboard, ShieldCheck, LogOut, HelpCircle, 
  ChevronDown, PlusCircle, MessageSquare, ClipboardList, ShoppingCart
} from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import { useCart } from '../../context/CartContext';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Navbar = () => {
  const [visible, setVisible] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const lastScrollY = useRef(0);
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentScrollY, setCurrentScrollY] = useState(window.pageYOffset);

  const isVerified = user?.is_verified || false;
  const userTier = user?.tier || 'free';
  const isStaff = user?.is_staff || false;
  const isInspector = user?.is_inspector || false;
  const isSuperuser = user?.is_superuser || false;
  const username = user?.username || 'User';
  const isSeller = userTier === 'seller_pro' || userTier === 'business' || isStaff || isSuperuser;

  // Reset scroll and keep navbar visible on route change
  useEffect(() => {
    setVisible(true);
    setCurrentScrollY(0);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Navbar auto-hide on scroll
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.pageYOffset;
          setCurrentScrollY(currentY);
          if (currentY <= 0) setVisible(true);
          else if (currentY > lastScrollY.current && currentY > 100) setVisible(false);
          else setVisible(true);
          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const close = () => { setProfileOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);


  const isHomepage = location.pathname === '/';
  const useLightStyle = isDark || (isHomepage && currentScrollY < 400);

  const bellClass = useLightStyle
    ? 'text-white/85 hover:text-white'
    : 'text-gray-600 dark:text-gray-300';

  const iconButtonClass = useLightStyle
    ? 'relative p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300'
    : 'relative p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-full transition-all duration-300';

  const themeButtonClass = useLightStyle
    ? 'p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300'
    : 'p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-full transition-all duration-300';

  const navBackgroundClass = isHomepage
    ? 'bg-transparent border-t-0 border-x-0 border-b border-transparent backdrop-blur-none shadow-none'
    : 'glass border-t-0 border-x-0 border-b border-gray-200 dark:border-neutral-800 shadow-sm';

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${visible ? 'translate-y-0' : '-translate-y-full'} ${navBackgroundClass}`}>
      <div className="container-page relative flex items-center justify-between h-16 w-full">

        {/* ---- Left Navigation Links ---- */}
        <div className="flex-1 max-w-[calc(50%-80px)] md:max-w-[calc(50%-100px)] lg:max-w-[380px] flex items-center justify-start pl-8 md:pl-12 gap-6">
          <Link 
            to="/products" 
            className={`hidden md:inline-flex items-center text-sm font-semibold transition-colors ${
              useLightStyle
                ? 'text-white/80 hover:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            Products
          </Link>
          <Link 
            to="/help" 
            className={`hidden md:inline-flex items-center text-sm font-semibold transition-colors ${
              useLightStyle
                ? 'text-white/80 hover:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            Help
          </Link>
        </div>

        {/* ---- Center: Centered Clickable Brand Logo ---- */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center shrink-0 z-20">
          <Link to="/" className="flex items-center group">
            <img 
              src="/logo_dark.png" 
              alt="SokoniMax Logo" 
              className="h-12 md:h-14 w-auto object-contain transition-transform duration-200 hover:scale-105 select-none"
            />
          </Link>
        </div>

        {/* ---- Right: Desktop Actions / Mobile Notifications ---- */}
        <div className="flex items-center justify-end flex-1 max-w-[calc(50%-80px)] md:max-w-[calc(50%-100px)] lg:max-w-[380px] gap-2.5 z-10">
          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-2">
            {isAuthenticated && (
              <>
                {/* Sell button (Only visible to verified sellers) */}
                {isSeller && (
                  <Link 
                    to="/dashboard/products#new" 
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full transition-all active:scale-95 shadow-sm mr-1 ${
                      useLightStyle
                        ? 'bg-white text-gray-900 hover:bg-gray-100'
                        : 'bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900'
                    }`}
                  >
                    <PlusCircle size={14} />
                    <span>Sell</span>
                  </Link>
                )}

                {/* Core Utility Icons */}
                <NotificationBell className={bellClass} />

                <Link to="/messages" className={iconButtonClass} aria-label="View messages">
                  <MessageSquare size={18} />
                </Link>

                <Link to="/cart" className={iconButtonClass} aria-label="View shopping cart">
                  <ShoppingCart size={18} />
                  {cartCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-white dark:border-gray-950">
                      {cartCount > 99 ? '99' : cartCount}
                    </span>
                  )}
                </Link>
              </>
            )}

            <button onClick={toggleTheme} className={themeButtonClass} aria-label="Toggle theme">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {/* User Profile / Login (Desktop & Mobile handles profile differently) */}
          <div className="hidden lg:block">
            {isAuthenticated ? (
              /* User Dropdown */
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => setProfileOpen(!profileOpen)} 
                  className={`flex items-center gap-1 p-0.5 rounded-full transition-all focus:outline-none ${
                    useLightStyle 
                      ? 'hover:bg-white/10' 
                      : 'hover:bg-gray-100 dark:hover:bg-neutral-900'
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
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate font-semibold capitalize">{userTier} Member</p>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto no-scrollbar py-2 px-1.5">
                      {/* Personal Portal */}
                      <div className="mb-2">
                        <p className="px-3 py-1 text-[10px] font-bold text-brand-500 mb-1">Personal Portal</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          <Link to={`/profile/${username}`} className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === `/profile/${username}` ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === `/profile/${username}` ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                              <User size={14} />
                            </div>
                            <span className="font-medium">My Profile</span>
                          </Link>
                          <Link to="/orders" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/orders' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/orders' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                              <ShoppingBag size={14} />
                            </div>
                            <span className="font-medium">My Orders</span>
                          </Link>
                          {(isSeller || isInspector) && (
                            <Link to="/inspections" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/inspections' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/inspections' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                <ClipboardList size={14} />
                              </div>
                              <span className="font-medium">My Inspections</span>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Sell & Grow (Conditional dashboard links vs upgrade callout) */}
                      <div className="mb-2 pt-2 border-t border-gray-100 dark:border-neutral-900">
                        {isSeller ? (
                          <>
                            <p className="px-3 py-1 text-[10px] font-bold text-brand-500 mb-1">Sell & Grow</p>
                            <div className="grid grid-cols-1 gap-0.5">
                              <Link to="/dashboard" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/dashboard' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/dashboard' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <LayoutDashboard size={14} />
                                </div>
                                <span className="font-medium">Seller Dashboard</span>
                              </Link>
                              <Link to="/dashboard/products#new" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/dashboard/products' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/dashboard/products' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <PlusCircle size={14} />
                                </div>
                                <span className="font-medium">Add New Product</span>
                              </Link>
                            </div>
                          </>
                        ) : (
                          <div className="grid grid-cols-1 gap-0.5">
                            <Link to="/upgrade" className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500" onClick={() => setProfileOpen(false)}>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white">
                                <PlusCircle size={14} />
                              </div>
                              <span className="font-medium">Become a Seller</span>
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* Management Group */}
                      {(isStaff || isInspector) && (
                        <div className="mb-2 pt-2 border-t border-gray-100 dark:border-neutral-900">
                          <p className="px-3 py-1 text-[10px] font-bold text-brand-500 mb-1">Management</p>
                          <div className="grid grid-cols-1 gap-0.5">
                            {isSuperuser && (
                              <Link to="/staff-admin" className={`flex items-center gap-2.5 px-3 py-2 text-sm font-bold rounded-btn transition-all group ${location.pathname === '/staff-admin' ? 'text-brand-500 bg-brand-500/10' : 'text-brand-500 hover:bg-brand-500/10'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/staff-admin' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <ShieldCheck size={14} />
                                </div>
                                Admin Panel
                              </Link>
                            )}
                            {(isStaff || isSuperuser) && (
                              <Link to="/staff" className={`flex items-center gap-2.5 px-3 py-2 text-sm font-bold rounded-btn transition-all group ${location.pathname === '/staff' ? 'text-brand-500 bg-brand-500/10' : 'text-brand-500 hover:bg-brand-500/10'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/staff' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <LayoutDashboard size={14} />
                                </div>
                                Staff Dashboard
                              </Link>
                            )}
                            {isInspector && (
                              <Link to="/inspector/jobs" className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/inspector/jobs' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`} onClick={() => setProfileOpen(false)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/inspector/jobs' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                                  <Shield size={14} />
                                </div>
                                <span className="font-medium">Inspector Portal</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Support Group */}
                      <div className="pt-2 border-t border-gray-100 dark:border-neutral-900">
                        <p className="px-3 py-1 text-[10px] font-bold text-brand-500 mb-1">System</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          <Link to="/dashboard/settings" onClick={() => setProfileOpen(false)} className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/dashboard/settings' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/dashboard/settings' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                              <Settings size={14} />
                            </div>
                            <span className="font-medium">Settings</span>
                          </Link>
                          <Link to="/dashboard/help-center" onClick={() => setProfileOpen(false)} className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-btn transition-all group ${location.pathname === '/dashboard/help-center' ? 'text-brand-500 bg-brand-500/10 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500'}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${location.pathname === '/dashboard/help-center' ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                              <HelpCircle size={14} />
                            </div>
                            <span className="font-medium">Support</span>
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-gray-50/50 dark:bg-neutral-950/50 border-t border-gray-100 dark:border-neutral-900">
                      <button 
                        onClick={() => { logout(); sessionStorage.clear(); setProfileOpen(false); navigate('/'); }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-btn transition-all active:scale-95 border border-red-500/10"
                      >
                        <LogOut size={14} /> Sign Out
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
                Login
              </Link>
            )}
          </div>

          {/* Mobile Right Actions: Notification Bell */}
          <div className="lg:hidden flex items-center">
            <NotificationBell className={bellClass} />
          </div>
        </div>
      </div>

    </nav>
  );
};

export default Navbar;

