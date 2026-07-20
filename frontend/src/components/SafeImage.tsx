import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Car, Home, Wrench, Laptop, Smartphone, Shirt, Sofa, Briefcase, Book, ShoppingBag, Cog } from 'lucide-react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  category?: string;
  containMode?: 'cover' | 'contain' | 'blur-fill';
}

/**
 * Image wrapper with global onerror fallback and lazy loading.
 * Replaces errored images with an elegant SVG icon placeholder supporting dark mode.
 * Supports different containment modes including blurred-edge fill for arbitrary aspect ratios.
 */
const SafeImage: React.FC<SafeImageProps> = ({
  fallback, // no longer needed, we use the icon
  onError,
  loading = 'lazy',
  src,
  className = '',
  alt,
  category = '',
  containMode = 'cover',
  onLoad,
  ...props
}) => {
  const [errored, setErrored] = useState(false);
  const [containerRatio, setContainerRatio] = useState<number | null>(null);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const measureContainer = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (width && height) {
        setContainerRatio(width / height);
      }
    }
  }, []);

  useEffect(() => {
    if (containMode !== 'blur-fill') return;
    measureContainer();
    window.addEventListener('resize', measureContainer);
    return () => window.removeEventListener('resize', measureContainer);
  }, [containMode, measureContainer]);

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

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setImageRatio(img.naturalWidth / img.naturalHeight);
    }
    measureContainer();
    onLoad?.(e);
  };

  const isInvalid = !safeSrc || errored;

  const getFallbackIcon = () => {
    const cat = category.toLowerCase();
    
    // Accessories / Gear (e.g. Car accessories)
    if (
      cat.includes('accessory') ||
      cat.includes('accessories') ||
      cat.includes('gear')
    ) {
      return <Cog className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }
    
    // Spares / Parts / Mechanic tools
    if (
      cat.includes('spare') || 
      cat.includes('part') || 
      cat.includes('engine') || 
      cat.includes('exhaust') ||
      cat.includes('tire') ||
      cat.includes('wheel') ||
      cat.includes('hydraulic') ||
      cat.includes('valve') ||
      cat.includes('sensor') ||
      cat.includes('light') ||
      cat.includes('tool')
    ) {
      return <Wrench className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }
    
    // Vehicles / Cars
    if (
      cat.includes('car') || 
      cat.includes('vehicle') || 
      cat.includes('suv') || 
      cat.includes('motor') || 
      cat.includes('truck') ||
      cat.includes('jeep') ||
      cat.includes('tesla') ||
      cat.includes('toyota') ||
      cat.includes('bmw') ||
      cat.includes('subaru') ||
      cat.includes('ford') ||
      cat.includes('honda') ||
      cat.includes('yamaha') ||
      cat.includes('bike') ||
      cat.includes('cycle')
    ) {
      return <Car className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }
    
    // Real Estate / Property
    if (
      cat.includes('estate') || 
      cat.includes('property') || 
      cat.includes('house') || 
      cat.includes('apartment') || 
      cat.includes('home') || 
      cat.includes('land') || 
      cat.includes('building') ||
      cat.includes('office') ||
      cat.includes('room')
    ) {
      return <Home className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }

    // Phones & Tablets
    if (
      cat.includes('phone') ||
      cat.includes('mobile') ||
      cat.includes('tablet') ||
      cat.includes('ipad') ||
      cat.includes('smartphone') ||
      cat.includes('watch') ||
      cat.includes('wearable')
    ) {
      return <Smartphone className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }

    // Electronics & Computers
    if (
      cat.includes('computer') ||
      cat.includes('laptop') ||
      cat.includes('desktop') ||
      cat.includes('electronic') ||
      cat.includes('tv') ||
      cat.includes('television') ||
      cat.includes('monitor') ||
      cat.includes('screen') ||
      cat.includes('camera') ||
      cat.includes('audio') ||
      cat.includes('speaker') ||
      cat.includes('headphone')
    ) {
      return <Laptop className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }

    // Fashion & Apparel
    if (
      cat.includes('fashion') ||
      cat.includes('apparel') ||
      cat.includes('clothing') ||
      cat.includes('shirt') ||
      cat.includes('pant') ||
      cat.includes('dress') ||
      cat.includes('shoe') ||
      cat.includes('wear') ||
      cat.includes('jewelry') ||
      cat.includes('bag')
    ) {
      return <Shirt className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }

    // Home & Furniture
    if (
      cat.includes('furniture') ||
      cat.includes('sofa') ||
      cat.includes('couch') ||
      cat.includes('chair') ||
      cat.includes('table') ||
      cat.includes('bed') ||
      cat.includes('kitchen') ||
      cat.includes('appliance') ||
      cat.includes('decor')
    ) {
      return <Sofa className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }

    // Jobs & Services
    if (
      cat.includes('job') ||
      cat.includes('service') ||
      cat.includes('work') ||
      cat.includes('gig') ||
      cat.includes('labor')
    ) {
      return <Briefcase className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }

    // Books & Education
    if (
      cat.includes('book') ||
      cat.includes('read') ||
      cat.includes('education') ||
      cat.includes('school') ||
      cat.includes('course') ||
      cat.includes('stationery')
    ) {
      return <Book className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
    }
    
    // Default Tanzanian Marketplace / Shopping
    return <ShoppingBag className="w-1/3 h-1/3 min-w-[24px] min-h-[24px] max-w-[64px] max-h-[64px]" strokeWidth={1.2} />;
  };

  if (isInvalid) {
    return (
      <div 
        className={`flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900/35 border border-neutral-100/50 dark:border-neutral-800/30 text-neutral-300 dark:text-neutral-700 ${className}`}
        {...(props as any)}
      >
        {getFallbackIcon()}
      </div>
    );
  }

  if (containMode === 'blur-fill') {
    // Strip object-cover or object-contain from the wrapper className since the wrapper container handles containment
    const cleanClassName = className.replace(/\bobject-(cover|contain|top|center|bottom|left|right)\b/g, '').trim();

    // Determine if we should use blur based on aspect ratio difference
    let shouldBlur = true;
    if (imageRatio && containerRatio) {
      const ratioDiff = Math.abs(Math.log(imageRatio / containerRatio));
      // If the aspect ratio difference is less than 0.38 (~30% cropping margin),
      // we can crop with object-cover and skip the blurred background.
      if (ratioDiff < 0.38) {
        shouldBlur = false;
      }
    } else {
      // Default to no blur until dimensions are resolved
      shouldBlur = false;
    }

    return (
      <div 
        ref={containerRef}
        className={`relative overflow-hidden flex items-center justify-center ${cleanClassName}`}
      >
        {shouldBlur && (
          <img
            src={safeSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover filter blur-xl scale-110 opacity-30 dark:opacity-40 select-none pointer-events-none"
            loading="lazy"
          />
        )}
        {/* Crisp original copy of the image */}
        <img
          {...props}
          src={safeSrc}
          alt={alt}
          loading={loading}
          onError={handleError}
          onLoad={handleLoad}
          className={`relative z-10 w-full h-full transition-all duration-300 ${
            shouldBlur ? 'object-contain max-w-full max-h-full' : 'object-cover'
          }`}
        />
      </div>
    );
  }

  return (
    <img
      {...props}
      className={`${className} ${containMode === 'contain' ? 'object-contain' : 'object-cover'}`}
      alt={alt}
      src={safeSrc}
      loading={loading}
      onError={handleError}
      onLoad={onLoad}
    />
  );
};

export default SafeImage;
