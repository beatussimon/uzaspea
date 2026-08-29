import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { useUserLocation } from '../../context/LocationContext';

export const LocationPromptBanner: React.FC = () => {
  const { permission, isLocating, requestLocation, dismissPrompt } = useUserLocation();

  if (permission !== 'prompt') return null;

  return (
    <aside
      aria-label="Location notice"
      className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100%-2.5rem)] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/80 dark:border-gray-800 shadow-2xl rounded-2xl p-4 transition-all duration-300 animate-slide-up"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
            Set Delivery Location?
          </h4>
          <button
            type="button"
            onClick={dismissPrompt}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 -mr-1 -mt-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-2xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
          Get accurate delivery fees, discover nearby pickup hubs, and enjoy faster checkout in Tanzania.
        </p>

        <div className="flex items-center gap-2 mt-3 pt-0.5">
          <button
            type="button"
            onClick={() => requestLocation()}
            disabled={isLocating}
            className="btn-primary text-xs px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
          >
            {isLocating && <Loader2 size={13} className="animate-spin" />}
            <span>{isLocating ? 'Locating...' : 'Allow Location'}</span>
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </aside>
  );
};

export default LocationPromptBanner;
