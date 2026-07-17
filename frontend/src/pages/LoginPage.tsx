import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/Input';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const savedCart = localStorage.getItem('sokonimax_cart');
      localStorage.clear();
      if (theme) localStorage.setItem('theme', theme);
      if (savedCart) localStorage.setItem('sokonimax_cart', savedCart);
      
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      localStorage.setItem('user_id', res.data.user_id);
      localStorage.setItem('username', res.data.username);
      localStorage.setItem('is_verified', String(res.data.is_verified || false));
      localStorage.setItem('tier', res.data.tier || 'free');
      localStorage.setItem('is_staff', String(res.data.is_staff || false));
      localStorage.setItem('is_superuser', String(res.data.is_superuser || false));
      localStorage.setItem('is_inspector', String(res.data.is_inspector || false));
      localStorage.setItem('inspector_level', res.data.inspector_level || '');
      
      setIsBanned(false);
      
      toast.success(t('login_success', 'Login successful!'));
      const redirectTo = sessionStorage.getItem('loginRedirect') || '/';
      sessionStorage.removeItem('loginRedirect');
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
    <div className="flex justify-center items-center py-20 px-4">
      <div className="card w-full max-w-md p-6 sm:p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-heading-md font-black text-gray-900 dark:text-white uppercase mb-2">
            {t('welcome_back')}
          </h1>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('login_or_create')}
          </p>
        </div>

        {isBanned && (
          <div className="mb-6 p-4 bg-red-100/10 border border-red-500/20 rounded-card flex flex-col gap-1.5">
            <h3 className="text-red-500 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={14} />
              {t('account_banned_title', 'Account Banned')}
            </h3>
            <p className="text-xs text-red-650 dark:text-red-300">
              {t('account_banned_desc', 'Your account has been permanently restricted by SokoniMax administrators due to policy violations.')}
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <FormField
            id="username"
            label={t('username')}
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('username')}
          />

          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="password" className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
              {t('password')}
            </label>
            <div className="relative w-full">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                className="flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-dark-border dark:bg-[#111] dark:text-white pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            loading={loading}
            className="w-full mt-2"
          >
            {t('sign_in')}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {t('dont_have_account')}{' '}
          <Link to="/register" className="font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline">
            {t('create_account_link')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
