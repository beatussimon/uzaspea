import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProductCard from '../ProductCard';
import { ProductCardSkeleton } from '../Skeleton';

export interface DiscoveryShelfProps {
  id: string;
  title: string;
  subtitle?: string;
  categorySlug?: string;
  seeMoreUrl?: string;
  products: any[];
  loading?: boolean;
  type?: 'horizontal_shelf' | 'grid_shelf';
}

export const DiscoveryShelf: React.FC<DiscoveryShelfProps> = ({
  id,
  title,
  subtitle,
  seeMoreUrl,
  products = [],
  loading = false,
  type = 'horizontal_shelf',
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const totalColumns = type === 'horizontal_shelf' ? Math.ceil(products.length / 2) : 1;
  const [activeColIndex, setActiveColIndex] = useState(0);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);

    const colWidth = el.clientWidth;
    if (colWidth > 0 && totalColumns > 1) {
      const idx = Math.min(
        totalColumns - 1,
        Math.max(0, Math.round(el.scrollLeft / colWidth))
      );
      setActiveColIndex((prev) => (prev !== idx ? idx : prev));
    }
  }, [totalColumns]);

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

  const scrollToColumn = (colIdx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const colWidth = el.clientWidth;
    el.scrollTo({
      left: colIdx * colWidth,
      behavior: 'smooth',
    });
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

  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section className="relative w-full py-1 md:py-2" id={`shelf-${id}`}>
      {/* Shelf Header */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3 mb-1.5 sm:mb-2">
        <div className="space-y-0.5 min-w-0 flex-1">
          <h2 className="text-[15px] sm:text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right Controls: Pill Counter + Desktop Chevrons + View All */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {type === 'horizontal_shelf' && totalColumns > 1 && (
            <span className="text-[10px] sm:text-[11px] font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full tabular-nums border border-neutral-200/60 dark:border-neutral-700/60">
              {activeColIndex + 1}/{totalColumns}
            </span>
          )}

          {type === 'horizontal_shelf' && (
            <div className="hidden sm:flex items-center gap-1 mr-1">
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                aria-label="Previous products"
                className={`p-1.5 rounded-full border transition-all duration-200 ${
                  canScrollLeft
                    ? 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 shadow-sm hover:scale-105 active:scale-95'
                    : 'opacity-30 cursor-not-allowed text-neutral-400 border-transparent bg-neutral-100 dark:bg-neutral-900'
                }`}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                aria-label="Next products"
                className={`p-1.5 rounded-full border transition-all duration-200 ${
                  canScrollRight
                    ? 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 shadow-sm hover:scale-105 active:scale-95'
                    : 'opacity-30 cursor-not-allowed text-neutral-400 border-transparent bg-neutral-100 dark:bg-neutral-900'
                }`}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {seeMoreUrl && (
            <Link
              to={seeMoreUrl}
              className="group inline-flex items-center gap-0.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors py-0.5 px-1.5 rounded-full hover:bg-brand-500/10"
            >
              <span>{t('view_all', 'View all')}</span>
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Shelf Body - 2 Rows of Cards Matching Listings Grid Sizing */}
      {loading ? (
        type === 'grid_shelf' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
            {[...Array(10)].map((_, i) => (
              <ProductCardSkeleton key={i} viewMode="grid" />
            ))}
          </div>
        ) : (
          <div className="grid grid-rows-[repeat(2,auto)] grid-flow-col gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-1.5 pt-0.5 auto-cols-[100%] sm:auto-cols-[calc((100%-16px)/2)] lg:auto-cols-[calc((100%-40px)/3)] xl:auto-cols-[calc((100%-60px)/4)] 2xl:auto-cols-[calc((100%-80px)/5)]">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-full snap-start h-full">
                <ProductCardSkeleton viewMode="grid" />
              </div>
            ))}
          </div>
        )
      ) : type === 'grid_shelf' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
          {products.slice(0, 10).map((product, idx) => (
            <div key={product.id || idx} className="h-full">
              <ProductCard product={product} viewMode="grid" isTopFold={idx < 6} />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="grid grid-rows-[repeat(2,auto)] grid-flow-col gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-1.5 pt-0.5 auto-cols-[100%] sm:auto-cols-[calc((100%-16px)/2)] lg:auto-cols-[calc((100%-40px)/3)] xl:auto-cols-[calc((100%-60px)/4)] 2xl:auto-cols-[calc((100%-80px)/5)]"
        >
          {products.map((product, idx) => (
            <div
              key={product.id || idx}
              className="w-full snap-start h-full"
            >
              <ProductCard product={product} viewMode="grid" isTopFold={idx < 6} />
            </div>
          ))}
        </div>
      )}

      {/* Mobile Subtle Dot Indicators */}
      {type === 'horizontal_shelf' && totalColumns > 1 && (
        <div className="flex sm:hidden items-center justify-center gap-1.5 mt-2 pb-0.5">
          {Array.from({ length: totalColumns }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToColumn(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`transition-all duration-300 rounded-full ${
                activeColIndex === i
                  ? 'w-5 h-1.5 bg-brand-500 shadow-sm'
                  : 'w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default DiscoveryShelf;
