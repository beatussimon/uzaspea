import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileIncomingMessageBubble } from '../chat/MobileIncomingMessageBubble';

export const ScrollToTopFab: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  // Scroll visibility handler
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

  // Route exclusions: ProductDetailPage handles its own floating action stack (cart + up button); messages page has its own UI
  const isProductDetail = location.pathname.startsWith('/product/');
  const isMessagesRoute = location.pathname.startsWith('/messages');

  if (isProductDetail || isMessagesRoute) {
    return null;
  }

  return (
    <>
      {/* ═══ MOBILE FLOATING ACTIONS STACK ═══
          Uses flex-col-reverse:
          - Bottom slot: Up Arrow Button (Scroll to top)
          - Above slot: Active / Incoming Message Bubble
          When page is NOT scrolled (Up Button is hidden), Message Bubble takes its place at the bottom!
          When page IS scrolled (Up Button appears), Message Bubble hovers directly above the Up Button!
      */}
      <div
        className="md:hidden fixed z-40 flex flex-col-reverse items-center gap-2.5 pointer-events-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          right: '20px',
        }}
      >
        {/* Bottom Slot: Scroll to top Up Button */}
        <AnimatePresence>
          {isVisible && (
            <motion.button
              key="scroll-to-top-mobile"
              layout
              initial={{ scale: 0, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 15 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              type="button"
              onClick={scrollToTop}
              className="pointer-events-auto w-11 h-11 rounded-full shadow-xl bg-white dark:bg-[#111111] text-gray-900 dark:text-white border border-gray-200 dark:border-[#222222] flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Scroll to top"
              title="Scroll to top"
            >
              <ArrowUp size={20} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Above Slot (or taking bottom slot if not scrolled): Mobile Active/Incoming Message Bubble */}
        <MobileIncomingMessageBubble />
      </div>

      {/* ═══ DESKTOP SCROLL TO TOP BUTTON ═══
          Desktop chat bubbles are handled in DesktopChatDock.tsx.
          Here we display the desktop Up Button when scrolled.
      */}
      <AnimatePresence>
        {isVisible && (
          <motion.button
            key="scroll-to-top-desktop"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            type="button"
            onClick={scrollToTop}
            className="hidden md:flex fixed z-40 p-3 rounded-full shadow-lg bg-white dark:bg-[#111111] text-gray-900 dark:text-white border border-gray-200 dark:border-[#222222] items-center justify-center cursor-pointer transition-colors"
            style={{
              bottom: '80px',
              right: '24px',
            }}
            aria-label="Scroll to top"
            title="Scroll to top"
          >
            <ArrowUp size={20} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};
export default ScrollToTopFab;
