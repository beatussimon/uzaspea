import React, { useState, useEffect } from 'react';
import api from '../../api';
import { apiCache } from '../../utils/apiCache';
import ProductCard from '../ProductCard';
import { ProductCardSkeleton } from '../Skeleton';

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
  const cacheKey = `recommendations:${category}`;
  const [products, setProducts] = useState<any[]>(() => {
    const cached = apiCache.get<any>(cacheKey);
    return cached && Array.isArray(cached.data?.products) ? cached.data.products : [];
  });
  const [title, setTitle] = useState<string>(() => {
    const cached = apiCache.get<any>(cacheKey);
    return cached?.data?.title || 'You Might Also Like';
  });
  const [subtitle, setSubtitle] = useState<string>(() => {
    const cached = apiCache.get<any>(cacheKey);
    return cached?.data?.subtitle || '';
  });
  const [loading, setLoading] = useState(!products.length);

  const numCols = Math.max(1, cols);
  const maxProducts = 4 * numCols; // Exactly 4 rows

  useEffect(() => {
    if (!category) return;
    const key = `recommendations:${category}`;
    const cached = apiCache.get<any>(key);

    if (cached && Array.isArray(cached.data?.products)) {
      setProducts(cached.data.products);
      if (cached.data.title) setTitle(cached.data.title);
      if (cached.data.subtitle) setSubtitle(cached.data.subtitle);
      setLoading(false);
      return;
    }

    setLoading(true);
    const params: Record<string, any> = { category, limit: Math.max(maxProducts, 24) };
    if (excludeIds.length > 0) {
      params.exclude = excludeIds.slice(0, 10).join(',');
    }

    api.get('/api/products/recommendations/', { params })
      .then((res) => {
        apiCache.set(key, res.data);
        if (Array.isArray(res.data?.products)) {
          setProducts(res.data.products);
        }
        if (res.data?.title) setTitle(res.data.title);
        if (res.data?.subtitle) setSubtitle(res.data.subtitle);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, maxProducts]);

  if (!loading && products.length === 0) {
    return null;
  }

  const productsToShow = products.slice(0, maxProducts);

  return (
    <div className="col-span-full my-6 sm:my-8">
      {/* Clean Header - No AI sparkle icon, no shaded colored box */}
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

      {/* 4 Rows of Related Category Products */}
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
          {productsToShow.map((prod) => (
            <div key={prod.id} className="h-full">
              <ProductCard product={prod} viewMode={viewMode} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryRecommendationShelf;
