import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { 
  Moon, Sun, Shield, User, Settings, Package, ShoppingBag, 
  LayoutDashboard, ShieldCheck, ClipboardList, LogOut, 
  HelpCircle, FileText, ChevronDown, PlusCircle, Search
} from 'lucide-react';
import VerifiedBadge from './components/VerifiedBadge';

import { CartProvider, useCart } from './context/CartContext';
import ProductList from './ProductList';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import StaffAdminLayout from './pages/staff/StaffAdminLayout';
import StaffDashboardLayout from './pages/staff/StaffDashboardLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import OrdersPage from './pages/OrdersPage';
import InspectionLayout, { PublicVerifyPage } from './pages/inspections/InspectionLayout';
import InspectorLayout from './pages/inspections/InspectorLayout';
import MobileBottomNav from './components/MobileBottomNav';

// ================================================================
// Navbar — h-16 (64px), balanced layout, prominent brand
// ================================================================
const Navbar = () => {
  const [visible, setVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sellingOpen, setSellingOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const lastScrollY = useRef(0);
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = !!localStorage.getItem('access_token');
  const isVerified = localStorage.getItem('is_verified') === 'true';
  const userTier = localStorage.getItem('tier') || 'free';
  const isStaff = localStorage.getItem('is_staff') === 'true';
  const isInspector = localStorage.getItem('is_inspector') === 'true';
  const isSuperuser = localStorage.getItem('is_superuser') === 'true';
  const username = localStorage.getItem('username') || 'User';

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

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
    const close = () => { setSellingOpen(false); setProfileOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <nav className={`bg-white dark:bg-gray-800 shadow-nav fixed top-0 inset-x-0 z-50 transition-transform duration-300 ${visible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="container-page flex items-center justify-between h-16">

        {/* ---- Left: Brand ---- */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <img src="/logo.png" alt="UZASPEA" className="h-9 w-auto transition-transform duration-200 group-hover:scale-105" />
          <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">
            UZASPEA
          </span>
        </Link>

        {/* ---- Center: Nav links + Search ---- */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center max-w-2xl mx-8">
          <Link 
            to="/" 
            className={`btn-ghost text-sm shrink-0 transition-all ${location.pathname === '/' ? 'text-brand-600 bg-brand-50/50 dark:bg-brand-900/10 font-bold' : 'hover:scale-105'}`}
          >
            Home
          </Link>

          {isAuthenticated && (
            <Link 
              to="/inspections" 
              className={`btn-ghost text-sm shrink-0 transition-all ${location.pathname.startsWith('/inspections') ? 'text-brand-600 bg-brand-50/50 dark:bg-brand-900/10 font-bold' : 'hover:scale-105'}`}
            >
              Inspections
            </Link>
          )}

          {/* Search bar — centered, wider */}
          <form onSubmit={handleSearch} className="flex items-center flex-1 max-w-sm ml-4 group">
            <div className="relative flex items-center flex-1">
              <input
                type="search" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="input rounded-r-none border-r-0 py-1.5 pl-3 pr-2 focus:ring-0 group-focus-within:border-brand-500 transition-colors"
                aria-label="Search products"
              />
            </div>
            <button 
              type="submit" 
              className="px-3.5 py-[7px] bg-brand-600 text-white rounded-r-btn hover:bg-brand-700 transition-all border border-brand-600 active:scale-95 flex items-center justify-center group/btn"
              aria-label="Execute search"
            >
              <Search size={18} className="group-hover/btn:scale-110 transition-transform" />
            </button>
          </form>
        </div>

        {/* ---- Right: Cart + Auth + Theme ---- */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <Link 
            to="/dashboard/products" 
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white text-sm font-bold rounded-pill transition-all transform hover:scale-105 active:scale-95 shadow-md hover:shadow-brand-500/25 mr-2 group"
          >
            <PlusCircle size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Sell Product</span>
          </Link>

          <button onClick={toggleTheme} className="btn-ghost p-2 text-gray-600 dark:text-gray-300 hover:rotate-12 transition-transform" aria-label="Toggle theme">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {isAuthenticated && (
            <Link to="/cart" className="relative btn-ghost p-2 group" aria-label="View shopping cart">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="group-hover:scale-110 transition-transform"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-2xs font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white dark:border-gray-800">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          )}

          {isAuthenticated ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)} 
                className="flex items-center gap-2 px-2 py-1.5 rounded-pill hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                  {username.charAt(0).toUpperCase()}
                </div>
                <div className="hidden xl:flex flex-col items-start leading-none mr-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">{username}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{userTier} Tier</span>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute top-[calc(100%+12px)] right-0 w-72 glass rounded-card shadow-card-hover border border-white/40 dark:border-white/5 z-50 animate-fade-in overflow-hidden">
                  {/* Account Header */}
                  <div className="p-5 bg-gradient-to-br from-gray-50/80 to-white/80 dark:from-gray-800/80 dark:to-gray-900/80 border-b border-surface-border dark:border-surface-dark-border">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-4 ring-white dark:ring-gray-800">
                        {username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{username}</p>
                          <VerifiedBadge tier={userTier} isVerified={isVerified} className="shrink-0 w-4 h-4" />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate uppercase tracking-tighter font-medium">{userTier} Member</p>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto no-scrollbar py-3 px-2">
                    {/* User Group */}
                    <div className="mb-4">
                      <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Account</p>
                      <div className="grid grid-cols-1 gap-1">
                        <Link to={`/profile/${username}`} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                            <User size={16} />
                          </div>
                          <span className="font-medium">My Profile</span>
                        </Link>
                        <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                            <LayoutDashboard size={16} />
                          </div>
                          <span className="font-medium">Seller Dashboard</span>
                        </Link>
                        <Link to="/orders" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                          <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                            <ShoppingBag size={16} />
                          </div>
                          <span className="font-medium">My Orders</span>
                        </Link>
                      </div>
                    </div>

                    {/* Management Group */}
                    {(isStaff || isInspector) && (
                      <div className="mb-4 pt-4 border-t border-surface-border/50 dark:border-surface-dark-border/50">
                        <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Management</p>
                        <div className="grid grid-cols-1 gap-1">
                          {isSuperuser && (
                            <Link to="/staff-admin" className="flex items-center gap-3 px-3 py-2 text-sm text-brand-600 dark:text-brand-400 font-bold hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-btn transition-all" onClick={() => setProfileOpen(false)}>
                              <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                                <ShieldCheck size={16} />
                              </div>
                              Admin Panel
                            </Link>
                          )}
                          {isInspector && (
                            <Link to="/inspector/jobs" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 rounded-btn transition-all group" onClick={() => setProfileOpen(false)}>
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                                <Shield size={16} />
                              </div>
                              <span className="font-medium">Inspector Portal</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Support Group */}
                    <div className="pt-4 border-t border-surface-border/50 dark:border-surface-dark-border/50">
                      <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">System</p>
                      <div className="grid grid-cols-1 gap-1">
                        <button className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-btn transition-colors w-full text-left">
                          <Settings size={16} /> Settings
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-btn transition-colors w-full text-left">
                          <HelpCircle size={16} /> Support
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50/50 dark:bg-gray-800/50 border-t border-surface-border dark:border-surface-dark-border">
                    <button 
                      onClick={() => { localStorage.clear(); sessionStorage.clear(); setProfileOpen(false); window.location.href = '/'; }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-btn transition-all active:scale-95 border border-red-100 dark:border-red-900/30"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-primary text-sm px-5 py-1.5 bg-green-600 hover:bg-green-700 border-green-600">Login</Link>
          )}
        </div>

        {/* ---- Mobile toggles (Hidden in favor of Bottom Nav) ---- */}
        <div className="lg:hidden flex items-center gap-2">
          <button onClick={toggleTheme} className="btn-ghost p-1.5 text-gray-600 dark:text-gray-300">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link to="/cart" className="relative btn-ghost p-1.5 text-gray-600 dark:text-gray-300">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {cartCount > 99 ? '99' : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile menu (Hidden) */}
    </nav>
  );
};

// ================================================================
// Footer — Collapsed by default, expandable
// ================================================================
const Footer = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer className="mt-auto border-t border-surface-border dark:border-surface-dark-border bg-white dark:bg-gray-800 transition-all duration-300">
      {/* Collapsed state — single line */}
      <div
        className="container-page flex items-center justify-between h-12 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} UZASPEA. All rights reserved.</p>
        <button className={`text-gray-400 hover:text-gray-600 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="container-page pb-6 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-surface-border/50 dark:border-surface-dark-border/50 pt-4 animate-slide-up">
          <div>
            <h5 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">About UZASPEA</h5>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Your premier online marketplace for buying and selling in Tanzania.</p>
          </div>
          <div>
            <h5 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">Quick Links</h5>
            <ul className="space-y-1">
              <li><Link to="/" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 transition">Home</Link></li>
              <li><Link to="/" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 transition">Products</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">Connect With Us</h5>
            <div className="flex gap-3">
              <a href="#" className="text-xs text-gray-400 hover:text-brand-600 transition">Facebook</a>
              <a href="#" className="text-xs text-gray-400 hover:text-brand-600 transition">Twitter</a>
              <a href="#" className="text-xs text-gray-400 hover:text-brand-600 transition">Instagram</a>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

// ================================================================
// App Shell
// ================================================================
function App() {
  useEffect(() => {
    // Initial theme load
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, []);

  const isAuthenticated = !!localStorage.getItem('access_token');
  const isInspector = localStorage.getItem('is_inspector') === 'true';
  const isStaff = localStorage.getItem('is_staff') === 'true';
  const isSuperuser = localStorage.getItem('is_superuser') === 'true';

  const ProtectedRoute = ({ children, requireStaff = false, requireSuperuser = false, requireInspector = false }: any) => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (requireSuperuser && !isSuperuser) return <Navigate to="/" />;
    if (requireStaff && !isStaff && !isSuperuser) return <Navigate to="/dashboard" />;
    if (requireInspector && !isInspector) return <Navigate to="/dashboard" />;
    return children;
  };

  return (
    <BrowserRouter>
      <CartProvider>
        <div className="min-h-screen bg-surface-muted dark:bg-surface-dark flex flex-col">
          <Navbar />
          <div className="h-16" /> {/* Spacer matches new navbar height */}

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<ProductList />} />
              <Route path="/product/:slug" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
              <Route path="/dashboard/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
              
              {/* Strict Staff Isolation */}
              <Route path="/staff-admin/*" element={
                <ProtectedRoute requireSuperuser>
                  <StaffAdminLayout />
                </ProtectedRoute>
              } />
              <Route path="/staff/*" element={
                <ProtectedRoute requireStaff>
                  <StaffDashboardLayout />
                </ProtectedRoute>
              } />

              <Route path="/inspections/*" element={
                <ProtectedRoute>
                  <InspectionLayout />
                </ProtectedRoute>
              } />
              <Route path="/inspector/*" element={
                <ProtectedRoute requireInspector>
                  <InspectorLayout />
                </ProtectedRoute>
              } />
              <Route path="/verify/:inspection_id" element={<PublicVerifyPage />} />

              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/profile/:username" element={<ProfilePage />} />
              <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
            </Routes>
          </main>

          <Footer />
          <MobileBottomNav />

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: { background: '#1f2937', color: '#f9fafb', borderRadius: '10px', fontSize: '13px', padding: '10px 16px' },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </div>
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
