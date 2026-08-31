import { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider } from './components/ui/Dialogs';
import { MessageProvider } from './context/MessageContext';
import { ChatToastContainer } from './components/ChatToast';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { useStatusBar } from './hooks/useStatusBar';
import { initGlobalHorizontalScroll } from './hooks/useHorizontalScroll';
import { ScrollToTopFab } from './components/ui/ScrollToTopFab';
import { SearchProvider } from './context/SearchContext';
import GlobalSearchModal from './components/GlobalSearchModal';
import { LocationProvider } from './context/LocationContext';
import LocationPromptBanner from './components/layout/LocationPromptBanner';


import LandingPage from './pages/LandingPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import ProductList from './pages/ProductList';
import ProductDetailPage from './pages/ProductDetailPage';

// Preload helper functions for instant navigation on hover
export const preloadProductDetail = () => Promise.resolve({ default: ProductDetailPage });
export const preloadProductList = () => Promise.resolve({ default: ProductList });
import MobileBottomNav from './components/MobileBottomNav';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import CategoryBar from './components/layout/CategoryBar';

// Application Views
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';

import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import TeamsPage from './pages/TeamsPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import MessagesPage from './pages/MessagesPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import StaffAdminLayout from './pages/staff/StaffAdminLayout';
import StaffDashboardLayout from './pages/staff/StaffDashboardLayout';
import InspectionLayout from './pages/inspections/InspectionLayout';
import InspectorLayout from './pages/inspections/InspectorLayout';
import SellerUpgradePage from './pages/SellerUpgradePage';
import ShipmentTrackingPage from './pages/ShipmentTrackingPage';
import HelpCenterPage from './pages/dashboard/HelpCenterPage';
import PublicVerifyPage from './pages/inspections/PublicVerifyPage';
import TermsAndConditionsPage from './pages/legal/TermsAndConditionsPage';
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage';
import SellerContractPage from './pages/legal/SellerContractPage';
import TeamsDashboardLayout from './pages/teams/TeamsDashboardLayout';
import SettingsPage from './pages/dashboard/SettingsPage';

import GlobalTermsModal from './components/GlobalTermsModal';
import DesktopChatDock from './components/chat/DesktopChatDock';

// ProtectedRoute extracted outside App component body to prevent unmount/remount cycles
const ProtectedRoute = ({ children, requireStaff = false, requireSuperuser = false, requireInspector = false, requireSeller = false }: any) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  
  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // If role checks are required but user hasn't loaded yet, return null
  const needsRoleCheck = requireStaff || requireSuperuser || requireInspector || requireSeller;
  if (needsRoleCheck && !user) {
    return null;
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
        <Route path="/terms" element={<TermsAndConditionsPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/seller-contract" element={<SellerContractPage />} />
        <Route path="/teams" element={<ProtectedRoute><TeamsPage /></ProtectedRoute>} />
        <Route path="/teams-dashboard/*" element={<ProtectedRoute><TeamsDashboardLayout /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/messages/:id" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/:username" element={<ProfilePage />} />
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

function AppLayout() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const isMessagesPage = location.pathname.startsWith('/messages');
  
  useStatusBar();

  useEffect(() => {
    const cleanup = initGlobalHorizontalScroll();
    return cleanup;
  }, []);

  return (
    <div className="min-h-screen bg-surface-muted dark:bg-surface-dark flex flex-col transition-colors duration-300">
      <LocationPromptBanner />
      <Navbar />
      {!isLandingPage && <div className="h-14 md:h-20 pt-safe print-hide" />} {/* Spacer matching navbar height, hidden on landing */}
      
      <div className="print-hide">
        <CategoryBar />
      </div>

      <main className={`flex-1 print:pt-0 ${isLandingPage ? 'h-full p-0 overflow-hidden' : isMessagesPage ? '' : 'pt-4 md:pt-6'}`}>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <AppRoutes />
          </Suspense>
        </ErrorBoundary>
      </main>

      {!isLandingPage && !isMessagesPage && <Footer />}
      <MobileBottomNav />
      <ScrollToTopFab />
      <GlobalTermsModal />
      <GlobalSearchModal />

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
      <DesktopChatDock />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocationProvider>
          <BrowserRouter>
            <SearchProvider>
              <MessageProvider>
                <CartProvider>
                  <DialogProvider>
                    <AppLayout />
                  </DialogProvider>
                </CartProvider>
              </MessageProvider>
            </SearchProvider>
          </BrowserRouter>
        </LocationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

