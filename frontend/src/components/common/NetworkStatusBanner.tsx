import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export const NetworkStatusBanner: React.FC = () => {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    let timer: any;

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
    };

    const handleOffline = () => {
      clearTimeout(timer);
      setShowRestored(false);
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showRestored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[9999] transition-all duration-300 transform ${
        isOffline
          ? 'bg-neutral-950 text-neutral-100 border-b border-amber-500/40 shadow-lg shadow-black/40'
          : 'bg-emerald-950 text-emerald-100 border-b border-emerald-500/40 shadow-lg shadow-black/40'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2.5 min-w-0">
          {isOffline ? (
            <div className="p-1 rounded-md bg-amber-500/20 text-amber-400 shrink-0 animate-pulse">
              <WifiOff size={16} />
            </div>
          ) : (
            <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 shrink-0">
              <Wifi size={16} />
            </div>
          )}

          <div className="flex items-center gap-2 min-w-0 truncate">
            {isOffline && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {t('error_its_not_you', "It's not you!")}
              </span>
            )}
            <span className="truncate">
              {isOffline
                ? t('offline_banner_text', "You're offline. Products and content cannot be updated.")
                : t('online_restored_text', "Connection restored. You're back online!")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              isOffline
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                : 'bg-emerald-500 text-black hover:bg-emerald-400'
            }`}
          >
            <RefreshCw size={12} />
            <span>{t('refresh', 'Refresh')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NetworkStatusBanner;
