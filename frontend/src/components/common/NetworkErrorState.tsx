import React from 'react';
import { useTranslation } from 'react-i18next';
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

  const displayDesc =
    description ||
    (error
      ? t(error.descKey, error.defaultDesc)
      : t('error_network_desc', 'There is a network issue. Please check your internet connection.'));

  const actions = (
    <>
      {onRetry && (
        <>
          {' '}
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="underline font-medium text-neutral-900 dark:text-white hover:opacity-80 disabled:opacity-50 cursor-pointer"
          >
            {isRetrying ? t('loading', 'Loading...') : t('error_retry_btn', 'Retry')}
          </button>
        </>
      )}
      {secondaryAction && (
        <>
          {onRetry ? ' · ' : ' '}
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="underline font-medium text-neutral-900 dark:text-white hover:opacity-80 cursor-pointer"
          >
            {secondaryAction.label}
          </button>
        </>
      )}
    </>
  );

  if (compact) {
    return (
      <div
        className={`py-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 ${className}`}
        role="alert"
      >
        <p>
          {title ? `${title}. ${displayDesc}` : displayDesc}
          {actions}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`col-span-full w-full py-10 px-4 text-center text-sm sm:text-base text-neutral-600 dark:text-neutral-300 ${className}`}
      role="alert"
    >
      <p>
        {title ? `${title}. ${displayDesc}` : displayDesc}
        {actions}
      </p>
    </div>
  );
};

export default NetworkErrorState;

