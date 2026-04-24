import React, { useState } from 'react';

const FALLBACK_IMAGE = '/no_image.png';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

/**
 * Image wrapper with global onerror fallback and lazy loading.
 * Replaces all raw <img> tags to handle 404s gracefully.
 */
const SafeImage: React.FC<SafeImageProps> = ({
  fallback = FALLBACK_IMAGE,
  onError,
  loading = 'lazy',
  ...props
}) => {
  const [errored, setErrored] = useState(false);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!errored) {
      setErrored(true);
      (e.target as HTMLImageElement).src = fallback;
    }
    onError?.(e);
  };

  return (
    <img
      {...props}
      loading={loading}
      onError={handleError}
    />
  );
};

export default SafeImage;
