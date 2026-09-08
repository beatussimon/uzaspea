import React, { useState } from 'react';
import { Navigation, MapPin, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMapLaunchUrls, setStoredMapPreference } from '../utils/mapNavigation';

interface MapAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number | string;
  lng: number | string;
  mode: 'navigate' | 'open';
}

export const MapAppModal: React.FC<MapAppModalProps> = ({
  isOpen,
  onClose,
  lat,
  lng,
  mode
}) => {
  const { t } = useTranslation();
  const [remember, setRemember] = useState(true);

  if (!isOpen) return null;

  const urls = getMapLaunchUrls(lat, lng);

  const handleSelect = (app: 'apple' | 'google') => {
    if (remember) {
      setStoredMapPreference(app);
    }

    if (app === 'apple') {
      window.location.href = mode === 'navigate' ? urls.appleNavigate : urls.appleOpen;
    } else {
      window.location.href = mode === 'navigate' ? urls.googleNavigate : urls.googleOpen;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white dark:bg-[#121212] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-800 transition-all transform"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              {mode === 'navigate' ? <Navigation size={16} /> : <MapPin size={16} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                {mode === 'navigate' 
                  ? t('navigate_with', 'Navigate with Maps') 
                  : t('open_with', 'Open with Maps')}
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {t('choose_map_app_desc', 'Select your preferred map app on this Apple device')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 space-y-2.5">
          {/* Apple Maps Option */}
          <button
            type="button"
            onClick={() => handleSelect('apple')}
            className="w-full flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 hover:border-blue-500 dark:hover:border-blue-500 transition group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-black text-sm shadow-sm">
                
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-900 dark:text-white block group-hover:text-blue-500 transition">
                  {t('apple_maps', 'Apple Maps')}
                </span>
                <span className="text-[10.5px] text-neutral-500 dark:text-neutral-400 block">
                  {t('apple_maps_desc', 'Default maps app for Apple devices')}
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-500">→</span>
          </button>

          {/* Google Maps Option */}
          <button
            type="button"
            onClick={() => handleSelect('google')}
            className="w-full flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 hover:border-blue-500 dark:hover:border-blue-500 transition group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-black text-sm shadow-sm">
                <Navigation size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-900 dark:text-white block group-hover:text-blue-500 transition">
                  {t('google_maps', 'Google Maps')}
                </span>
                <span className="text-[10.5px] text-neutral-500 dark:text-neutral-400 block">
                  {t('google_maps_desc', 'Turn-by-turn navigation & live traffic')}
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-500">→</span>
          </button>

          {/* Remember Choice Checkbox */}
          <label className="flex items-center gap-2 pt-1.5 px-1 cursor-pointer select-none">
            <div 
              onClick={() => setRemember(!remember)}
              className={`w-4 h-4 rounded flex items-center justify-center transition border ${
                remember 
                  ? 'bg-blue-500 border-blue-500 text-white' 
                  : 'border-neutral-300 dark:border-neutral-700 bg-transparent'
              }`}
            >
              {remember && <Check size={11} strokeWidth={3} />}
            </div>
            <span 
              onClick={() => setRemember(!remember)}
              className="text-xs text-neutral-600 dark:text-neutral-400 font-medium"
            >
              {t('remember_map_choice', 'Remember my choice')}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-3 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition"
          >
            {t('cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
