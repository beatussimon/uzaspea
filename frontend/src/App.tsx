import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Heart, Share2, Moon, Sun, Shield } from 'lucide-react';
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
          <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white hidden sm:inline">
            UZASPEA
          </span>
        </Link>

        {/* ---- Center: Nav links + Search ---- */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center max-w-2xl mx-8">
          <Link to="/" className="btn-ghost text-sm shrink-0">Home</Link>

          {isAuthenticated && (
            <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSellingOpen(!sellingOpen)} className="btn-ghost text-sm flex items-center gap-1">
                Selling
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
              </button>
              {sellingOpen && (
                <div className="absolute top-full left-0 mt-1 card py-1 min-w-[170px] z-50 animate-fade-in">
                  <Link to={`/profile/${username}`} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setSellingOpen(false)}>My Store</Link>
                  <Link to="/dashboard/products" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setSellingOpen(false)}>Sell Product</Link>
                </div>
              )}
            </div>
          )}

          {isStaff && isSuperuser && (
            <Link to="/staff-admin" className="btn-ghost text-sm flex items-center gap-2 text-brand-600 dark:text-brand-400 font-bold border-l border-gray-100 dark:border-gray-700 ml-2 pl-4">
              <Shield size={16} />
              Staff Admin
            </Link>
          )}

          {/* Search bar — centered, wider */}
          <form onSubmit={handleSearch} className="flex items-center flex-1 max-w-sm ml-4">
            <input
              type="search" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="input rounded-r-none border-r-0 py-1.5"
            />
            <button type="submit" className="px-3.5 py-[7px] bg-brand-600 text-white rounded-r-btn hover:bg-brand-700 transition border border-brand-600">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            </button>
          </form>
        </div>

        {/* ---- Right: Cart + Auth + Theme ---- */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <button onClick={toggleTheme} className="btn-ghost p-2 mr-1 text-gray-600 dark:text-gray-300">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {isAuthenticated && (
            <Link to="/cart" className="relative btn-ghost p-2">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-2xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          )}

          {isAuthenticated ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setProfileOpen(!profileOpen)} className="btn-ghost text-sm flex items-center gap-1.5">
                {username}
                <VerifiedBadge tier={userTier} isVerified={isVerified} className="w-4 h-4" />
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
              </button>
              {profileOpen && (
                <div className="absolute top-full right-0 mt-1 card py-1 min-w-[170px] z-50 animate-fade-in">
                  <Link to={`/profile/${username}`} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setProfileOpen(false)}>Profile</Link>
                  <Link to="/dashboard" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setProfileOpen(false)}>Dashboard</Link>
                  <Link to="/orders" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setProfileOpen(false)}>Outgoing Orders</Link>
                  {isStaff && isSuperuser && (
                    <Link to="/staff-admin" className="block px-4 py-2 text-sm text-brand-600 dark:text-brand-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setProfileOpen(false)}>Staff Admin</Link>
                  )}
                  {isStaff && !isSuperuser && (
                    <Link to="/staff" className="block px-4 py-2 text-sm text-brand-600 dark:text-brand-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setProfileOpen(false)}>Staff Panel</Link>
                  )}
                  <hr className="my-1 border-surface-border dark:border-surface-dark-border" />
                  <button onClick={() => { localStorage.clear(); setProfileOpen(false); window.location.href = '/'; }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-primary text-sm px-5 py-1.5 bg-green-600 hover:bg-green-700 border-green-600">Login</Link>
          )}
        </div>

        {/* ---- Mobile toggles ---- */}
        <div className="lg:hidden flex items-center gap-2">
          <button onClick={toggleTheme} className="btn-ghost p-2 mr-1 text-gray-600 dark:text-gray-300">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="btn-ghost p-2" onClick={(e) => { e.stopPropagation(); setMobileOpen(!mobileOpen); }}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {mobileOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {/* ---- Mobile menu ---- */}
      {mobileOpen && (
        <div className="lg:hidden bg-white dark:bg-gray-800 border-t border-surface-border dark:border-surface-dark-border px-4 pb-4 animate-fade-in">
          <form onSubmit={handleSearch} className="flex my-3">
            <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..." className="input rounded-r-none border-r-0" />
            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-r-btn text-sm">Search</button>
          </form>
          <Link to="/" className="block py-2.5 text-sm text-gray-700 dark:text-gray-200 border-b border-surface-border/50 dark:border-surface-dark-border/50">Home</Link>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="block py-2.5 text-sm text-gray-700 dark:text-gray-200 border-b border-surface-border/50 dark:border-surface-dark-border/50" onClick={() => setMobileOpen(false)}>Dashboard</Link>
              <Link to="/cart" className="block py-2.5 text-sm text-gray-700 dark:text-gray-200 border-b border-surface-border/50 dark:border-surface-dark-border/50" onClick={() => setMobileOpen(false)}>Cart ({cartCount})</Link>
              <Link to="/orders" className="block py-2.5 text-sm text-gray-700 dark:text-gray-200 border-b border-surface-border/50 dark:border-surface-dark-border/50" onClick={() => setMobileOpen(false)}>Outgoing Orders</Link>
              {isStaff && isSuperuser && (
                <Link to="/staff-admin" className="block py-2.5 text-sm text-brand-600 dark:text-brand-400 font-medium border-b border-surface-border/50 dark:border-surface-dark-border/50" onClick={() => setMobileOpen(false)}>Staff Admin</Link>
              )}
              {isStaff && !isSuperuser && (
                <Link to="/staff" className="block py-2.5 text-sm text-brand-600 dark:text-brand-400 font-medium border-b border-surface-border/50 dark:border-surface-dark-border/50" onClick={() => setMobileOpen(false)}>Staff Panel</Link>
              )}
              <button onClick={() => { localStorage.clear(); window.location.href = '/'; }}
                className="block py-2.5 text-sm text-red-500 w-full text-left">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="block py-2.5 text-sm text-gray-700 dark:text-gray-200 border-b border-surface-border/50 dark:border-surface-dark-border/50">Login</Link>
              <Link to="/register" className="block py-2.5 text-sm text-gray-700 dark:text-gray-200">Register</Link>
            </>
          )}
        </div>
      )}
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
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/dashboard/*" element={<DashboardLayout />} />
              
              {/* Strict Staff Isolation */}
              <Route path="/staff-admin/*" element={
                (localStorage.getItem('is_superuser') === 'true') 
                ? <StaffAdminLayout /> 
                : <Navigate to="/" />
              } />
              <Route path="/staff/*" element={
                (localStorage.getItem('is_staff') === 'true' && localStorage.getItem('is_superuser') !== 'true') 
                ? <StaffDashboardLayout /> 
                : <Navigate to="/dashboard" />
              } />

              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/profile/:username" element={<ProfilePage />} />
              <Route path="/orders" element={<OrdersPage />} />
            </Routes>
          </main>

          <Footer />

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
