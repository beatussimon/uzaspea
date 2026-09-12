import React from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, ServerCrash, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { ClassifiedError } from '../../utils/errorUtils';

interface NetworkErrorStateProps {
  error?: ClassifiedError | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  compact?: boolean;
  className?: string;
  title?: string;
  description?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const NetworkErrorState: React.FC<NetworkErrorStateProps> = ({
  error,
  onRetry,
  isRetrying = false,
  compact = false,
  className = '',
  title,
  description,
  secondaryAction,
}) => {
  const { t } = useTranslation();

  const errorType = error?.type || 'offline';
  const isServer = errorType === 'server';
  const isTimeout = errorType === 'timeout';

  const displayTitle = title || (error ? t(error.titleKey, error.defaultTitle) : t('error_network_title', 'Connection Problem'));
  const displayDesc = description || (error ? t(error.descKey, error.defaultDesc) : t('error_network_desc', "It's not you! We couldn't connect to SokoniMax. Please check your internet connection and try again."));

  // Compact layout (for shelves, pagination rows, or mini cards)
  if (compact) {
    return (
      <div
        className={`flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-neutral-200 ${className}`}
        role="alert"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            {isServer ? <ServerCrash size={18} /> : isTimeout ? <Clock size={18} /> : <WifiOff size={18} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                {t('error_its_not_you', "It's not you!")}
              </span>
              <p className="text-xs font-bold text-neutral-200 truncate">{displayTitle}</p>
            </div>
            <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">{displayDesc}</p>
          </div>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
            <span>{t('error_retry_btn', 'Retry')}</span>
          </button>
        )}
      </div>
    );
  }

  // Full container layout (for pages, empty product grid replacements, detail page)
  return (
    <div
      className={`col-span-full w-full py-12 px-6 text-center flex flex-col items-center justify-center bg-white dark:bg-black rounded-3xl border border-neutral-200 dark:border-neutral-900 shadow-sm ${className}`}
      role="alert"
    >
      {/* Icon with Glowing Engine Amber Halo */}
      <div className="relative mb-5">
        <div className="absolute -inset-2 bg-amber-500/20 dark:bg-amber-500/15 rounded-full blur-xl animate-pulse" />
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-amber-500/10 dark:bg-neutral-900 border border-amber-500/30 dark:border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
          {isServer ? (
            <ServerCrash className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={1.75} />
          ) : isTimeout ? (
            <Clock className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={1.75} />
          ) : (
            <WifiOff className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={1.75} />
          )}
        </div>
      </div>

      {/* Prominent "It's Not You" Badge */}
      <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-3">
        <AlertCircle size={13} className="shrink-0" />
        <span>{t('error_its_not_you', "It's not you!")}</span>
      </div>

      {/* Title */}
      <h3 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight mb-2 max-w-md">
        {displayTitle}
      </h3>

      {/* Clear Explanation */}
      <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-md mb-7 leading-relaxed font-medium">
        {displayDesc}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold bg-amber-500 text-black hover:bg-amber-400 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <RefreshCw size={15} className={isRetrying ? 'animate-spin' : ''} />
            <span>{isRetrying ? t('loading', 'Loading...') : t('error_retry_btn', 'Retry')}</span>
          </button>
        )}

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="px-5 py-3 rounded-full text-sm font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>

      {/* Reassurance Footer */}
      <div className="mt-8 pt-6 border-t border-neutral-200/60 dark:border-neutral-900 w-full max-w-xs text-[11px] text-neutral-400 dark:text-neutral-500">
        {isServer ? (
          <span>Backend status issue • Response code {error?.statusCode || 500}</span>
        ) : (
          <span>Network connection monitor • SokoniMax</span>
        )}
      </div>
    </div>
  );
};

export default NetworkErrorState;
