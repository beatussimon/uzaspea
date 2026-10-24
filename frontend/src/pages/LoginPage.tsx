import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { FloatingInput } from '../components/ui/FloatingInput';
import { AuthLanguageSelector } from '../components/layout/LanguageSelector';
import { useAuth } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const isAuthenticated = !!localStorage.getItem('access_token');

  const [isBanned, setIsBanned] = useState(localStorage.getItem('account_banned') === 'true');

  if (isAuthenticated) return <Navigate to="/" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/token/`, { username, password });
      
      // Prevent state leakage between accounts
      const theme = localStorage.getItem('theme');
      localStorage.clear();
      if (theme) localStorage.setItem('theme', theme);

      // Call AuthContext login to decode full JWT payload, initialize state, and store all keys
      login({ access: res.data.access, refresh: res.data.refresh }, res.data);
      setIsBanned(false);
      
      // Process pending cart item if user had tried to add to cart before login
      try {
        const pending = sessionStorage.getItem('pendingCartItem');
        if (pending) {
          const { product, quantity } = JSON.parse(pending);
          const userCartKey = `sokonimax_cart_${res.data.user_id}`;
          const existingCartStr = localStorage.getItem(userCartKey);
          let userCart = existingCartStr ? JSON.parse(existingCartStr) : [];
          if (!product.seller_username || product.seller_username.toLowerCase() !== res.data.username?.toLowerCase()) {
            const existingItem = userCart.find((i: any) => i.productId === product.id);
            const firstImage = product.images?.[0]?.image || product.image || '';
            if (existingItem) {
              existingItem.quantity = Math.min(existingItem.quantity + (quantity || 1), product.stock || 999);
            } else {
              userCart.push({
                productId: product.id,
                name: product.name,
                price: parseFloat(product.price),
                stock: product.stock,
                quantity: quantity || 1,
                image: firstImage,
                slug: product.slug,
                seller_username: product.seller_username,
                category: product.category_name,
                weight_kg: product.weight_kg ? parseFloat(product.weight_kg) : 1.0,
                size: product.size || 'small',
                requires_quote: product.requires_quote || false,
              });
            }
            localStorage.setItem(userCartKey, JSON.stringify(userCart));
          }
          sessionStorage.removeItem('pendingCartItem');
        }
      } catch (e) {
        sessionStorage.removeItem('pendingCartItem');
      }

      toast.success(t('login_success', 'Login successful!'));
      const urlParams = new URLSearchParams(window.location.search);
      const nextParam = urlParams.get('next');

      const isSubActive = res.data.subscription_active === true || res.data.subscription_active === 'true';
      const isExpired = res.data.subscription_expired === true || res.data.subscription_expired === 'true';
      const isSeller = res.data.is_seller === true || res.data.is_seller === 'true' || res.data.tier === 'seller_pro' || res.data.tier === 'business';

      let defaultRedirect = '/';
      if (res.data.is_inspector && !res.data.is_staff) {
        defaultRedirect = '/inspector/jobs';
      } else if (res.data.is_team_member && !res.data.is_staff && !res.data.is_superuser && res.data.tier !== 'business') {
        defaultRedirect = '/teams-dashboard';
      } else if (res.data.is_staff || res.data.is_superuser) {
        defaultRedirect = res.data.is_superuser ? '/staff-admin' : '/staff';
      } else if (isSubActive) {
        defaultRedirect = '/dashboard';
      } else if (isExpired || isSeller) {
        defaultRedirect = '/dashboard';
      } else {
        defaultRedirect = '/';
      }

      let redirectTo = nextParam || sessionStorage.getItem('loginRedirect') || defaultRedirect;
      sessionStorage.removeItem('loginRedirect');

      // If the user is an active subscriber, prevent accidental redirection to billing
      if (isSubActive && redirectTo === '/dashboard/billing') {
        redirectTo = '/dashboard';
      }
      // If pure customer was trying to go to a seller path, route to home
      if (!isSubActive && !isExpired && !isSeller && !res.data.is_staff && !res.data.is_superuser && redirectTo.startsWith('/dashboard')) {
        redirectTo = '/';
      }

      window.location.href = redirectTo;
    } catch (err: any) {
      if (err.response?.data?.code === 'user_banned') {
          setIsBanned(true);
          localStorage.setItem('account_banned', 'true');
      } else {
          toast.error(err.response?.data?.detail || t('login_error', 'Invalid username or password'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex justify-center items-center py-12 px-4">
      <div className="w-full max-w-[460px]">
        {/* The Card */}
        <div className="card border-0 dark:border-0 hover:border-0 dark:hover:border-transparent shadow-none dark:bg-[#232323] p-6 sm:p-8 min-h-[410px] flex flex-col justify-between">
          <div>
            {/* Header Block (INSIDE the card) */}
            <div className="text-center mb-8 sm:mb-9">
              <h1 className="text-heading-md font-black text-gray-900 dark:text-white">
                {t('welcome_back')}
              </h1>
            </div>

            {isBanned && (
              <div className="mb-6 p-4 border border-red-500/20 rounded-card flex flex-col gap-1.5 bg-red-500/5 text-left">
                <h3 className="text-red-500 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  {t('account_banned_title', 'Account Banned')}
                </h3>
                <p className="text-xs text-red-500 dark:text-red-500">
                  {t('account_banned_desc', 'Your account has been permanently restricted by SokoniMax administrators due to policy violations.')}
                </p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5">
              <FloatingInput
                id="username"
                label={t('username', 'Username')}
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />

              <FloatingInput
                id="password"
                type="password"
                label={t('password', 'Password')}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                showPasswordToggle
              />

              <Button
                type="submit"
                loading={loading}
                className="w-full h-12 flex items-center justify-center gap-2 !mt-4"
              >
                {t('sign_in', 'Sign In')}
              </Button>
            </form>
          </div>

          <div>
            {/* Quick Language Switcher */}
            <AuthLanguageSelector />

            {/* Bottom Switch Link & Forgot Password (INSIDE the card) */}
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
              <span>{t('dont_have_account', "Don't have an account?")}</span>{' '}
              <Link
                to="/register"
                className="font-bold text-gray-900 dark:text-white hover:underline transition-colors"
              >
                {t('create_account_link', 'Create account')}
              </Link>
              <span className="text-gray-400 dark:text-neutral-600 px-1">|</span>
              <Link
                to="/forgot-password"
                className="hover:underline text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {t('forgot_password', 'Forgot Password')}
              </Link>
            </div>

            {/* Support Help Link */}
            <p className="text-center text-xs text-gray-400 dark:text-neutral-500 mt-2.5">
              {t('trouble_accessing', 'Trouble accessing your account?')}{' '}
              <Link to="/help" className="hover:underline hover:text-gray-600 dark:hover:text-neutral-300">
                {t('contact_support', 'Contact Support')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
