import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import toast from 'react-hot-toast';
import { CheckCircle2 } from 'lucide-react';
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
    <div className="min-h-[80vh] flex justify-center items-center py-12 px-4">
      <div className="w-full max-w-[460px]">
        {/* The Card */}
        <div className="card border-0 dark:border-0 hover:border-0 dark:hover:border-transparent shadow-none p-6 sm:p-8 min-h-[410px] flex flex-col justify-between">
          <div>
            {/* Header Block (INSIDE the card) */}
            <div className="text-center mb-6">
              <h1 className="text-heading-md font-black text-gray-900 dark:text-white">
                {t('reset_password', 'Reset Password')}
              </h1>
            </div>

            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full flex items-center justify-center gap-2 mt-2"
                >
                  {t('send_reset_link', 'Send Reset Link')}
                </Button>
              </form>
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
          </div>

          <div>
            {/* Bottom Switch Link (INSIDE the card) */}
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm text-gray-500 dark:text-gray-400 mt-6 pt-2">
              <span>{t('remember_password', 'Remember your password?')}</span>{' '}
              <Link
                to="/login"
                className="font-bold text-gray-900 dark:text-white hover:underline transition-colors"
              >
                {t('sign_in', 'Sign In')}
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

export default ForgotPasswordPage;
