import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider } from './components/ui/Dialogs';
import { MessageProvider } from './context/MessageContext';
import { ChatToastContainer } from './components/ChatToast';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';


import LandingPage from './pages/LandingPage';
import ProductList from './pages/ProductList';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import TeamsPage from './pages/TeamsPage';
import MobileBottomNav from './components/MobileBottomNav';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import CategoryBar from './components/layout/CategoryBar';

// Eager imports for small/core public views
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
const PublicVerifyPage = lazy(() => import('./pages/inspections/PublicVerifyPage'));

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
      const isSeller = tier === 'seller_pro' || tier === 'business' || tier === 'worker' || user.is_staff || user.is_superuser;
      if (!isSeller) return <Navigate to="/upgrade" replace />;
    }
  }
  
  return children;
};

// Inner component that has access to location (must be inside BrowserRouter)
function AppRoutes() {
  const location = useLocation();
  // If navigated with { state: { backgroundLocation } }, render the overlay product detail
  // on top of the background page (keeps background page mounted at exact scroll position)
  const backgroundLocation = (location.state as any)?.backgroundLocation;

  return (
    <>
      {/* Background page — rendered at backgroundLocation when a modal route is active */}
      <Routes location={backgroundLocation || location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/products" element={<ProductList />} />
        {/* Also keep product route here for direct URL access (no modal state) */}
        <Route path="/product/:slug" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/dashboard/*" element={<ProtectedRoute requireSeller><DashboardLayout /></ProtectedRoute>} />
        <Route path="/upgrade" element={<SellerUpgradePage />} />
        <Route path="/shipments/:id/track" element={<ProtectedRoute><ShipmentTrackingPage /></ProtectedRoute>} />
        <Route path="/staff-admin/*" element={<ProtectedRoute requireSuperuser><StaffAdminLayout /></ProtectedRoute>} />
        <Route path="/staff/*" element={<ProtectedRoute requireStaff><StaffDashboardLayout /></ProtectedRoute>} />
        <Route path="/inspections/*" element={<ProtectedRoute><InspectionLayout /></ProtectedRoute>} />
        <Route path="/inspector/*" element={<ProtectedRoute requireInspector><InspectorLayout /></ProtectedRoute>} />
        <Route path="/verify/:inspection_id" element={<PublicVerifyPage />} />
        <Route path="/help" element={<HelpCenterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/teams" element={<ProtectedRoute><TeamsPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/messages/:id" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Modal overlay — rendered on top of background when backgroundLocation is set */}
      {backgroundLocation && (
        <Routes>
          <Route path="/product/:slug" element={<ProductDetailPage />} />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <MessageProvider>
            <CartProvider>
              <DialogProvider>

              <div className="min-h-screen bg-surface-muted dark:bg-surface-dark flex flex-col transition-colors duration-300">
                <Navbar />
                <div className="h-14 md:h-20" /> {/* Spacer matching navbar height */}
                <CategoryBar />

                <main className="flex-1 pt-4 md:pt-6">
                  <ErrorBoundary>
                    <Suspense fallback={<SuspenseLoader />}>
                      <AppRoutes />
                    </Suspense>
                  </ErrorBoundary>
                </main>

                <Footer />
                <MobileBottomNav />

                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 3000,
                    style: { background: '#111111', color: '#f9fafb', border: '1px solid #262626', borderRadius: '12px', fontSize: '13px', padding: '10px 16px' },
                    success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                  }}
                />
                <ChatToastContainer />
                <PwaInstallPrompt />
              </div>
            </DialogProvider>
          </CartProvider>
        </MessageProvider>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>

  );
}

export default App;
