import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { FloatingInput, FloatingSelect } from '../components/ui/FloatingInput';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '' as 'female' | 'male' | '',
    password: '',
    confirm_password: '',
    terms_accepted: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string | null;
  }>({ checking: false, available: null, message: null });

  const isAuthenticated = !!localStorage.getItem('access_token');

  // Debounced real-time username availability & reservation check
  useEffect(() => {
    const raw = formData.username.trim();
    if (!raw) {
      setUsernameStatus({ checking: false, available: null, message: null });
      return;
    }

    if (raw.length < 3) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: t('username_too_short', 'Username must be at least 3 characters.')
      });
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus(prev => ({ ...prev, checking: true }));
      try {
        const res = await axios.get(`${API_BASE_URL}/api/auth/check-username/`, {
          params: { username: raw.toLowerCase() }
        });
        setUsernameStatus({
          checking: false,
          available: res.data.available,
          message: res.data.detail
        });
      } catch (err: any) {
        setUsernameStatus({
          checking: false,
          available: false,
          message: err.response?.data?.detail || 'Username validation error'
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.username, t]);

  if (isAuthenticated) return <Navigate to="/" />;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.first_name || !formData.last_name || !formData.date_of_birth || !formData.gender) {
        return toast.error(t('fill_personal_details_error', 'Please fill in all personal details including gender'));
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
    if (usernameStatus.available === false) {
      return toast.error(usernameStatus.message || 'Please choose an available username');
    }
    if (!formData.terms_accepted) {
      return toast.error('You must agree to the Terms and Conditions and Privacy Policy');
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
      if (res.data.gender || formData.gender) {
        localStorage.setItem('preferred_gender', res.data.gender || formData.gender);
      }
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
      <div className="w-full max-w-md">
        <div className="card border-0 dark:border-0 hover:border-0 dark:hover:border-transparent shadow-none p-6 sm:p-8">
          {/* Header Block (INSIDE the card) */}
          <div className="text-center mb-6">
            <h1 className="text-heading-md font-black text-gray-900 dark:text-white">
              {t('create_account')}
            </h1>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3.5">
                    <FloatingInput
                      id="first_name"
                      name="first_name"
                      label={t('first_name')}
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={handleChange}
                      autoComplete="given-name"
                    />
                    <FloatingInput
                      id="last_name"
                      name="last_name"
                      label={t('last_name')}
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={handleChange}
                      autoComplete="family-name"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <FloatingInput
                      id="date_of_birth"
                      name="date_of_birth"
                      label={t('dob', 'Date of Birth')}
                      type="date"
                      required
                      value={formData.date_of_birth}
                      onChange={handleChange}
                    />

                    <FloatingSelect
                      id="gender"
                      name="gender"
                      label={t('gender', 'Gender')}
                      required
                      value={formData.gender}
                      onChange={handleChange}
                      options={[
                        { value: 'female', label: t('gender_female', 'Female') },
                        { value: 'male', label: t('gender_male', 'Male') },
                      ]}
                    />
                  </div>

                  <Button 
                    type="button"
                    onClick={nextStep}
                    className="w-full flex items-center justify-center gap-2 mt-2"
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
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <FloatingInput
                      id="username"
                      name="username"
                      label={t('username')}
                      type="text"
                      required
                      minLength={3}
                      value={formData.username}
                      onChange={handleChange}
                      autoComplete="username"
                    />
                    {usernameStatus.checking && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
                        <Loader2 size={13} className="animate-spin text-brand-500" />
                        <span>Checking availability...</span>
                      </div>
                    )}
                    {!usernameStatus.checking && usernameStatus.available === true && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span>{usernameStatus.message || 'Username is available!'}</span>
                      </div>
                    )}
                    {!usernameStatus.checking && usernameStatus.available === false && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{usernameStatus.message}</span>
                      </div>
                    )}
                  </div>

                  <FloatingInput
                    id="email"
                    name="email"
                    label={t('email')}
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <FloatingInput
                      id="password"
                      name="password"
                      type="password"
                      label={t('password')}
                      required
                      minLength={8}
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      showPasswordToggle
                    />

                    <FloatingInput
                      id="confirm_password"
                      name="confirm_password"
                      type="password"
                      label={t('confirm_password_label', 'Confirm Password')}
                      required
                      minLength={8}
                      value={formData.confirm_password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      showPasswordToggle
                    />
                  </div>

                  <div className="flex items-start gap-3 pt-1">
                    <div className="flex h-5 items-center">
                      <input
                        id="terms_accepted"
                        name="terms_accepted"
                        type="checkbox"
                        required
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900"
                        checked={formData.terms_accepted}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <label htmlFor="terms_accepted">
                        I agree to the <Link to="/terms" target="_blank" className="text-brand-500 hover:underline">Terms and Conditions</Link> and <Link to="/privacy" target="_blank" className="text-brand-500 hover:underline">Privacy Policy</Link>.
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
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

          {/* Bottom Switch Link INSIDE the card */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6 pt-2">
            {t('already_have_account')}{' '}
            <Link to="/login" className="font-bold text-gray-900 dark:text-white hover:underline transition-colors">
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
