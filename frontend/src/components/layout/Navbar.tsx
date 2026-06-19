import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Moon, Sun, Shield, User, Settings, ShoppingBag, 
  LayoutDashboard, ShieldCheck, LogOut, HelpCircle, 
  ChevronDown, PlusCircle, Search, MessageSquare
} from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import { useCart } from '../../context/CartContext';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Navbar = () => {
  const [visible, setVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const lastScrollY = useRef(0);
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const isVerified = user?.is_verified || false;
  const userTier = user?.tier || 'free';
  const isStaff = user?.is_staff || false;
  const isInspector = user?.is_inspector || false;
  const isSuperuser = user?.is_superuser || false;
  const username = user?.username || 'User';

  // Close mobile search and reset navbar on route change
  useEffect(() => {
    setVisible(true);
    setMobileSearchOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Navbar auto-hide on scroll
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.pageYOffset;
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileSearchOpen(false);
    }
  };

  return (
    <nav className={`glass border-b border-gray-100 dark:border-neutral-900 fixed top-0 inset-x-0 z-50 transition-transform duration-300 ${visible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="container-page flex items-center justify-between h-16">

        {/* ---- Left: Brand & Main Navigation ---- */}
        <div className="flex items-center shrink-0">
          <Link to="/" className="flex items-center gap-2.5 group mr-2">
            <img src="/logo.png" alt="UZASPEA" className="h-9 w-auto transition-transform duration-200 group-hover:scale-105" />
            <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">
              UZASPEA
            </span>
          </Link>

          <div className="hidden lg:block h-6 w-px bg-gray-200 dark:bg-neutral-800 mx-3" />

          {/* Desktop Core Navigation Links */}
          <div className="hidden lg:flex items-center gap-1.5">
            <Link 
              to="/" 
              className={`px-3 py-1.5 text-sm font-semibold rounded-btn transition-all duration-200 ${
                location.pathname === '/' 
                  ? 'text-brand-500 bg-brand-500/10' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-neutral-900'
              }`}
            >
              Explore
            </Link>
            {isAuthenticated && (
              <>
                <Link 
                  to="/inspections" 
                  className={`px-3 py-1.5 text-sm font-semibold rounded-btn transition-all duration-200 ${
                    location.pathname.startsWith('/inspections') 
                      ? 'text-brand-500 bg-brand-500/10' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  Inspections
                </Link>
                <Link 
                  to="/messages" 
                  className={`px-3 py-1.5 text-sm font-semibold rounded-btn transition-all duration-200 ${
                    location.pathname.startsWith('/messages') 
                      ? 'text-brand-500 bg-brand-500/10' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  Messages
                </Link>
              </>
            )}
          </div>
        </div>

        {/* ---- Center: Search ---- */}
        <div className="hidden lg:flex items-center flex-1 justify-center max-w-md mx-6">
          <form onSubmit={handleSearch} className="flex items-center w-full group relative">
            <div className="relative flex items-center flex-1">
              <input
                type="search" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full px-4 py-1.5 text-sm border border-gray-200 dark:border-neutral-800 rounded-l-btn bg-gray-50/50 dark:bg-black/50 dark:text-white outline-none focus:border-brand-500 dark:focus:border-brand-500 focus:ring-0 transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                aria-label="Search products"
              />
            </div>
            <button 
              type="submit" 
              className="px-4 py-[7px] bg-brand-500 text-white rounded-r-btn hover:bg-brand-600 transition-all border border-brand-500 active:scale-95 flex items-center justify-center group/btn"
              aria-label="Execute search"
            >
              <Search size={16} className="group-hover/btn:scale-110 transition-transform" />
            </button>
          </form>
        </div>

        {/* ---- Right: Sell + Notification + Messages + Cart + Theme + Dropdown ---- */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <Link 
            to="/dashboard/products" 
            className="flex items-center gap-1.5 px-4 py-1.5 border border-brand-500 hover:bg-brand-500/10 text-brand-500 dark:text-brand-400 text-sm font-bold rounded-btn transition-all active:scale-95 hover:shadow-glow mr-1 group"
          >
            <PlusCircle size={16} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Sell</span>
          </Link>

          <NotificationBell />

          {isAuthenticated && (
            <>
              <Link to="/messages" className="relative btn-ghost p-2 group hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-btn transition-all" aria-label="View messages">
                <MessageSquare size={20} className="text-gray-600 dark:text-gray-300 group-hover:scale-110 transition-transform" />
              </Link>

              <Link to="/cart" className="relative btn-ghost p-2 group hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-btn transition-all" aria-label="View shopping cart">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-600 dark:text-gray-300 group-hover:scale-110 transition-transform"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                {cartCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-2xs font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white dark:border-gray-800">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
            </>
          )}

          <button onClick={toggleTheme} className="btn-ghost p-2 text-gray-600 dark:text-gray-300 hover:rotate-12 transition-transform hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-btn" aria-label="Toggle theme">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {isAuthenticated ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)} 
                className="flex items-center gap-1.5 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-900 transition-all border border-gray-200 dark:border-neutral-800 group"
              >
                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                  {username.charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={14} className="text-gray-400 mr-1 group-hover:translate-y-0.5 transition-transform" />
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
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate uppercase tracking-wider font-semibold">{userTier} Member</p>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto no-scrollbar py-2 px-1.5">
                    {/* User Group */}
                    <div className="mb-2">
                      <p className="px-3 py-1 text-[9px] font-bold text-brand-500 uppercase tracking-widest mb-1">Account</p>
                      <div className="grid grid-cols-1 gap-0.5">
                        <Link to={`/profile/${username}`} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            <User size={14} />
                          </div>
                          <span className="font-medium">My Profile</span>
                        </Link>
                        <Link to="/dashboard" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            <LayoutDashboard size={14} />
                          </div>
                          <span className="font-medium">Seller Dashboard</span>
                        </Link>
                        <Link to="/orders" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            <ShoppingBag size={14} />
                          </div>
                          <span className="font-medium">My Orders</span>
                        </Link>
                        <Link to="/messages" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            <MessageSquare size={14} />
                          </div>
                          <span className="font-medium">Messages</span>
                        </Link>
                      </div>
                    </div>

                    {/* Management Group */}
                    {(isStaff || isInspector) && (
                      <div className="mb-2 pt-2 border-t border-gray-100 dark:border-neutral-900">
                        <p className="px-3 py-1 text-[9px] font-bold text-brand-500 uppercase tracking-widest mb-1">Management</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          {isSuperuser && (
                            <Link to="/staff-admin" className="flex items-center gap-2.5 px-3 py-2 text-sm text-brand-500 font-bold hover:bg-brand-500/10 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                              <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                                <ShieldCheck size={14} />
                              </div>
                              Admin Panel
                            </Link>
                          )}
                          {isStaff && !isSuperuser && (
                            <Link to="/staff" className="flex items-center gap-2.5 px-3 py-2 text-sm text-brand-500 font-bold hover:bg-brand-500/10 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                              <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                                <LayoutDashboard size={14} />
                              </div>
                              Staff Dashboard
                            </Link>
                          )}
                          {isInspector && (
                            <Link to="/inspector/jobs" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                              <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
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
                      <p className="px-3 py-1 text-[9px] font-bold text-brand-500 uppercase tracking-widest mb-1">System</p>
                      <div className="grid grid-cols-1 gap-0.5">
                        <Link to="/dashboard/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500 rounded-btn transition-all group">
                          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            <Settings size={14} />
                          </div>
                          <span className="font-medium">Settings</span>
                        </Link>
                        <Link to="/dashboard/help-center" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-500/10 hover:text-brand-500 rounded-btn transition-all group">
                          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
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
            <Link to="/login" className="px-5 py-1.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white text-sm font-bold rounded-btn transition-all duration-200 shadow-md shadow-brand-500/10 hover:shadow-brand-500/25">Login</Link>
          )}
        </div>

        {/* ---- Mobile top-right (Search Toggle + Notifications) ---- */}
        <div className="lg:hidden flex items-center gap-2">
          <button 
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)} 
            className="p-2 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
            aria-label="Toggle search"
          >
            <Search size={20} />
          </button>
          <NotificationBell />
        </div>
      </div>

      {/* Mobile Search Bar Dropdown */}
      {mobileSearchOpen && (
        <div className="lg:hidden absolute top-16 inset-x-0 bg-white dark:bg-black border-t border-gray-100 dark:border-neutral-900 p-3 shadow-md animate-fade-in">
          <form onSubmit={handleSearch} className="flex items-center w-full">
            <div className="relative flex items-center flex-1">
              <input
                type="search" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-neutral-800 rounded-l-btn bg-gray-50 dark:bg-neutral-950 dark:text-white outline-none focus:border-brand-500 dark:focus:border-brand-500 focus:ring-0"
                autoFocus
              />
            </div>
            <button 
              type="submit" 
              className="px-4 py-[9px] bg-brand-500 text-white rounded-r-btn active:scale-95 flex items-center justify-center"
            >
              <Search size={18} />
            </button>
          </form>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

