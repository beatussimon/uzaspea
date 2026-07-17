import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/Input';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    password: '',
    confirm_password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const isAuthenticated = !!localStorage.getItem('access_token');

  if (isAuthenticated) return <Navigate to="/" />;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.first_name || !formData.last_name || !formData.date_of_birth) {
        return toast.error(t('fill_personal_details_error', 'Please fill in all personal details'));
      }
    }
    setStep(set => set + 1);
  };

  const prevStep = () => setStep(set => set - 1);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      return toast.error(t('passwords_dont_match', 'Passwords do not match'));
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/register/`, formData);
      
      // Prevent state leakage between accounts
      const theme = localStorage.getItem('theme');
      const savedCart = localStorage.getItem('sokonimax_cart');
      localStorage.clear();
      if (theme) localStorage.setItem('theme', theme);
      if (savedCart) localStorage.setItem('sokonimax_cart', savedCart);
      
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      localStorage.setItem('user_id', res.data.user_id);
      localStorage.setItem('username', res.data.username || formData.username);
      localStorage.setItem('is_verified', String(res.data.is_verified || false));
      localStorage.setItem('tier', res.data.tier || 'free');
      localStorage.setItem('is_staff', String(res.data.is_staff || false));
      localStorage.setItem('is_superuser', String(res.data.is_superuser || false));
      localStorage.setItem('is_inspector', 'false');
      localStorage.setItem('inspector_level', '');
      
      toast.success(t('registration_success', 'Registration successful!'));
      window.location.href = '/';
    } catch (err: any) {
      const msgs = err.response?.data?.detail;
      const msgStr = Array.isArray(msgs) ? msgs.join(', ') : msgs;
      toast.error(msgStr || t('registration_failed', 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex justify-center items-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-heading-lg font-black text-gray-900 dark:text-white uppercase mb-2">
            {t('create_account')}
          </h1>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('login_or_create')}
          </p>
        </div>

        <div className="card overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-surface-muted dark:bg-[#111]">
            <motion.div 
              className="h-full bg-brand-600"
              initial={{ width: '0%' }}
              animate={{ width: step === 1 ? '50%' : '100%' }}
              transition={{ duration: 0.5, ease: "circOut" }}
            />
          </div>

          <div className="p-8 sm:p-10">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <h2 className="text-heading-sm font-bold text-gray-900 dark:text-white uppercase mb-1">
                      {t('personal_details')}
                    </h2>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      {t('personal_details_subtitle', 'Tell us a bit about yourself')}
                    </p>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        id="first_name"
                        name="first_name"
                        label={t('first_name')}
                        type="text"
                        required
                        value={formData.first_name}
                        onChange={handleChange}
                        placeholder={t('first_name')}
                      />
                      <FormField
                        id="last_name"
                        name="last_name"
                        label={t('last_name')}
                        type="text"
                        required
                        value={formData.last_name}
                        onChange={handleChange}
                        placeholder={t('last_name')}
                      />
                    </div>
                    
                    <FormField
                      id="date_of_birth"
                      name="date_of_birth"
                      label={t('dob', 'Date of Birth')}
                      type="date"
                      required
                      value={formData.date_of_birth}
                      onChange={handleChange}
                    />

                    <Button 
                      type="button"
                      onClick={nextStep}
                      className="w-full flex items-center justify-center gap-2 mt-4"
                    >
                      {t('continue', 'Continue')}
                      <ChevronRight className="w-4 h-4 text-current" />
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <h2 className="text-heading-sm font-bold text-gray-900 dark:text-white uppercase mb-1">
                      {t('account_credentials', 'Account Credentials')}
                    </h2>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      {t('secure_account_desc', 'Secure your account')}
                    </p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-5">
                    <FormField
                      id="username"
                      name="username"
                      label={t('username')}
                      type="text"
                      required
                      minLength={3}
                      value={formData.username}
                      onChange={handleChange}
                      placeholder={t('username')}
                    />

                    <FormField
                      id="email"
                      name="email"
                      label={t('email')}
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5 w-full">
                        <label htmlFor="password" className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
                          {t('password')}
                        </label>
                        <div className="relative w-full">
                          <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            required
                            minLength={8}
                            className="flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-dark-border dark:bg-[#111] dark:text-white pr-10"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 w-full">
                        <label htmlFor="confirm_password" className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
                          {t('confirm_password_label', 'Confirm Password')}
                        </label>
                        <div className="relative w-full">
                          <input
                            id="confirm_password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            name="confirm_password"
                            required
                            minLength={8}
                            className="flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-dark-border dark:bg-[#111] dark:text-white pr-10"
                            value={formData.confirm_password}
                            onChange={handleChange}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        className="flex-1 flex items-center justify-center gap-2"
                      >
                        <ChevronLeft className="w-4 h-4 text-current" />
                        {t('back', 'Back')}
                      </Button>
                      <Button 
                        type="submit" 
                        loading={loading}
                        className="flex-[2] flex items-center justify-center gap-2"
                      >
                        {t('complete_signup', 'Complete Signup')}
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-sm text-gray-550 dark:text-gray-400 mt-8">
          {t('already_have_account')}{' '}
          <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
