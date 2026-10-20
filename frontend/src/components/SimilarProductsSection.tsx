import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import api from '../api';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';
import APlusContent from './APlusContent';
import { trackRecImpression } from '../utils/recTracking';

export interface SimilarProductsSectionProps {
  currentProductId: number;
  categorySlug?: string;
  categoryName?: string;
  className?: string;
  isDesktop?: boolean;
  product?: any;
}

const getScrollContainer = (el: HTMLElement | null): HTMLElement | Window => {
  if (!el || typeof window === 'undefined') return window;
  let parent = el.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
};

const getElementScrollTop = (targetEl: HTMLElement | null, container: HTMLElement | Window): number => {
  if (!targetEl) return 0;
  if (container instanceof HTMLElement) {
    return targetEl.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  }
  return targetEl.getBoundingClientRect().top + window.scrollY;
};

export const SimilarProductsSection: React.FC<SimilarProductsSectionProps> = ({
  currentProductId,
  categorySlug,
  categoryName,
  className = '',
  isDesktop = false,
  product,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'similar' | 'a_plus'>('similar');
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isNearTop, setIsNearTop] = useState(false);
  const tabScrollPositions = useRef<Record<'similar' | 'a_plus', number | null>>({
    similar: null,
    a_plus: null,
  });
  const targetScrollRef = useRef<number | null>(null);

  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    const container = getScrollContainer(headerEl);

    let ticking = false;
    const checkProximity = () => {
      if (!headerRef.current) return;
      const containerTop =
        container instanceof HTMLElement
          ? container.getBoundingClientRect().top
          : 0;
      const headerTop = headerRef.current.getBoundingClientRect().top;
      const distance = headerTop - containerTop;

      // Close to the top (within 40px of docking at sticky top)
      const nearTop = distance <= 40;
      setIsNearTop((prev) => (prev !== nearTop ? nearTop : prev));
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(checkProximity);
        ticking = true;
      }
    };

    checkProximity();

    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        checkProximity();
      });
      if (container instanceof HTMLElement) {
        resizeObserver.observe(container);
      }
      resizeObserver.observe(headerEl);
    }

    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [currentProductId, isDesktop, activeTab]);

  const handleTabChange = (newTab: 'similar' | 'a_plus') => {
    if (newTab === activeTab) return;
    const container = getScrollContainer(sectionRef.current);
    const currentScroll = container instanceof HTMLElement ? container.scrollTop : window.scrollY;
    tabScrollPositions.current[activeTab] = currentScroll;

    const saved = tabScrollPositions.current[newTab];
    let target: number;
    if (saved !== null) {
      target = saved;
    } else {
      // First time opening this tab: align cleanly with the section's sticky top
      target = getElementScrollTop(sectionRef.current, container);
    }

    targetScrollRef.current = target;
    setActiveTab(newTab);
  };

  useLayoutEffect(() => {
    if (targetScrollRef.current !== null) {
      const target = targetScrollRef.current;
      targetScrollRef.current = null;
      const container = getScrollContainer(sectionRef.current);
      if (container instanceof HTMLElement) {
        container.scrollTop = target;
      } else {
        window.scrollTo({ top: target, behavior: 'instant' });
      }
    }
  }, [activeTab]);

  useEffect(() => {
    tabScrollPositions.current = {
      similar: null,
      a_plus: null,
    };
    targetScrollRef.current = null;
  }, [currentProductId]);

  const categoryTarget = categorySlug || categoryName || '';
  const pageSize = 12;

  // Pre-bundled similar products from the product detail response
  const preloadedList = useMemo(() => {
    if (product && Array.isArray(product.similar_products)) {
      return product.similar_products.filter((p: any) => p.id !== currentProductId);
    }
    return null;
  }, [product, currentProductId]);

  const hasPreloaded = preloadedList !== null;

  const [products, setProducts] = useState<any[]>(() => (hasPreloaded ? preloadedList : []));
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(() => {
    if (hasPreloaded) {
      return product?.has_more_similar ?? (preloadedList.length >= pageSize);
    }
    return true;
  });
  const [loading, setLoading] = useState<boolean>(() => !hasPreloaded);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Initial load on mount or when product/category changes
  useEffect(() => {
    let isMounted = true;

    if (preloadedList !== null) {
      setProducts(preloadedList);
      setLoading(false);
      setPage(1);
      setHasMore(product?.has_more_similar ?? (preloadedList.length >= pageSize));
      if (preloadedList.length > 0) trackRecImpression('similar', preloadedList.length);
      return;
    }

    setLoading(true);
    setPage(1);
    setHasMore(true);

    const fetchInitial = async () => {
      try {
        const res = await api.get(`/api/recs/products/${currentProductId}/similar/`, { params: { page: 1, page_size: pageSize } });
        const list = (Array.isArray(res.data?.products) ? res.data.products : []).filter((p: any) => p.id !== currentProductId);
        if (isMounted) {
          setProducts(list);
          setHasMore(Boolean(res.data?.has_more));
          setLoading(false);
          if (list.length > 0) trackRecImpression('similar', list.length);
        }
      } catch (err) {
        console.error('Failed to load similar products:', err);
        if (isMounted) {
          setProducts([]);
          setHasMore(false);
          setLoading(false);
        }
      }
    };

    fetchInitial();

    return () => {
      isMounted = false;
    };
  }, [currentProductId, categoryTarget, isDesktop, preloadedList, product?.has_more_similar]);

  // Infinite scroll: fetch next page (Desktop only)
  const fetchNextPage = async () => {
    if (!isDesktop || !hasMore || loading || loadingMore) return;
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const res = await api.get(`/api/recs/products/${currentProductId}/similar/`, { params: { page: nextPage, page_size: pageSize } });
      const newFiltered = (Array.isArray(res.data?.products) ? res.data.products : []).filter((p: any) => p.id !== currentProductId);

      if (newFiltered.length > 0) {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = newFiltered.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
        setPage(nextPage);
        setHasMore(Boolean(res.data?.has_more));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more similar products:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // IntersectionObserver for Desktop Infinite Scroll
  useEffect(() => {
    if (!isDesktop || !hasMore || loading || loadingMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      {
        root: null,
        rootMargin: '300px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isDesktop, hasMore, loading, loadingMore, page, categoryTarget, currentProductId, pageSize]);

  // Ensure every row is completely full:
  // On desktop (3 cols): drop trailing 1 or 2 items so no empty space on the right.
  // On mobile (2 cols): drop trailing 1 item so every row has 2 cards.
  const visibleProducts = useMemo(() => {
    if (isDesktop) {
      const fullRowCount = Math.floor(products.length / 3) * 3;
      return products.slice(0, fullRowCount);
    } else {
      const fullRowCount = Math.floor(products.length / 2) * 2;
      return products.slice(0, fullRowCount);
    }
  }, [products, isDesktop]);

  const hasAPlus = Boolean(
    product?.has_a_plus_content ||
    (product?.a_plus_content && Object.keys(product.a_plus_content).length > 0 && (product.a_plus_content.modules?.length > 0 || product.a_plus_content.enabled !== false))
  );

  // If there are no similar products but A+ content is enabled, default active tab to A+
  useEffect(() => {
    if (hasAPlus && !loading && visibleProducts.length === 0) {
      setActiveTab('a_plus');
    }
  }, [hasAPlus, loading, visibleProducts.length]);

  if (!loading && visibleProducts.length === 0 && !hasAPlus) {
    return null;
  }

  // Mobile: If no similar products exist, render A+ content directly without empty similar products header
  if (!isDesktop && !loading && visibleProducts.length === 0 && hasAPlus) {
    return (
      <section className={`w-full ${className}`}>
        <APlusContent product={product} mode="mobile_accordion" className="mt-0" />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className={`w-full ${className}`}>
      {/* Sticky pinned header with proximity-aware smooth underlay */}
      <div
        ref={headerRef}
        className={`lg:sticky lg:top-0 z-20 lg:px-6 pt-4 lg:pt-5 pb-2 mb-3 sm:mb-4 flex items-center gap-8 transition-colors duration-300 ease-in-out h-[52px] sm:h-[56px] lg:h-[60px] box-border shrink-0 ${
          isNearTop ? 'bg-white dark:bg-[#18191a]' : 'bg-transparent'
        }`}
      >
        {hasAPlus && isDesktop ? (
          <>
            <button
              type="button"
              onClick={() => handleTabChange('similar')}
              className={`pb-2 tracking-tight transition-colors duration-150 relative flex items-center cursor-pointer text-sm sm:text-base font-medium ${
                activeTab === 'similar'
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              <span>{t('similar_products', 'Similar Products')}</span>
              {activeTab === 'similar' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('a_plus')}
              className={`pb-2 tracking-tight transition-colors duration-150 relative flex items-center cursor-pointer text-sm sm:text-base font-medium ${
                activeTab === 'a_plus'
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              <span>{product?.a_plus_content?.headline || t('from_the_manufacturer', 'From the manufacturer')}</span>
              {activeTab === 'a_plus' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
              )}
            </button>
          </>
        ) : (
          <h2 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white tracking-tight leading-none pb-2">
            {t('similar_products', 'Similar Products')}
          </h2>
        )}
      </div>

      {/* Desktop: Active Tab View */}
      {isDesktop && hasAPlus && activeTab === 'a_plus' ? (
        <APlusContent product={product} mode="desktop_tab" />
      ) : (
        <>
          {/* Grid - 3 items per row on desktop (matching pageSize multiple of 3) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 lg:px-6">
            {loading
              ? Array.from({ length: pageSize }).map((_, idx) => (
                  <ProductCardSkeleton key={`skeleton-${idx}`} viewMode="grid" compact={!isDesktop} className="aspect-[4/5] sm:aspect-auto min-h-0 sm:min-h-[300px] md:min-h-[320px]" />
                ))
              : visibleProducts.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    viewMode="grid"
                    compact={!isDesktop}
                    className="aspect-[4/5] sm:aspect-auto min-h-0 sm:min-h-[300px] md:min-h-[320px]"
                    trackSource="similar"
                    isSponsored={prod.rec_slot === 'sponsored'}
                  />
                ))}
          </div>

          {/* Sentinel & Loader for Desktop Infinite Scroll */}
          {isDesktop && hasMore && (
            <div ref={sentinelRef} className="w-full py-6 flex justify-center items-center lg:px-6 lg:pb-6">
              {loadingMore && (
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                  <span>{t('loading_more', 'Loading more products...')}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Mobile: A+ Content Collapsible Accordion Below Similar Products */}
      {!isDesktop && hasAPlus && (
        <APlusContent product={product} mode="mobile_accordion" className="mt-6" />
      )}
    </section>
  );
};

export default SimilarProductsSection;
