import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import api from '../api';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';
import APlusContent from './APlusContent';

export interface SimilarProductsSectionProps {
  currentProductId: number;
  categorySlug?: string;
  categoryName?: string;
  className?: string;
  isDesktop?: boolean;
  product?: any;
}

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
      return;
    }

    setLoading(true);
    setPage(1);
    setHasMore(true);

    const fetchInitial = async () => {
      try {
        const params: Record<string, any> = {
          page: 1,
          page_size: pageSize,
          exclude: currentProductId.toString(),
        };
        if (categoryTarget) {
          params.category = categoryTarget;
        }

        const res = await api.get('/api/products/', { params });
        const rawItems = res.data?.results || (Array.isArray(res.data) ? res.data : []);
        const filtered = rawItems.filter((p: any) => p.id !== currentProductId);

        if (filtered.length > 0) {
          if (isMounted) {
            setProducts(filtered);
            setHasMore(Boolean(res.data?.next));
            setLoading(false);
          }
          return;
        }

        // Fallback: Try recommendations endpoint if category search returned nothing
        const recParams: Record<string, any> = {
          limit: pageSize,
          exclude: currentProductId.toString(),
        };
        if (categoryTarget) {
          recParams.category = categoryTarget;
        }
        const recRes = await api.get('/api/products/recommendations/', { params: recParams });
        const recList = Array.isArray(recRes.data?.products) ? recRes.data.products : [];

        if (isMounted) {
          const recFiltered = recList.filter((p: any) => p.id !== currentProductId).slice(0, pageSize);
          setProducts(recFiltered);
          setHasMore(false);
          setLoading(false);
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
      const params: Record<string, any> = {
        page: nextPage,
        page_size: pageSize,
        exclude: currentProductId.toString(),
      };
      if (categoryTarget) {
        params.category = categoryTarget;
      }

      const res = await api.get('/api/products/', { params });
      const rawItems = res.data?.results || (Array.isArray(res.data) ? res.data : []);
      const newFiltered = rawItems.filter((p: any) => p.id !== currentProductId);

      if (newFiltered.length > 0) {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = newFiltered.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
        setPage(nextPage);
        setHasMore(Boolean(res.data?.next));
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
    <section className={`w-full ${className}`}>
      {/* Sticky pinned header - sits flush at top: 0 with matching border-b and height */}
      <div className="lg:sticky lg:top-0 z-20 bg-white dark:bg-[#18191a] lg:px-6 lg:pt-6 border-b border-neutral-200 dark:border-neutral-800 mb-6 flex items-center gap-8">
        {hasAPlus && isDesktop ? (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('similar')}
              className={`pb-3.5 tracking-tight transition-all relative flex items-center cursor-pointer ${
                activeTab === 'similar'
                  ? 'text-base sm:text-lg font-extrabold text-gray-900 dark:text-white'
                  : 'text-xs sm:text-sm font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <span>{t('similar_products', 'Similar Products')}</span>
              {activeTab === 'similar' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('a_plus')}
              className={`pb-3.5 tracking-tight transition-all relative flex items-center cursor-pointer ${
                activeTab === 'a_plus'
                  ? 'text-base sm:text-lg font-extrabold text-gray-900 dark:text-white'
                  : 'text-xs sm:text-sm font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <span>{product?.a_plus_content?.headline || t('from_the_manufacturer', 'From the manufacturer')}</span>
              {activeTab === 'a_plus' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
              )}
            </button>
          </>
        ) : (
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-none pb-3.5">
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:px-6">
            {loading
              ? Array.from({ length: pageSize }).map((_, idx) => (
                  <ProductCardSkeleton key={`skeleton-${idx}`} viewMode="grid" />
                ))
              : visibleProducts.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    viewMode="grid"
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
