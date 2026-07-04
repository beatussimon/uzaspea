import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider } from './components/ui/Dialogs';

import LandingPage from './pages/LandingPage';
import ProductList from './ProductList';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import MobileBottomNav from './components/MobileBottomNav';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

// Eager imports for small/core public views
import { PublicVerifyPage } from './pages/inspections/InspectionLayout';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load large layout bundles for bundle size optimization
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'));
const StaffAdminLayout = lazy(() => import('./pages/staff/StaffAdminLayout'));
const StaffDashboardLayout = lazy(() => import('./pages/staff/StaffDashboardLayout'));
const InspectionLayout = lazy(() => import('./pages/inspections/InspectionLayout'));
const InspectorLayout = lazy(() => import('./pages/inspections/InspectorLayout'));
const SellerUpgradePage = lazy(() => import('./pages/SellerUpgradePage'));
const ShipmentTrackingPage = lazy(() => import('./pages/ShipmentTrackingPage'));
const HelpCenterPage = lazy(() => import('./pages/dashboard/HelpCenterPage'));

// Fallback loader for Lazy views
const SuspenseLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
  </div>
);

// ProtectedRoute extracted outside App component body to prevent unmount/remount cycles
const ProtectedRoute = ({ children, requireStaff = false, requireSuperuser = false, requireInspector = false, requireSeller = false }: any) => {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (user) {
    if (requireSuperuser && !user.is_superuser) return <Navigate to="/" replace />;
    if (requireStaff && !user.is_staff && !user.is_superuser) return <Navigate to="/dashboard" replace />;
    if (requireInspector && !user.is_inspector) return <Navigate to="/dashboard" replace />;
    if (requireSeller) {
      const tier = user?.tier;
      const isSeller = tier === 'seller_pro' || tier === 'business' || user.is_staff || user.is_superuser;
      if (!isSeller) return <Navigate to="/upgrade" replace />;
    }
  }
  
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <CartProvider>
            <DialogProvider>
              <div className="min-h-screen bg-surface-muted dark:bg-surface-dark flex flex-col transition-colors duration-300">
                <Navbar />
                <div className="h-14 md:h-20" /> {/* Spacer matching navbar height */}

                <main className="flex-1 pt-4 md:pt-6">
                  <ErrorBoundary>
                    <Suspense fallback={<SuspenseLoader />}>
                    <Routes>
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/products" element={<ProductList />} />
                      <Route path="/product/:slug" element={<ProductDetailPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                      <Route path="/dashboard/*" element={<ProtectedRoute requireSeller><DashboardLayout /></ProtectedRoute>} />
                      <Route path="/upgrade" element={<SellerUpgradePage />} />
                      <Route path="/shipments/:id/track" element={<ProtectedRoute><ShipmentTrackingPage /></ProtectedRoute>} />
                      
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
                      <Route path="/help" element={<HelpCenterPage />} />

                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/profile/:username" element={<ProfilePage />} />
                      <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                      <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                      <Route path="/messages/:id" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
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
            </DialogProvider>
          </CartProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
