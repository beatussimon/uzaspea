import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '../../i18n';

interface LanguageSelectorProps {
  variant?: 'navbar-dropdown' | 'mobile-segmented' | 'drawer-list';
  className?: string;
  onSelect?: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'navbar-dropdown',
  className = '',
  onSelect,
}) => {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const rawLang = i18n.language?.split('-')[0] || 'en';
  const currentLang = (SUPPORTED_LANGUAGES.some((l) => l.code === rawLang) ? rawLang : 'en') as SupportedLanguageCode;
  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  const handleLanguageChange = (code: SupportedLanguageCode) => {
    i18n.changeLanguage(code);
    setOpen(false);
    onSelect?.();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Mobile Segmented Control (inline pills)
  if (variant === 'mobile-segmented') {
    return (
      <div className={`flex items-center p-1 bg-gray-100 dark:bg-neutral-800/80 rounded-xl gap-1 ${className}`}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = currentLang === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLanguageChange(lang.code)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-neutral-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="text-sm">{lang.flag}</span>
              <span>{lang.code.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // 2. Drawer List (Full touch rows for mobile drawer)
  if (variant === 'drawer-list') {
    return (
      <div className={`space-y-1 ${className}`}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = currentLang === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left ${
                isActive
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                  : 'hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-700 dark:text-gray-300 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{lang.flag}</span>
                <div>
                  <p className="text-sm leading-tight font-semibold">{lang.nativeLabel}</p>
                  <p className="text-[10px] text-gray-400 font-normal">{lang.region}</p>
                </div>
              </div>
              {isActive && <Check size={18} className="text-brand-500" />}
            </button>
          );
        })}
      </div>
    );
  }

  // 3. Navbar Dropdown (Desktop Navbar)
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-neutral-700 text-xs font-bold text-gray-700 dark:text-gray-200"
        aria-label="Select Language"
        aria-expanded={open}
      >
        <span className="text-sm">{currentLangObj.flag}</span>
        <span className="text-[11px] uppercase tracking-wider font-extrabold">{currentLangObj.code}</span>
        <ChevronDown size={13} className={`transition-transform duration-200 text-gray-400 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-48 bg-white dark:bg-[#141414] rounded-2xl shadow-xl border border-gray-100 dark:border-neutral-800 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
            {t('language', 'Language')}
          </div>
          <div className="space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors ${
                    isActive
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                      : 'hover:bg-gray-50 dark:hover:bg-neutral-800/60 text-gray-700 dark:text-gray-300 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{lang.flag}</span>
                    <div className="text-left">
                      <div className="leading-none font-semibold">{lang.nativeLabel}</div>
                      <span className="text-[9px] text-gray-400 font-normal">{lang.region}</span>
                    </div>
                  </div>
                  {isActive && <Check size={14} className="text-brand-500" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
