import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import SafeImage from '../SafeImage';
import { getCategoryFallbackImage } from '../../utils/categoryFallbacks';

const CategoryBar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    api.get('/api/categories/')
      .then((res) => {
        setCategories(res.data.results || res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const isProductsPage = location.pathname === '/products';
  const isProductDetailPage = location.pathname.startsWith('/product/');

  // Extract product slug from path if in detail view
  const productSlug = useMemo(() => {
    if (!isProductDetailPage) return null;
    const match = location.pathname.match(/\/product\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname, isProductDetailPage]);

  // Load product if in details page
  useEffect(() => {
    if (productSlug) {
      api.get(`/api/products/${productSlug}/`)
        .then(res => setProduct(res.data))
        .catch(() => {});
    } else {
      setProduct(null);
    }
  }, [productSlug]);

  const selectedCategory = searchParams.get('category') || '';

  // Find product's category and subcategory from the nested categories list
  const { productParentCat, productSubCat } = useMemo(() => {
    if (!isProductDetailPage || !product || categories.length === 0) {
      return { productParentCat: null, productSubCat: null };
    }
    let parentCat: any = null;
    let subCat: any = null;

    for (const root of categories) {
      if (root.id === product.category) {
        parentCat = root;
        subCat = null;
        break;
      }
      const kid = root.children?.find((c: any) => c.id === product.category);
      if (kid) {
        parentCat = root;
        subCat = kid;
        break;
      }
    }
    return { productParentCat: parentCat, productSubCat: subCat };
  }, [isProductDetailPage, product, categories]);

  // Only show on product catalog and detail pages
  const allowedPaths = ['/products', '/product'];
  const showBar = allowedPaths.some(p => location.pathname.startsWith(p));

  if (!showBar) return null;

  const topCategories = categories.filter((c: any) => !c.parent);

  const handleCategoryClick = (slug: string) => {
    if (isProductsPage) {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        if (slug) {
          if (newParams.get('category') === slug) {
            newParams.delete('category');
          } else {
            newParams.set('category', slug);
          }
        } else {
          newParams.delete('category');
        }
        newParams.delete('subcategory');
        newParams.delete('saved');
        return newParams;
      });
    } else {
      navigate(slug ? `/products?category=${slug}` : '/products');
    }
  };

  // Render a loading skeleton for product details page
  if (isProductDetailPage && (loading || !product)) {
    return (
      <div className="w-full bg-white dark:bg-[#000000] border-b border-gray-150 dark:border-neutral-900 transition-colors duration-300">
        <div className="flex items-center justify-center gap-2 py-2.5 px-4 w-full">
          <div className="h-7 w-24 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="h-7 w-24 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
      </div>
    );
  }

  if (isProductsPage) {
    // CIRCLES Layout (original category circles slider, updated with desktop-large/mobile-small sizes)
    return (
      <div className="w-full pt-1 pb-1 bg-white dark:bg-[#000000] border-b border-gray-150 dark:border-neutral-900 transition-colors duration-300">
        <div className="flex items-start justify-start md:justify-center gap-5 overflow-x-auto no-scrollbar pt-3 pb-2 w-full px-4 scroll-smooth">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0 animate-pulse">
                <div className="w-20 h-20 md:w-36 md:h-36 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div className="w-14 h-3 md:w-20 h-3.5 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              </div>
            ))
          ) : (
            topCategories.filter((cat: any) => cat.product_count > 0).map((cat: any) => {
              const isActive = selectedCategory === cat.slug;
              return (
                <div 
                  key={cat.id} 
                  className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
                  onClick={() => handleCategoryClick(cat.slug)}
                >
                  <div className={`relative w-20 h-20 md:w-36 md:h-36 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 overflow-visible border-2 ${isActive ? 'border-brand-500 bg-white dark:bg-neutral-900 shadow-md' : 'border-transparent bg-neutral-100 dark:bg-neutral-800 shadow-sm hover:shadow-md'}`}>
                    {cat.product_count > 0 && (
                      <span className="absolute -top-1.5 -right-1 md:top-0.5 md:right-0.5 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[9px] md:text-base font-bold md:font-extrabold px-1.5 py-0.5 md:px-2 rounded-full border md:border-2 border-neutral-200 dark:border-neutral-700 shadow-sm md:shadow-md md:min-w-[40px] md:h-[40px] flex items-center justify-center z-10">
                        {cat.product_count.toLocaleString()}
                      </span>
                    )}
                    <SafeImage
                      src={cat.image || getCategoryFallbackImage(cat.name)}
                      alt={cat.name}
                      category={cat.name}
                      className="w-14 h-14 md:w-28 md:h-28 object-cover rounded-full"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <span className={`text-xs md:text-sm font-bold text-center max-w-[5.5rem] md:max-w-[8.5rem] leading-tight line-clamp-2 ${isActive ? 'text-brand-600 dark:text-brand-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>
                    {cat.name}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // PILLS Layout (displayed on details page, otherwise falls back to all categories if ever rendered elsewhere)
  const pillsToRender = isProductDetailPage 
    ? [productParentCat, productSubCat].filter(Boolean)
    : topCategories.filter((cat: any) => cat.product_count > 0);

  return (
    <div className="w-full bg-white dark:bg-[#000000] border-b border-gray-150 dark:border-neutral-900 transition-colors duration-300">
      <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar py-2.5 px-4 scroll-smooth w-full">
        {/* All Products Pill - only shown when showing all categories */}
        {!isProductDetailPage && (
          <button 
            onClick={() => handleCategoryClick('')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 border-transparent shadow-sm"
          >
            <LayoutGrid size={12} className="stroke-[2]" />
            <span>{t('all_products', 'All Products')}</span>
          </button>
        )}

        {loading && !isProductDetailPage ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse shrink-0" />
          ))
        ) : (
          pillsToRender.map((cat: any) => {
            const isSub = isProductDetailPage && cat.parent !== null && cat.parent !== undefined;
            const clickUrl = isSub && productParentCat
              ? `/products?category=${productParentCat.slug}&subcategory=${cat.slug}`
              : `/products?category=${cat.slug}`;

            return (
              <button
                key={cat.id}
                onClick={() => isProductDetailPage ? navigate(clickUrl) : handleCategoryClick(cat.slug)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 shadow-sm"
              >
                {cat.image ? (
                  <SafeImage
                    src={cat.image}
                    alt=""
                    category={cat.name}
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-[8px] font-black uppercase">{cat.name.charAt(0)}</span>
                )}
                <span>{cat.name} ({cat.product_count || 0})</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CategoryBar;
