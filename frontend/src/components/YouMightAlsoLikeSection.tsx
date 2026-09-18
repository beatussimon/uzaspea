import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';
import { getRecentProductIdsParam } from '../utils/recentViews';

export interface YouMightAlsoLikeSectionProps {
  currentProductId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product?: any;
  isDesktop?: boolean;
  className?: string;
}

export const YouMightAlsoLikeSection: React.FC<YouMightAlsoLikeSectionProps> = ({
  currentProductId,
  product,
  isDesktop = false,
  className = '',
}) => {
  const { t } = useTranslation();

  // Pre-bundled recommendations from the product detail response (zero latency)
  const preloadedList = useMemo(() => {
    if (product && Array.isArray(product.recommended_products) && product.recommended_products.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return product.recommended_products.filter((p: any) => p.id !== currentProductId);
    }
    return null;
  }, [product, currentProductId]);

  const hasPreloaded = preloadedList !== null && preloadedList.length > 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<any[]>(() => (hasPreloaded ? preloadedList : []));
  const [loading, setLoading] = useState<boolean>(() => !hasPreloaded);

  // Mobile collapsible state (expanded by default, collapsible by tapping header or chevron)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Desktop carousel scrolling
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const checkScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  const handleScrollPrev = () => {
    if (carouselRef.current) {
      const scrollAmount = carouselRef.current.clientWidth + 16;
      carouselRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const handleScrollNext = () => {
    if (carouselRef.current) {
      const scrollAmount = carouselRef.current.clientWidth + 16;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Fetch recommendations if not preloaded in product detail payload
  useEffect(() => {
    let isMounted = true;

    if (hasPreloaded) {
      setProducts(preloadedList);
      setLoading(false);
      return;
    }

    setLoading(true);
    const fetchRecommendations = async () => {
      try {
        const res = await api.get('/api/products/recommendations/', {
          params: {
            product_id: currentProductId,
            limit: isDesktop ? 9 : 4,
            exclude: currentProductId.toString(),
            recent_ids: getRecentProductIdsParam(),
          },
        });

        const rawList = res.data?.products || (Array.isArray(res.data) ? res.data : []);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filtered = rawList.filter((p: any) => p.id !== currentProductId);

        if (isMounted) {
          setProducts(filtered);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load recommended products:', err);
        if (isMounted) {
          setProducts([]);
          setLoading(false);
        }
      }
    };

    fetchRecommendations();

    return () => {
      isMounted = false;
    };
  }, [currentProductId, isDesktop, hasPreloaded, preloadedList]);

  // Update desktop carousel scroll button states
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const timer = setTimeout(checkScroll, 50);
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [products, isDesktop, checkScroll]);

  // Mobile constraint: Strictly 2 rows (in 2-col grid = exactly 4 items)
  // Drop trailing item if odd count so rows are always completely full
  const visibleMobileProducts = useMemo(() => {
    const maxItems = 4; // strictly 2 rows on mobile (2 cols x 2 rows)
    const capped = products.slice(0, maxItems);
    const fullRowCount = Math.floor(capped.length / 2) * 2;
    return capped.slice(0, fullRowCount);
  }, [products]);

  // Desktop items: multiple of 3 (up to 9 items = 3 full slides of 3 cards)
  const visibleDesktopProducts = useMemo(() => {
    return products.slice(0, 9);
  }, [products]);

  // Hide section entirely if finished loading and no recommendations available
  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section className={`w-full mb-4 sm:mb-5 ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between pt-4 lg:pt-5 pb-2 mb-3 sm:mb-4 lg:px-6">
        <div className="flex items-center gap-2 min-w-0 pb-2">
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-none truncate">
            {t('you_might_also_like', 'You Might Also Like')}
          </h2>
          {products.length > 0 && (
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 shrink-0">
              {isDesktop ? visibleDesktopProducts.length : visibleMobileProducts.length}
            </span>
          )}
        </div>

        {/* Right Header Controls: Mobile Collapsible Toggle or Desktop Carousel Arrows */}
        {!isDesktop ? (
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer px-2.5 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800"
            aria-expanded={!isCollapsed}
            aria-label="Toggle You Might Also Like section"
          >
            <span>{isCollapsed ? t('expand', 'Show') : t('collapse', 'Hide')}</span>
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 transition-transform duration-200" />
            ) : (
              <ChevronUp className="w-4 h-4 transition-transform duration-200" />
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 mr-1">
            {canScrollLeft ? (
              <div className="relative inline-flex items-center justify-center p-[2.5px] rounded-full">
                {/* Glowing spectrum rainbow gradient ring */}
                <div
                  className="absolute inset-0 rounded-full animate-[spin_3.5s_linear_infinite]"
                  style={{
                    background: 'conic-gradient(from 0deg, #facc15, #fb923c, #f43f5e, #a855f7, #3b82f6, #06b6d4, #10b981, #facc15)',
                    boxShadow: '0 0 14px rgba(244,63,94,0.6), 0 0 8px rgba(59,130,246,0.45)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleScrollPrev}
                  disabled={!canScrollLeft}
                  aria-label="Previous recommendations"
                  className="relative p-1.5 rounded-full bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 z-10 cursor-pointer"
                >
                  <ChevronLeft size={14} className="stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled
                aria-label="Previous recommendations"
                className="p-1.5 rounded-full border transition-all duration-200 opacity-30 cursor-not-allowed text-neutral-400 border-transparent bg-neutral-100 dark:bg-neutral-900"
              >
                <ChevronLeft size={14} />
              </button>
            )}

            {canScrollRight ? (
              <div className="relative inline-flex items-center justify-center p-[2.5px] rounded-full">
                {/* Glowing spectrum rainbow gradient ring */}
                <div
                  className="absolute inset-0 rounded-full animate-[spin_3.5s_linear_infinite]"
                  style={{
                    background: 'conic-gradient(from 0deg, #facc15, #fb923c, #f43f5e, #a855f7, #3b82f6, #06b6d4, #10b981, #facc15)',
                    boxShadow: '0 0 14px rgba(244,63,94,0.6), 0 0 8px rgba(59,130,246,0.45)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleScrollNext}
                  disabled={!canScrollRight}
                  aria-label="Next recommendations"
                  className="relative p-1.5 rounded-full bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 z-10 cursor-pointer"
                >
                  <ChevronRight size={14} className="stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled
                aria-label="Next recommendations"
                className="p-1.5 rounded-full border transition-all duration-200 opacity-30 cursor-not-allowed text-neutral-400 border-transparent bg-neutral-100 dark:bg-neutral-900"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile Content: Strictly 2 rows in 2-col grid, collapsible */}
      {!isDesktop && (
        <div
          className={`transition-all duration-300 overflow-hidden ${
            isCollapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[1600px] opacity-100'
          }`}
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <ProductCardSkeleton key={`rec-skeleton-mobile-${idx}`} viewMode="grid" />
                ))
              : visibleMobileProducts.map((prod) => (
                  <ProductCard
                    key={`rec-mob-${prod.id}`}
                    product={prod}
                    viewMode="grid"
                  />
                ))}
          </div>
        </div>
      )}

      {/* Desktop Content: 1-Window Horizontal Carousel */}
      {isDesktop && (
        <div className="lg:px-6">
          <div
            ref={carouselRef}
            className="flex items-stretch gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth py-1"
            tabIndex={0}
            role="region"
            aria-label="Recommended Products Carousel"
          >
            {loading
              ? Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={`rec-skeleton-desktop-${idx}`}
                    className="w-[calc((100%-32px)/3)] min-w-[calc((100%-32px)/3)] max-w-[calc((100%-32px)/3)] shrink-0 snap-start"
                  >
                    <ProductCardSkeleton viewMode="grid" />
                  </div>
                ))
              : visibleDesktopProducts.map((prod) => (
                  <div
                    key={`rec-desk-${prod.id}`}
                    className="w-[calc((100%-32px)/3)] min-w-[calc((100%-32px)/3)] max-w-[calc((100%-32px)/3)] shrink-0 snap-start"
                  >
                    <ProductCard
                      product={prod}
                      viewMode="grid"
                    />
                  </div>
                ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default YouMightAlsoLikeSection;
