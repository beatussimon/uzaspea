import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProductCard from '../ProductCard';
import { ProductCardSkeleton } from '../Skeleton';
import api from '../../api';
import { getActiveLocationParams } from '../layout/CategoryBar';
import { apiCache } from '../../utils/apiCache';

export interface DiscoveryShelfProps {
  id: string;
  title: string;
  subtitle?: string;
  categorySlug?: string;
  seeMoreUrl?: string;
  products: any[];
  loading?: boolean;
  type?: 'horizontal_shelf' | 'grid_shelf';
  gender?: 'female' | 'male';
}

export const DiscoveryShelf: React.FC<DiscoveryShelfProps> = ({
  id,
  title,
  seeMoreUrl,
  products = [],
  loading = false,
  type = 'horizontal_shelf',
  gender = 'female',
}) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Dynamic products list for section-based infinite horizontal scroll
  const [shelfProducts, setShelfProducts] = useState<any[]>(products);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(products.length >= 12);
  const [loadingMore, setLoadingMore] = useState(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    setShelfProducts(products);
    setPage(1);
    setHasMore(products.length >= 12);
    hasAutoScrolledRef.current = false;
  }, [products]);

  // Guarantee that in a 2-row horizontal shelf, only complete pairs (even count) are rendered so the bottom row is never empty
  const displayProducts = (type === 'horizontal_shelf' && shelfProducts.length > 1 && shelfProducts.length % 2 !== 0 && !loadingMore)
    ? shelfProducts.slice(0, shelfProducts.length - 1)
    : shelfProducts;

  const extraColumns = loadingMore ? 1 : 0;
  const totalColumns = type === 'horizontal_shelf' ? Math.max(1, Math.ceil(displayProducts.length / 2) + extraColumns) : 1;
  const [activeColIndex, setActiveColIndex] = useState(0);

  // Auto-scroll visibility & user interaction tracking
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const hasAutoScrolledRef = useRef(false);
  const userInteractionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pauseAutoScrollTemporarily = useCallback(() => {
    hasAutoScrolledRef.current = true; // User interacted, so do not auto-scroll again
    setIsUserInteracting(true);
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
    userInteractionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 5000);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Only count as shelf interaction if the user is scrolling horizontally
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 5) {
      pauseAutoScrollTemporarily();
    }
  }, [pauseAutoScrollTemporarily]);

  useEffect(() => {
    return () => {
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current);
      }
    };
  }, []);

  // Section Infinite Scroll Fetcher
  const fetchNextPage = useCallback(() => {
    if (isFetchingRef.current || !hasMore || loadingMore || !id) return;
    isFetchingRef.current = true;
    setLoadingMore(true);

    const nextPage = page + 1;
    const locParams = getActiveLocationParams();
    const params: Record<string, string> = {
      section_id: id,
      page: String(nextPage),
      page_size: '12',
      gender: gender || 'female',
      ...locParams,
    };

    const cacheKey = `discovery:section:${id}:${gender || 'female'}:${JSON.stringify(locParams)}:p${nextPage}`;
    const cached = apiCache.get<any>(cacheKey);

    if (cached && Array.isArray(cached.data?.products)) {
      const incoming: any[] = cached.data.products;
      setShelfProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const unique = incoming.filter((p) => !existingIds.has(p.id));
        return [...prev, ...unique];
      });
      setPage(nextPage);
      setHasMore(Boolean(cached.data.has_more && incoming.length > 0));
      setLoadingMore(false);
      isFetchingRef.current = false;
      return;
    }

    api.get('/api/products/discovery/', { params })
      .then((res) => {
        apiCache.set(cacheKey, res.data);
        const incoming: any[] = Array.isArray(res.data?.products) ? res.data.products : [];
        setShelfProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const unique = incoming.filter((p) => !existingIds.has(p.id));
          return [...prev, ...unique];
        });
        setPage(nextPage);
        setHasMore(Boolean(res.data?.has_more && incoming.length > 0));
      })
      .catch(() => {
        setHasMore(false);
      })
      .finally(() => {
        setLoadingMore(false);
        isFetchingRef.current = false;
      });
  }, [id, page, hasMore, loadingMore, gender]);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);

    const firstChild = el.children[0] as HTMLElement | undefined;
    const secondChild = el.children[2] as HTMLElement | undefined;
    const step = (secondChild && firstChild) ? (secondChild.offsetLeft - firstChild.offsetLeft) : el.clientWidth;

    if (step > 0 && totalColumns > 1) {
      const idx = Math.min(
        totalColumns - 1,
        Math.max(0, Math.round(el.scrollLeft / step))
      );
      setActiveColIndex((prev) => (prev !== idx ? idx : prev));

      // As user approaches the end, load the next batch of section products
      const isNearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 350;
      if ((isNearEnd || idx >= totalColumns - 2) && hasMore && !loadingMore && !isFetchingRef.current) {
        fetchNextPage();
      }
    }
  }, [totalColumns, hasMore, loadingMore, fetchNextPage]);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          checkScroll();
          rafId = null;
        });
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [checkScroll, products]);

  const scrollToColumn = useCallback((colIdx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const firstChild = el.children[0] as HTMLElement | undefined;
    const targetChild = el.children[colIdx * 2] as HTMLElement | undefined;
    if (firstChild && targetChild) {
      el.scrollTo({
        left: targetChild.offsetLeft - firstChild.offsetLeft,
        behavior: 'smooth',
      });
    } else {
      el.scrollTo({
        left: colIdx * el.clientWidth,
        behavior: 'smooth',
      });
    }
  }, []);

  const handleManualScrollToColumn = (colIdx: number) => {
    pauseAutoScrollTemporarily();
    scrollToColumn(colIdx);
  };

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleManualScroll = (direction: 'left' | 'right') => {
    pauseAutoScrollTemporarily();
    scroll(direction);
  };

  // Observe whether the shelf is currently in view (visible on screen)
  useEffect(() => {
    const sectionEl = sectionRef.current;
    if (!sectionEl || type !== 'horizontal_shelf' || totalColumns <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsIntersecting(entry.isIntersecting && entry.intersectionRatio >= 0.2);
      },
      { threshold: [0, 0.2, 0.5] }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  }, [type, totalColumns]);

  // One-time auto-scroll affordance: nudge 1 product/column after 2.5s to show user the shelf is scrollable
  useEffect(() => {
    if (
      type !== 'horizontal_shelf' ||
      totalColumns <= 1 ||
      !isIntersecting ||
      hasAutoScrolledRef.current ||
      isUserInteracting ||
      loading ||
      shelfProducts.length === 0 ||
      activeColIndex !== 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      if (document.hidden || hasAutoScrolledRef.current) return;
      hasAutoScrolledRef.current = true;
      scrollToColumn(1);
      setCanScrollLeft(true);
    }, 1800);

    return () => clearTimeout(timer);
  }, [
    type,
    totalColumns,
    isIntersecting,
    isUserInteracting,
    loading,
    shelfProducts.length,
    activeColIndex,
    scrollToColumn,
  ]);

  if (!loading && shelfProducts.length === 0) {
    return null;
  }

  return (
    <section 
      ref={sectionRef}
      className="relative w-full py-1 md:py-2" 
      id={`shelf-${id}`}
    >
      {/* Shelf Header */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3 mb-1.5 sm:mb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            {title}
          </h2>
        </div>

        {/* Right Controls: Pill Counter + Desktop Chevrons + View All */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {type === 'horizontal_shelf' && totalColumns > 1 && (
            <div className="relative inline-flex items-center justify-center p-[2px] sm:p-0 rounded-full">
              {/* On mobile: Glowing rainbow spectrum gradient ring */}
              <div
                className="sm:hidden absolute inset-0 rounded-full animate-pulse"
                style={{
                  background: 'linear-gradient(90deg, #facc15, #fb923c, #f43f5e, #a855f7, #3b82f6, #10b981, #facc15)',
                  boxShadow: '0 0 10px rgba(244,63,94,0.55), 0 0 6px rgba(59,130,246,0.4)',
                }}
              />
              <span className="relative z-10 text-[10px] sm:text-[11px] font-extrabold sm:font-bold text-neutral-900 dark:text-white sm:text-neutral-500 sm:dark:text-neutral-400 bg-white dark:bg-neutral-900 sm:bg-neutral-100 sm:dark:bg-neutral-800 px-2 sm:px-1.5 py-0.5 rounded-full tabular-nums sm:border sm:border-neutral-200/60 sm:dark:border-neutral-700/60">
                {activeColIndex + 1}/{totalColumns}
              </span>
            </div>
          )}

          {type === 'horizontal_shelf' && (
            <div className="hidden sm:flex items-center gap-1.5 mr-1">
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
                    onClick={() => handleManualScroll('left')}
                    disabled={!canScrollLeft}
                    aria-label="Previous products"
                    className="relative p-1.5 rounded-full bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 z-10"
                  >
                    <ChevronLeft size={14} className="stroke-[2.5]" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-label="Previous products"
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
                    onClick={() => handleManualScroll('right')}
                    disabled={!canScrollRight}
                    aria-label="Next products"
                    className="relative p-1.5 rounded-full bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 z-10"
                  >
                    <ChevronRight size={14} className="stroke-[2.5]" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-label="Next products"
                  className="p-1.5 rounded-full border transition-all duration-200 opacity-30 cursor-not-allowed text-neutral-400 border-transparent bg-neutral-100 dark:bg-neutral-900"
                >
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          )}

          {seeMoreUrl && (
            <Link
              to={seeMoreUrl}
              className="group inline-flex items-center gap-0.5 text-xs font-bold text-black dark:text-white hover:opacity-75 transition-all py-0.5 px-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <span>{t('view_all', 'View all')}</span>
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5 text-black dark:text-white" />
            </Link>
          )}
        </div>
      </div>

      {/* Shelf Body - 2 Rows of Cards Matching Listings Grid Sizing & Mobile Frame */}
      {loading ? (
        type === 'grid_shelf' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5 p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none">
            {[...Array(10)].map((_, i) => (
              <ProductCardSkeleton key={i} viewMode="grid" />
            ))}
          </div>
        ) : (
          <div className="p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none overflow-hidden">
            <div className="grid grid-rows-[repeat(2,auto)] grid-flow-col gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-1.5 pt-0.5 auto-cols-[100%] sm:auto-cols-[calc((100%-16px)/2)] lg:auto-cols-[calc((100%-40px)/3)] xl:auto-cols-[calc((100%-60px)/4)] 2xl:auto-cols-[calc((100%-80px)/5)]">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="w-full snap-start h-full">
                  <ProductCardSkeleton viewMode="grid" />
                </div>
              ))}
            </div>
          </div>
        )
      ) : type === 'grid_shelf' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5 p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none">
          {displayProducts.slice(0, 10).map((product, idx) => (
            <div key={product.id || idx} className="h-full">
              <ProductCard product={product} viewMode="grid" isTopFold={idx < 6} />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none overflow-hidden">
          <div
            ref={scrollRef}
            onTouchStart={pauseAutoScrollTemporarily}
            onTouchMove={pauseAutoScrollTemporarily}
            onWheel={handleWheel}
            className="grid grid-rows-[repeat(2,auto)] grid-flow-col gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1.5 pt-0.5 auto-cols-[100%] sm:auto-cols-[calc((100%-16px)/2)] lg:auto-cols-[calc((100%-40px)/3)] xl:auto-cols-[calc((100%-60px)/4)] 2xl:auto-cols-[calc((100%-80px)/5)]"
          >
            {displayProducts.map((product, idx) => (
              <div
                key={product.id || idx}
                className="w-full snap-start h-full"
              >
                <ProductCard product={product} viewMode="grid" isTopFold={idx < 6} />
              </div>
            ))}

            {/* Trailing Skeletons while fetching more products for this section */}
            {loadingMore && (
              <>
                <div className="w-full snap-start h-full">
                  <ProductCardSkeleton viewMode="grid" />
                </div>
                <div className="w-full snap-start h-full">
                  <ProductCardSkeleton viewMode="grid" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Subtle Dot Indicators */}
      {type === 'horizontal_shelf' && totalColumns > 1 && (
        <div className="flex sm:hidden items-center justify-center gap-1.5 mt-2 pb-0.5">
          {totalColumns <= 8 ? (
            Array.from({ length: totalColumns }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleManualScrollToColumn(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`transition-all duration-300 rounded-full ${
                  activeColIndex === i
                    ? 'w-5 h-1.5 bg-brand-500 shadow-sm'
                    : 'w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400'
                }`}
              />
            ))
          ) : (
            (() => {
              const maxDots = 7;
              const start = Math.max(0, Math.min(activeColIndex - Math.floor(maxDots / 2), totalColumns - maxDots));
              const visibleIndices = Array.from({ length: maxDots }, (_, k) => start + k);
              return visibleIndices.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => handleManualScrollToColumn(col)}
                  aria-label={`Go to slide ${col + 1}`}
                  className={`transition-all duration-300 rounded-full ${
                    activeColIndex === col
                      ? 'w-5 h-1.5 bg-brand-500 shadow-sm'
                      : 'w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400'
                  }`}
                />
              ));
            })()
          )}
        </div>
      )}
    </section>
  );
};

export default DiscoveryShelf;
