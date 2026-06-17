import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { CartProvider } from './context/CartContext';
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
import MessagesPage from './pages/MessagesPage';
import InspectionLayout, { PublicVerifyPage } from './pages/inspections/InspectionLayout';
import InspectorLayout from './pages/inspections/InspectorLayout';
import MobileBottomNav from './components/MobileBottomNav';


import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

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
              <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
              <Route path="/messages/:id" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
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
