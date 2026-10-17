import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useReferralStatus } from '../../hooks/useAffiliateTracker';

interface ReferralStatusBannerProps {
  className?: string;
}

export const ReferralStatusBanner: React.FC<ReferralStatusBannerProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { expiredNotice, clearExpiredNotice } = useReferralStatus();

  if (!expiredNotice) return null;

  const isAlreadyUsed = expiredNotice.reason === 'already_used';

  const message = isAlreadyUsed
    ? t('already_redeemed_message', 'You have already redeemed this referral code.')
    : t('link_expired_message', 'This referral link is no longer active.');

  const followUp = t('regular_prices_apply', 'You can still purchase this product at the regular price.');

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`w-full z-40 ${className}`}
    >
      <div className="container-page py-2 flex items-center justify-between gap-3 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
        <p className="min-w-0">
          {message} {followUp}
        </p>

        <button
          type="button"
          onClick={clearExpiredNotice}
          className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer shrink-0"
          title={t('dismiss', 'Dismiss')}
          aria-label={t('dismiss', 'Dismiss')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default ReferralStatusBanner;

