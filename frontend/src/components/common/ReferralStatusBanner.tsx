import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, AlertCircle, X } from 'lucide-react';
import { useReferralStatus } from '../../hooks/useAffiliateTracker';

interface ReferralStatusBannerProps {
  className?: string;
}

export const ReferralStatusBanner: React.FC<ReferralStatusBannerProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { expiredNotice, clearExpiredNotice } = useReferralStatus();

  if (!expiredNotice) return null;

  const isLimit = expiredNotice.reason === 'limit_reached';
  const isAlreadyUsed = expiredNotice.reason === 'already_used';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`w-full bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 transition-all duration-300 z-40 select-none ${className}`}
    >
      <div className="container-page py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            {isAlreadyUsed ? <AlertCircle size={15} /> : <Clock size={15} />}
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {isAlreadyUsed
                ? t('already_redeemed', 'Already Redeemed')
                : isLimit
                ? t('promo_ended', 'Promotion Ended')
                : t('link_expired', 'Referral Expired')}
            </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {expiredNotice.message || t('link_expired_message', 'This referral link has expired.')}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xs hidden md:inline">
              • {t('regular_prices_apply', 'You can still purchase this product at the regular price.')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={clearExpiredNotice}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-amber-500/10 transition cursor-pointer shrink-0"
          title={t('dismiss', 'Dismiss')}
          aria-label={t('dismiss', 'Dismiss')}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export default ReferralStatusBanner;
