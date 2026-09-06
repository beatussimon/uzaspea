import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, ShieldCheck, HelpCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/Button';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password/', { email: cleanEmail });
      setSubmitted(true);
      toast.success('Reset request submitted');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-16 px-4 min-h-[75vh]">
      <div className="card w-full max-w-md p-6 sm:p-8 animate-fade-in space-y-6">
        {/* Top Back Link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
        >
          <ArrowLeft size={16} />
          Back to Sign In
        </Link>

        {!submitted ? (
          <>
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 mx-auto flex items-center justify-center mb-1">
                <ShieldCheck size={26} />
              </div>
              <h1 className="text-heading-md font-black text-gray-900 dark:text-white">
                Reset Your Password
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                Enter your registered email address. For enhanced account security, reset links are manually verified and dispatched by our administrative team.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Registered Email Address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 dark:border-surface-dark-border dark:bg-[#111] dark:text-white pl-9"
                  />
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                Request Password Reset
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 size={30} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Request Received
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                If an active account is associated with <span className="font-semibold text-gray-900 dark:text-white">{email}</span>, our team will review the request and dispatch a secure, one-time reset link directly to your inbox.
              </p>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-left">
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-normal">
                <strong>Important:</strong> The link sent will be single-use and strictly valid for 24 hours. If you do not see the email, please check your spam/junk folder.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/login"
                className="w-full inline-flex justify-center items-center py-2 px-4 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-semibold hover:opacity-95 transition"
              >
                Return to Sign In
              </Link>
              <button
                type="button"
                onClick={() => { setSubmitted(false); setEmail(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1"
              >
                Try another email address
              </button>
            </div>
          </div>
        )}

        {/* Account Help & Recovery Section */}
        <div className="pt-4 border-t border-gray-100 dark:border-neutral-800">
          <div className="bg-gray-50 dark:bg-neutral-900/60 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 dark:text-white">
              <HelpCircle size={15} className="text-brand-500" />
              <span>Need help accessing your account?</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-neutral-400 leading-relaxed">
              If you no longer have access to your registered email or need manual identity verification, our support team can assist you via WhatsApp or support ticket.
            </p>
            <Link
              to="/help"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:underline pt-0.5"
            >
              Visit Help & Support Center
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
