import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUserLocation } from '../../context/LocationContext';

export const LocationPromptBanner: React.FC = () => {
  const { permission, isLocating, requestLocation, dismissPrompt } = useUserLocation();
  const { t } = useTranslation();

  if (permission !== 'prompt') return null;

  return (
    <aside
      aria-label="Location notice"
      className="relative w-full max-w-[330px] sm:w-[330px] pointer-events-auto bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md shadow-2xl rounded-2xl p-4 transition-all duration-300 animate-slide-up text-left"
    >
      <div>
        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 leading-snug pr-6">
          {t('set_location_title', 'Set Delivery Location')}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3.5 leading-relaxed">
          {t('set_location_desc', 'Get accurate delivery fees, discover nearby pickup hubs, and enjoy faster checkout in Tanzania.')}
        </p>

        <div>
          <button
            type="button"
            onClick={() => requestLocation()}
            disabled={isLocating}
            className="btn-primary w-full text-xs font-bold py-2.5 px-4 rounded-btn flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isLocating && <Loader2 size={13} className="animate-spin" />}
            <span>{isLocating ? t('locating', 'Locating...') : t('allow_location', 'Allow Location')}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={dismissPrompt}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </aside>
  );
};

export default LocationPromptBanner;

