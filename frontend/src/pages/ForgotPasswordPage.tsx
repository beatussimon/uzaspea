import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { FloatingInput } from '../components/ui/FloatingInput';

const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdent = identifier.trim();
    if (!cleanIdent) {
      toast.error(t('enter_email_or_username_error', 'Please enter your email address or username'));
      return;
    }

    setLoading(true);
    setRateLimitError(null);
    try {
      const res = await api.post('/api/auth/forgot-password/', { email: cleanIdent, identifier: cleanIdent });
      setSubmitted(true);
      if (typeof res.data?.attempts_left === 'number') {
        setAttemptsLeft(res.data.attempts_left);
      }
      toast.success(t('reset_request_submitted', 'Reset request submitted'));
    } catch (err: any) {
      if (err.response?.status === 429) {
        const retryText = err.response?.data?.retry_after_formatted || 'several hours';
        const msg = err.response?.data?.error || t('daily_limit_reached', 'Daily limit reached. Please try again in {{retryText}}.', { retryText });
        setRateLimitError(msg);
        toast.error(msg);
      } else {
        toast.error(err.response?.data?.error || t('failed_submit_request', 'Failed to submit request. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-16 px-4 min-h-[75vh]">
      <div className="card border-0 dark:border-0 hover:border-0 shadow-none w-full max-w-md p-6 sm:p-8 animate-fade-in space-y-6">
        {/* Top Back Link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
        >
          <ArrowLeft size={16} />
          {t('back_to_sign_in', 'Back to Sign In')}
        </Link>

        {!submitted ? (
          <>
            {/* Header */}
            <div className="text-center space-y-1.5 mb-2">
              <h1 className="text-heading-md font-black text-gray-900 dark:text-white">
                {t('reset_password', 'Reset Password')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('enter_registered_email_desc', 'Enter your registered email address or username to receive a password reset link.')}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {rateLimitError && (
                <div className="p-3 rounded-btn bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs leading-relaxed">
                  {rateLimitError}
                </div>
              )}

              <FloatingInput
                id="identifier"
                name="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setRateLimitError(null); }}
                label={t('email_or_username', 'Email Address or Username')}
                autoComplete="username"
              />

              <Button
                type="submit"
                loading={loading}
                disabled={!!rateLimitError}
                className="w-full mt-2"
              >
                {t('send_reset_link', 'Send Reset Link')}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 size={26} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-heading-md font-bold text-gray-900 dark:text-white">
                {t('request_received', 'Request Received')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {t('reset_dispatched_desc_part1', 'If an active account is associated with')}{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{identifier}</span>
                {', '}{t('reset_dispatched_desc_part2', 'a reset link will be dispatched by an administrator to your registered contact channel.')}
              </p>
            </div>

            {/* Attempts remaining note on 2nd and 3rd attempt */}
            {attemptsLeft !== null && attemptsLeft <= 1 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {attemptsLeft === 1
                  ? t('attempt_remaining_1', 'You have 1 attempt remaining today.')
                  : t('final_attempt_today', 'This was your final attempt for today.')}
              </p>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/login"
                className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-btn bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 transition shadow-sm"
              >
                {t('return_to_sign_in', 'Return to Sign In')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setIdentifier('');
                  setAttemptsLeft(null);
                  setRateLimitError(null);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1 transition"
              >
                {t('try_another_email_username', 'Try another email or username')}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-neutral-500 pt-2">
          {t('need_help_contact_support', 'Need help?')}{' '}
          <Link to="/help" className="text-brand-500 hover:underline font-medium">
            {t('contact_support', 'Contact Support')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
