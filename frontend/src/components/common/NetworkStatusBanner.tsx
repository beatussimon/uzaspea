import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface NetworkStatusBannerProps {
  className?: string;
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    const handleNetworkStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.online === false) {
        setIsOffline(true);
      } else if (customEvent.detail?.online === true) {
        setIsOffline(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('network_status_change', handleNetworkStatusChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('network_status_change', handleNetworkStatusChange);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full z-40 ${className}`}
    >
      <div className="container-page py-2 flex items-center justify-between gap-3 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
        <p className="min-w-0">
          {t('offline_banner_text', 'There is a network issue. Please check your internet connection.')}{' '}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline font-medium text-neutral-900 dark:text-white hover:opacity-80 cursor-pointer"
          >
            {t('error_retry_btn', 'Retry')}
          </button>
        </p>
      </div>
    </div>
  );
};

export default NetworkStatusBanner;

