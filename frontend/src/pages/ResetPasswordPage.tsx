import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import {
  Lock, ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft,
  Eye, EyeOff, HelpCircle, ExternalLink, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/Button';

interface TokenVerification {
  valid: boolean;
  request_type: 'settings_change' | 'forgot_password';
  username: string;
  masked_email?: string;
  expires_at?: string;
}

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenVerification | null>(null);

  // Form states for forgot_password flow
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyError('No security reset token was found in the URL. Please verify you clicked the complete link.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await api.get('/api/auth/verify-reset-token/', { params: { token } });
        setTokenData(res.data);
      } catch (err: any) {
        setVerifyError(
          err.response?.data?.error ||
          'This reset link is invalid, has already been used, or has expired after 24 hours.'
        );
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  // Handle settings_change 1-click confirmation
  const handleConfirmSettingsChange = async () => {
    setSubmitting(true);
    try {
      await api.post('/api/auth/confirm-password-reset/', { token });
      toast.success('Password updated successfully! Please sign in with your new password.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to confirm password change. Link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle forgot_password submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/auth/confirm-password-reset/', {
        token,
        new_password: newPassword,
      });
      toast.success('Password successfully reset! Please sign in with your new password.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-16 px-4 min-h-[75vh]">
      <div className="card w-full max-w-md p-6 sm:p-8 animate-fade-in space-y-6">
        {/* Top Link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
        >
          <ArrowLeft size={16} />
          Back to Sign In
        </Link>

        {/* 1. Loading State */}
        {verifying && (
          <div className="text-center py-10 space-y-3">
            <RefreshCw size={28} className="animate-spin text-brand-500 mx-auto" />
            <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">
              Verifying one-time security link...
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
                Link Expired or Invalid
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm mx-auto">
                {verifyError}
              </p>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-left">
              <p className="text-[11px] text-gray-600 dark:text-neutral-400 leading-normal">
                To safeguard your account from unauthorized modifications, reset links are single-use and expire within 24 hours.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/forgot-password"
                className="w-full inline-flex justify-center items-center py-2 px-4 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:opacity-95 transition"
              >
                Request New Reset Link
              </Link>
              <Link
                to="/login"
                className="w-full inline-flex justify-center items-center py-2 px-4 rounded-xl border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              >
                Return to Sign In
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
                Confirm Password Change
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Account: <span className="font-semibold text-gray-900 dark:text-white">{tokenData.username}</span>
              </p>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5 text-left space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <CheckCircle2 size={14} />
                <span>Verification Successful</span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-neutral-400 leading-relaxed">
                You requested a password change from your account settings. Click the button below to activate your new password.
              </p>
            </div>

            <Button
              onClick={handleConfirmSettingsChange}
              loading={submitting}
              className="w-full"
            >
              Confirm & Activate Password
            </Button>
          </div>
        )}

        {/* 4. Valid Token: Forgot Password Form */}
        {!verifying && !verifyError && tokenData?.request_type === 'forgot_password' && (
          <div className="space-y-4">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 mx-auto flex items-center justify-center mb-1">
                <Lock size={24} />
              </div>
              <h1 className="text-heading-md font-black text-gray-900 dark:text-white">
                Set New Password
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Creating new password for <span className="font-semibold text-gray-900 dark:text-white">{tokenData.username}</span>
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 dark:border-surface-dark-border dark:bg-[#111] dark:text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 dark:border-surface-dark-border dark:bg-[#111] dark:text-white"
                />
              </div>

              <Button
                type="submit"
                loading={submitting}
                className="w-full mt-2"
              >
                Save New Password
              </Button>
            </form>
          </div>
        )}

        {/* Account Help & Recovery Section */}
        <div className="pt-4 border-t border-gray-100 dark:border-neutral-800">
          <div className="bg-gray-50 dark:bg-neutral-900/60 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 dark:text-white">
              <HelpCircle size={15} className="text-brand-500" />
              <span>Need help with account recovery?</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-neutral-400 leading-relaxed">
              Our support team can assist with manual identity verification if you cannot access your account.
            </p>
            <Link
              to="/help"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:underline pt-0.5"
            >
              Contact Support Center
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
