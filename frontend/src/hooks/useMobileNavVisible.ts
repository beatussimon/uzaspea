import { useState, useEffect } from 'react';

export const useMobileNavVisible = () => {
  const [isNavVisible, setIsNavVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const offset = document.documentElement.style.getPropertyValue('--mobile-nav-bottom-offset');
    return offset !== '16px';
  });

  useEffect(() => {
    const handleVisibility = (e: any) => {
      setIsNavVisible(Boolean(e.detail?.visible));
    };
    window.addEventListener('mobileNavVisibilityChange', handleVisibility);
    return () => {
      window.removeEventListener('mobileNavVisibilityChange', handleVisibility);
    };
  }, []);

  return isNavVisible;
};

export default useMobileNavVisible;
