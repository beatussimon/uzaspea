import { useState, useEffect, useRef } from 'react';
import { 
  Home, Search, PlusCircle, ShoppingBag, User, X, 
  LayoutDashboard, Package, ClipboardList, ShieldCheck, 
  Shield, Settings, HelpCircle, LogOut, ChevronRight
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import VerifiedBadge from './VerifiedBadge';

const MobileBottomNav = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  
  const isAuthenticated = !!localStorage.getItem('access_token');
  const isVerified = localStorage.getItem('is_verified') === 'true';
  const userTier = localStorage.getItem('tier') || 'free';
  const isStaff = localStorage.getItem('is_staff') === 'true';
  const isInspector = localStorage.getItem('is_inspector') === 'true';
  const isSuperuser = localStorage.getItem('is_superuser') === 'true';
  const username = localStorage.getItem('username') || 'User';

  // Active state helper
  const isActive = (path: string) => location.pathname === path;

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Scroll logic — optimized with ref to avoid redundant re-renders
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (isMenuOpen) return;

      // Small threshold to avoid twitchy behavior
      if (Math.abs(currentScrollY - lastScrollY.current) < 10) return;

      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
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
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Account Menu</h2>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
            {/* User Profile Summary */}
            <div className="p-6 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{username}</span>
                  <VerifiedBadge tier={userTier} isVerified={isVerified} className="w-5 h-5" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{userTier} Member</p>
              </div>
            </div>

            {/* Link Groups */}
            <div className="px-4 space-y-6">
              {/* Marketplace Group */}
              <div>
                <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Marketplace</p>
                <div className="grid grid-cols-1 gap-2">
                  <Link to={`/profile/${username}`} className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                    <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                      <User size={20} className="text-brand-600" />
                      <span className="font-medium">My Public Profile</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                  </Link>
                  <Link to="/orders" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                    <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                      <ShoppingBag size={20} className="text-brand-600" />
                      <span className="font-medium">My Orders</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                  </Link>
                </div>
              </div>

              {/* Selling Group */}
              <div>
                <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Selling & Business</p>
                <div className="grid grid-cols-1 gap-2">
                  <Link to="/dashboard" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                    <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                      <LayoutDashboard size={20} className="text-brand-600" />
                      <span className="font-medium">Seller Dashboard</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                  </Link>
                  <Link to="/dashboard/products" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                    <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                      <Package size={20} className="text-brand-600" />
                      <span className="font-medium">Add New Product</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                  </Link>
                  <Link to="/inspections" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                    <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                      <ClipboardList size={20} className="text-brand-600" />
                      <span className="font-medium">My Inspections</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                  </Link>
                </div>
              </div>

              {/* Management Group */}
              {(isStaff || isInspector) && (
                <div>
                  <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Management</p>
                  <div className="grid grid-cols-1 gap-2">
                    {isSuperuser && (
                      <Link to="/staff-admin" className="flex items-center justify-between p-3 rounded-btn bg-brand-50/50 dark:bg-brand-900/10 hover:bg-brand-100 dark:hover:bg-brand-900/30 group transition-colors">
                        <div className="flex items-center gap-4 text-brand-700 dark:text-brand-300">
                          <ShieldCheck size={20} />
                          <span className="font-bold">Staff Admin Panel</span>
                        </div>
                        <ChevronRight size={18} className="text-brand-400" />
                      </Link>
                    )}
                    {isStaff && !isSuperuser && (
                      <Link to="/staff" className="flex items-center justify-between p-3 rounded-btn bg-brand-50/50 dark:bg-brand-900/10 hover:bg-brand-100 dark:hover:bg-brand-900/30 group transition-colors">
                        <div className="flex items-center gap-4 text-brand-700 dark:text-brand-300">
                          <LayoutDashboard size={20} />
                          <span className="font-bold">Staff Dashboard</span>
                        </div>
                        <ChevronRight size={18} className="text-brand-400" />
                      </Link>
                    )}
                    {isInspector && (
                      <Link to="/inspector/jobs" className="flex items-center justify-between p-3 rounded-btn bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors">
                        <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                          <Shield size={20} className="text-brand-600" />
                          <span className="font-medium">Inspector Job List</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-brand-600 transition-colors" />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* System/Other */}
              <div>
                <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">System</p>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <button className="flex items-center gap-4 p-3 text-gray-600 dark:text-gray-400">
                    <Settings size={20} />
                    <span>Settings</span>
                  </button>
                  <button className="flex items-center gap-4 p-3 text-gray-600 dark:text-gray-400">
                    <HelpCircle size={20} />
                    <span>Help & Support center</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <div className="px-6 mt-8 mb-4">
              <button 
                onClick={() => { localStorage.clear(); window.location.href = '/'; }}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-btn border-2 border-red-100 dark:border-red-900/30 text-red-600 font-bold active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
                >
                <LogOut size={20} />
                Sign Out from UZASPEA
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Footer Base Navigation --- */}
      <div className={`lg:hidden fixed bottom-0 inset-x-0 z-[60] bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-t border-surface-border dark:border-surface-dark-border px-4 pb-safe pt-2 shadow-[0_-1px_10px_rgba(0,0,0,0.05)] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] will-change-transform transform ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex items-center justify-between max-w-md mx-auto h-14">
          
          {/* Home */}
          <Link 
            to="/" 
            className={`flex flex-col items-center gap-1 transition-colors ${isActive('/') ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}
          >
            <Home size={22} strokeWidth={isActive('/') ? 2.5 : 2} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Home</span>
          </Link>

          {/* Browse/Search */}
          <Link 
            to="/#browse" 
            className="flex flex-col items-center gap-1 text-gray-400"
            onClick={() => {
              if(location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Search size={22} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Browse</span>
          </Link>

          {/* SELL - Center Hero Button */}
          <div className="relative -top-5 px-2">
            <Link 
              to={isAuthenticated ? "/dashboard/products" : "/login"}
              className="flex flex-col items-center justify-center w-15 h-15 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-[0_4px_15px_rgba(26,86,245,0.4)] border-4 border-white dark:border-gray-900 active:scale-95 transition-transform"
            >
              <PlusCircle size={28} />
            </Link>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">Sell</span>
          </div>

          {/* Orders/Cart */}
          <Link 
            to="/orders" 
            className={`flex flex-col items-center gap-1 transition-colors ${isActive('/orders') ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}
          >
            <ShoppingBag size={22} strokeWidth={isActive('/orders') ? 2.5 : 2} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Orders</span>
          </Link>

          {/* Account/Profile (Toggles Menu) */}
          <button 
            onClick={() => isAuthenticated ? setIsMenuOpen(true) : window.location.href = '/login'} 
            className={`flex flex-col items-center gap-1 transition-colors ${isMenuOpen || location.pathname.startsWith('/profile') ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}
          >
            <User size={22} strokeWidth={isMenuOpen || location.pathname.startsWith('/profile') ? 2.5 : 2} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Account</span>
          </button>

        </div>
      </div>
    </>
  );
};

export default MobileBottomNav;
