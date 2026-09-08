import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '../../i18n';

interface LanguageSelectorProps {
  variant?: 'navbar-dropdown' | 'mobile-segmented' | 'drawer-list';
  className?: string;
  onSelect?: () => void;
}

// Crisp, cross-platform SVG Flag component for guaranteed rendering across all OSes
export const LanguageFlag: React.FC<{ code: string; className?: string }> = ({
  code,
  className = 'w-5 h-3.5',
}) => {
  switch (code) {
    case 'sw': // Tanzania (TZ)
      return (
        <svg
          viewBox="0 0 640 480"
          className={`${className} rounded-[2px] object-cover shrink-0 shadow-xs border border-black/10 dark:border-white/10`}
          aria-hidden="true"
        >
          <defs>
            <clipPath id="tz-flag-clip">
              <path d="M0 0h640v480H0z" />
            </clipPath>
          </defs>
          <g clipPath="url(#tz-flag-clip)">
            <path fill="#1eb53a" d="M0 0h640L0 480V0z" />
            <path fill="#00a3dd" d="M640 0v480H0l640-480z" />
            <path fill="#fcd116" d="M-50 480L640-37.5v117.5L50 560H-50V480z" />
            <path fill="#000" d="M-60 480L640-45v80L-20 540H-60V480z" />
          </g>
        </svg>
      );
    case 'en': // United States (US)
      return (
        <svg
          viewBox="0 0 640 480"
          className={`${className} rounded-[2px] object-cover shrink-0 shadow-xs border border-black/10 dark:border-white/10`}
          aria-hidden="true"
        >
          <g fillRule="evenodd">
            <path fill="#bd3d44" d="M0 0h640v480H0z" />
            <path stroke="#fff" strokeWidth="37" d="M0 55.4h640M0 129.2h640M0 203h640M0 277h640M0 350.8h640M0 424.6h640" />
            <path fill="#192f5d" d="M0 0h256v258.5H0z" />
            <g fill="#fff">
              <circle cx="32" cy="24" r="7" /><circle cx="96" cy="24" r="7" /><circle cx="160" cy="24" r="7" /><circle cx="224" cy="24" r="7" />
              <circle cx="64" cy="48" r="7" /><circle cx="128" cy="48" r="7" /><circle cx="192" cy="48" r="7" />
              <circle cx="32" cy="72" r="7" /><circle cx="96" cy="72" r="7" /><circle cx="160" cy="72" r="7" /><circle cx="224" cy="72" r="7" />
              <circle cx="64" cy="96" r="7" /><circle cx="128" cy="96" r="7" /><circle cx="192" cy="96" r="7" />
              <circle cx="32" cy="120" r="7" /><circle cx="96" cy="120" r="7" /><circle cx="160" cy="120" r="7" /><circle cx="224" cy="120" r="7" />
              <circle cx="64" cy="144" r="7" /><circle cx="128" cy="144" r="7" /><circle cx="192" cy="144" r="7" />
              <circle cx="32" cy="168" r="7" /><circle cx="96" cy="168" r="7" /><circle cx="160" cy="168" r="7" /><circle cx="224" cy="168" r="7" />
              <circle cx="64" cy="192" r="7" /><circle cx="128" cy="192" r="7" /><circle cx="192" cy="192" r="7" />
              <circle cx="32" cy="216" r="7" /><circle cx="96" cy="216" r="7" /><circle cx="160" cy="216" r="7" /><circle cx="224" cy="216" r="7" />
            </g>
          </g>
        </svg>
      );
    case 'fr': // French (France)
      return (
        <svg
          viewBox="0 0 640 480"
          className={`${className} rounded-[2px] object-cover shrink-0 shadow-xs border border-black/10 dark:border-white/10`}
          aria-hidden="true"
        >
          <g fillRule="evenodd" strokeWidth="1pt">
            <path fill="#fff" d="M0 0h640v480H0z" />
            <path fill="#00267f" d="M0 0h213.3v480H0z" />
            <path fill="#f31830" d="M426.7 0H640v480H426.7z" />
          </g>
        </svg>
      );
    default:
      return null;
  }
};

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
              <LanguageFlag code={lang.code} className="w-4 h-3" />
              <span>{lang.code.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // 2. Drawer Dropdown (Integrated, human menu item for mobile drawer)
  if (variant === 'drawer-list') {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg transition-colors group text-gray-700 dark:text-gray-300 text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-3">
            <Globe size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
            <span className="text-sm font-medium">{t('language', 'Language')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-neutral-500 font-medium">
            <span>{currentLangObj.nativeLabel}</span>
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${open ? 'rotate-180 text-gray-600 dark:text-neutral-300' : ''}`}
            />
          </div>
        </button>

        {open && (
          <div className="py-1 space-y-0.5 animate-in fade-in duration-150">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  className="w-full flex items-center justify-between pl-11 pr-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-gray-100/70 dark:hover:bg-neutral-900/70"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <LanguageFlag code={lang.code} />
                    <span
                      className={
                        isActive
                          ? 'font-semibold text-gray-900 dark:text-white'
                          : 'font-normal text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                      }
                    >
                      {lang.nativeLabel}
                    </span>
                  </div>
                  {isActive && (
                    <Check size={16} className="text-gray-900 dark:text-white shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
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
        <LanguageFlag code={currentLangObj.code} />
        <span className="text-[11px] uppercase tracking-wider font-extrabold">{currentLangObj.code}</span>
        <ChevronDown size={13} className={`transition-transform duration-200 text-gray-400 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-44 bg-white dark:bg-[#141414] rounded-2xl shadow-xl border border-gray-100 dark:border-neutral-800 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
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
                      ? 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-semibold'
                      : 'hover:bg-gray-50 dark:hover:bg-neutral-800/60 text-gray-700 dark:text-gray-300 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <LanguageFlag code={lang.code} />
                    <span className="leading-none font-semibold">{lang.nativeLabel}</span>
                  </div>
                  {isActive && <Check size={14} className="text-gray-900 dark:text-white shrink-0" />}
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
