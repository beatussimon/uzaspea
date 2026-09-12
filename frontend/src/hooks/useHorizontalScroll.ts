import { useRef, useEffect } from 'react';

/**
 * Universal mouse-wheel horizontal scroll handler.
 * Translates vertical wheel movements (deltaY) into horizontal scroll movements (scrollLeft)
 * when hovering over horizontally scrollable containers (like pills, category bars, tab strips).
 * When reaching the start/end boundaries, it does not prevent default, allowing natural vertical page scrolling.
 */
export function initGlobalHorizontalScroll(): () => void {
  const handleWheel = (e: WheelEvent) => {
    // If not a vertical scroll or horizontal swipe is dominant (e.g. 2-finger trackpad horizontal gesture), let native handling take over
    if (e.deltaY === 0 || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
      return;
    }

    // Only intercept containers explicitly designated for horizontal wheel translation
    const target = e.target as HTMLElement | null;
    const el = target ? (target.closest('[data-horizontal-scroll="true"]') as HTMLElement | null) : null;

    if (!el || el.scrollWidth <= el.clientWidth + 2) return;
    const isAtLeftEdge = el.scrollLeft <= 0 && e.deltaY < 0;
    const isAtRightEdge = Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth - 1 && e.deltaY > 0;

    // If there is room to scroll horizontally in the direction of the wheel
    if (!isAtLeftEdge && !isAtRightEdge) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  };

  window.addEventListener('wheel', handleWheel, { passive: false });
  return () => {
    window.removeEventListener('wheel', handleWheel);
  };
}

/**
 * Reusable React Hook for attaching horizontal mouse-wheel scroll behavior to any element ref.
 */
export function useHorizontalScroll<T extends HTMLElement = HTMLDivElement>() {
  const elRef = useRef<T | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;

      const isScrollableX = el.scrollWidth > el.clientWidth + 2;
      if (!isScrollableX) return;

      const isAtLeft = el.scrollLeft <= 0 && e.deltaY < 0;
      const isAtRight = Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth - 1 && e.deltaY > 0;

      if (!isAtLeft && !isAtRight) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return elRef;
}
