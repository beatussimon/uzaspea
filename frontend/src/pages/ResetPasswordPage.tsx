import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import toast from 'react-hot-toast';
import {
  Lock, ShieldCheck, CheckCircle2, AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { FloatingInput } from '../components/ui/FloatingInput';

interface TokenVerification {
  valid: boolean;
  request_type: 'settings_change' | 'forgot_password';
  username: string;
  masked_email?: string;
  expires_at?: string;
}

const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenVerification | null>(null);

  // Form states for forgot_password flow
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyError(t('no_reset_token_found', 'No security reset token was found in the URL. Please verify you clicked the complete link.'));
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await api.get('/api/auth/verify-reset-token/', { params: { token } });
        setTokenData(res.data);
      } catch (err: any) {
        setVerifyError(
          err.response?.data?.error ||
          t('reset_link_invalid_or_expired', 'This reset link is invalid, has already been used, or has expired after 24 hours.')
        );
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token, t]);

  // Handle settings_change 1-click confirmation
  const handleConfirmSettingsChange = async () => {
    setSubmitting(true);
    try {
      await api.post('/api/auth/confirm-password-reset/', { token });
      toast.success(t('password_updated_success', 'Password updated successfully! Please sign in with your new password.'));
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('failed_confirm_password_change', 'Failed to confirm password change. Link may have expired.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle forgot_password submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t('password_min_length', 'Password must be at least 8 characters long'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('passwords_do_not_match', 'Passwords do not match'));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/auth/confirm-password-reset/', {
        token,
        new_password: newPassword,
      });
      toast.success(t('password_reset_success', 'Password successfully reset! Please sign in with your new password.'));
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('failed_reset_password', 'Failed to reset password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex justify-center items-center py-12 px-4">
      <div className="w-full max-w-[460px]">
        {/* The Card */}
        <div className="card border-0 dark:border-0 hover:border-0 dark:hover:border-transparent shadow-none p-6 sm:p-8 min-h-[410px] flex flex-col justify-between">
          <div>
            {/* 1. Loading State */}
            {verifying && (
              <div className="text-center py-10 space-y-3">
                <RefreshCw size={28} className="animate-spin text-brand-500 mx-auto" />
                <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">
                  {t('verifying_security_link', 'Verifying one-time security link...')}
                </p>
              </div>
            )}

            {/* 2. Error State */}
            {!verifying && verifyError && (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
                  <AlertTriangle size={30} />
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-heading-md font-black text-gray-900 dark:text-white">
                    {t('link_expired_or_invalid', 'Link Expired or Invalid')}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm mx-auto">
                    {verifyError}
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    to="/forgot-password"
                    className="w-full inline-flex justify-center items-center py-2 px-4 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:opacity-95 transition"
                  >
                    {t('request_new_reset_link', 'Request New Reset Link')}
                  </Link>
                  <Link
                    to="/login"
                    className="w-full inline-flex justify-center items-center py-2 px-4 rounded-xl border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
                  >
                    {t('return_to_sign_in', 'Return to Sign In')}
                  </Link>
                </div>
              </div>
            )}

            {/* 3. Valid Token: Settings Change Confirmation */}
            {!verifying && !verifyError && tokenData?.request_type === 'settings_change' && (
              <div className="text-center space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-brand-500/10 text-brand-500 mx-auto flex items-center justify-center">
                  <ShieldCheck size={30} />
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-heading-md font-black text-gray-900 dark:text-white">
                    {t('confirm_password_change', 'Confirm Password Change')}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('account', 'Account')}: <span className="font-semibold text-gray-900 dark:text-white">{tokenData.username}</span>
                  </p>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5 text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                    <CheckCircle2 size={14} />
                    <span>{t('verification_successful', 'Verification Successful')}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-neutral-400 leading-relaxed">
                    {t('settings_change_desc', 'You requested a password change from your account settings. Click the button below to activate your new password.')}
                  </p>
                </div>

                <Button
                  onClick={handleConfirmSettingsChange}
                  loading={submitting}
                  className="w-full flex items-center justify-center gap-2 mt-2"
                >
                  {t('confirm_activate_password', 'Confirm & Activate Password')}
                </Button>
              </div>
            )}

            {/* 4. Valid Token: Forgot Password Form */}
            {!verifying && !verifyError && tokenData?.request_type === 'forgot_password' && (
              <div>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 mx-auto flex items-center justify-center mb-2">
                    <Lock size={24} />
                  </div>
                  <h1 className="text-heading-md font-black text-gray-900 dark:text-white">
                    {t('set_new_password', 'Set New Password')}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('creating_new_password_for', 'Creating new password for')}{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">{tokenData.username}</span>
                  </p>
                </div>

                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <FloatingInput
                    id="newPassword"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    label={t('new_password', 'New Password')}
                    autoComplete="new-password"
                    showPasswordToggle
                  />

                  <FloatingInput
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    label={t('confirm_new_password', 'Confirm New Password')}
                    autoComplete="new-password"
                    showPasswordToggle
                  />

                  <Button
                    type="submit"
                    loading={submitting}
                    className="w-full flex items-center justify-center gap-2 mt-2"
                  >
                    {t('save_new_password', 'Save New Password')}
                  </Button>
                </form>
              </div>
            )}
          </div>

          <div>
            {/* Bottom Switch Link (INSIDE the card) */}
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm text-gray-500 dark:text-gray-400 mt-6 pt-2">
              <Link
                to="/login"
                className="font-bold text-gray-900 dark:text-white hover:underline transition-colors"
              >
                {t('back_to_sign_in', 'Back to Sign In')}
              </Link>
            </div>

            {/* Support Help Link */}
            <p className="text-center text-xs text-gray-400 dark:text-neutral-500 mt-3">
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

export default ResetPasswordPage;
