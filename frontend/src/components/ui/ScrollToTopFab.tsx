import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTopFab: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const snapContainer = document.querySelector('.snap-container') as HTMLElement;
          const currentY = snapContainer ? snapContainer.scrollTop : window.scrollY;
          
          if (currentY > 300) {
            setIsVisible(true);
          } else {
            setIsVisible(false);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    
    // Initial check
    handleScroll();

    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  const scrollToTop = () => {
    const snapContainer = document.querySelector('.snap-container') as HTMLElement;
    if (snapContainer) {
      snapContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed z-40 p-3 rounded-full shadow-lg bg-white dark:bg-[#111111] text-gray-900 dark:text-white border border-gray-200 dark:border-[#222222] transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
      // Positioned slightly above the MobileBottomNav area so it doesn't overlap
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        right: '20px'
      }}
      aria-label="Scroll to top"
    >
      <ArrowUp size={20} />
    </button>
  );
};
