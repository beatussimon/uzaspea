import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

/**
 * Image wrapper with global onerror fallback and lazy loading.
 * Replaces errored images with an elegant SVG icon placeholder supporting dark mode.
 */
const SafeImage: React.FC<SafeImageProps> = ({
  fallback, // no longer needed, we use the icon
  onError,
  loading = 'lazy',
  src,
  className = '',
  alt,
  ...props
}) => {
  const [errored, setErrored] = useState(false);

  let safeSrc = src;
  if (typeof safeSrc === 'string' && safeSrc.startsWith('http://') && window.location.protocol === 'https:') {
    safeSrc = safeSrc.replace('http://', 'https://');
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!errored) {
      setErrored(true);
    }
    onError?.(e);
  };

  const isInvalid = !safeSrc || errored;

  if (isInvalid) {
    return (
      <div 
        className={`flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 ${className}`}
        {...(props as any)}
      >
        <Package className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1} />
      </div>
    );
  }

  return (
    <img
      {...props}
      className={className}
      alt={alt}
      src={safeSrc}
      loading={loading}
      onError={handleError}
    />
  );
};

export default SafeImage;
