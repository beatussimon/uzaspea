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

    // Find closest horizontally scrollable element
    let target = e.target as HTMLElement | null;
    let horizontalContainer: HTMLElement | null = null;

    while (target && target !== document.body && target !== document.documentElement) {
      const isMarked = target.hasAttribute('data-horizontal-scroll') ||
        target.classList.contains('overflow-x-auto') ||
        target.classList.contains('no-scrollbar') ||
        target.classList.contains('hide-scrollbar') ||
        target.classList.contains('scrollbar-hide');

      if (isMarked || target.scrollWidth > target.clientWidth + 2) {
        const computed = window.getComputedStyle(target);
        const overflowX = computed.overflowX;
        const overflowY = computed.overflowY;

        const isScrollableX = (overflowX === 'auto' || overflowX === 'scroll' || isMarked) &&
                              target.scrollWidth > target.clientWidth + 2;
        
        // Ensure it is not a large primarily vertically scrollable area
        const isPrimarilyVertical = (overflowY === 'auto' || overflowY === 'scroll') &&
                                     target.scrollHeight > target.clientHeight + 20 &&
                                     target.clientHeight > 200;

        if (isScrollableX && !isPrimarilyVertical) {
          horizontalContainer = target;
          break;
        }
      }
      target = target.parentElement;
    }

    if (!horizontalContainer) return;

    const el = horizontalContainer;
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
