import React from 'react';
import { X, Loader2, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUserLocation } from '../../context/LocationContext';

export const LocationPromptBanner: React.FC = () => {
  const { permission, isLocating, requestLocation, dismissPrompt } = useUserLocation();
  const { t } = useTranslation();

  if (permission !== 'prompt') return null;

  return (
    <aside
      aria-label="Location notice"
      className="relative w-full max-w-sm sm:w-[360px] md:w-[380px] pointer-events-auto bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border border-gray-200/80 dark:border-neutral-800 shadow-2xl rounded-2xl p-4 transition-all duration-300 animate-slide-up flex items-start gap-3.5 text-left"
    >
      <div className="shrink-0">
        <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-black flex items-center justify-center shrink-0 shadow-inner border border-gray-200/60 dark:border-neutral-800 text-brand-500">
          <MapPin size={22} className="text-brand-500" />
        </div>
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
          {t('set_location_title', 'Set Delivery Location')}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed pr-4">
          {t('set_location_desc', 'Get accurate delivery fees, discover nearby pickup hubs, and enjoy faster checkout in Tanzania.')}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => requestLocation()}
            disabled={isLocating}
            className="btn-primary text-xs font-bold py-2 px-4 rounded-btn flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            {isLocating && <Loader2 size={13} className="animate-spin" />}
            <span>{isLocating ? t('locating', 'Locating...') : t('allow_location', 'Allow Location')}</span>
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-2.5 py-2 rounded-btn hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {t('not_now', 'Not now')}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={dismissPrompt}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-full p-1.5 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </aside>
  );
};

export default LocationPromptBanner;

