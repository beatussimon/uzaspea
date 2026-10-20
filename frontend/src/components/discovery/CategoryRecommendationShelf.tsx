import React, { useState, useEffect } from 'react';
import api from '../../api';
import { apiCache } from '../../utils/apiCache';
import ProductCard from '../ProductCard';
import { ProductCardSkeleton } from '../Skeleton';
import { getRecContextParams } from '../../utils/recentViews';
import { trackRecImpression } from '../../utils/recTracking';

interface CategoryRecommendationShelfProps {
  category: string;
  excludeIds?: number[];
  viewMode?: 'grid' | 'list';
  cols?: number;
}

export const CategoryRecommendationShelf: React.FC<CategoryRecommendationShelfProps> = ({
  category,
  excludeIds = [],
  viewMode = 'grid',
  cols = 5,
}) => {
  const numCols = Math.max(1, cols);
  const maxProducts = 4 * numCols; // exactly 4 rows
  const recParams = getRecContextParams();
  const cacheKey = `recommendations:v3:${category}:${recParams.recent_ids || ''}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(() => apiCache.get<any>(cacheKey)?.data || null);
  const [loading, setLoading] = useState<boolean>(() => !apiCache.get<unknown>(cacheKey));

  useEffect(() => {
    if (!category) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = apiCache.get<any>(cacheKey);
    if (cached?.data) {
      setData(cached.data);
      setLoading(false);
      return;
    }
    let isMounted = true;
    setLoading(true);
    const params: Record<string, string> = {
      category,
      limit: String(Math.min(50, Math.max(maxProducts + Math.min(excludeIds.length, 26), 24))),
      ...recParams,
    };
    if (excludeIds.length > 0) params.exclude = excludeIds.slice(0, 200).join(',');
    api.get('/api/products/recommendations/', { params })
      .then((res) => {
        apiCache.set(cacheKey, res.data);
        if (isMounted) setData(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
    // Fetch once per category/history; later grid pages are filtered client-side below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, maxProducts]);

  const excludeSet = new Set(excludeIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products: any[] = (Array.isArray(data?.products) ? data.products : [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => !excludeSet.has(p.id))
    .slice(0, maxProducts);

  useEffect(() => {
    if (!loading && products.length > 0) trackRecImpression('cat_shelf', products.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  if (!loading && products.length === 0) {
    return null;
  }

  const title: string = data?.title || 'You Might Also Like';
  const subtitle: string = data?.subtitle || '';

  return (
    <div className="col-span-full my-6 sm:my-8">
      <div className="mb-3 sm:mb-4 px-1">
        <h3 className="text-lg sm:text-xl md:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {loading ? (
        <div className={viewMode === 'grid'
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5"
          : "flex flex-col gap-3"
        }>
          {[...Array(maxProducts)].map((_, i) => (
            <ProductCardSkeleton key={i} viewMode={viewMode} />
          ))}
        </div>
      ) : (
        <div className={viewMode === 'grid'
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5"
          : "flex flex-col gap-3"
        }>
          {products.map((prod) => (
            <div key={prod.id} className="h-full">
              <ProductCard
                product={prod}
                viewMode={viewMode}
                trackSource="cat_shelf"
                isSponsored={prod.rec_slot === 'sponsored'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryRecommendationShelf;
