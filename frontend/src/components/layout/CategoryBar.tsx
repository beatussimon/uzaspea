import React, { useEffect, useState, useMemo, useSyncExternalStore } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import SafeImage from '../SafeImage';
import { getCategoryFallbackImage } from '../../utils/categoryFallbacks';
import { preloadProductList } from '../../App';
import { ensureArray } from '../../utils/arrayUtils';
import { apiCache } from '../../utils/apiCache';
import { categoryStore } from '../../utils/categoryStore';

export const getActiveLocationParams = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem('uzaspea_search_location_prefs');
    if (saved) {
      const prefs = JSON.parse(saved);
      if (prefs.mode === 'proximity' && prefs.coords && prefs.radius) {
        return {
          lat: String(prefs.coords.lat),
          lng: String(prefs.coords.lng),
          radius: String(prefs.radius),
          location_mode: 'proximity',
        };
      } else if (prefs.mode === 'region' && prefs.region) {
        return {
          region: prefs.region,
          location_mode: 'region',
        };
      }
    }
  } catch {}
  return { location_mode: 'nationwide' };
};

export const prefetchCategoryProducts = (slug: string) => {
  if (!slug) return;
  preloadProductList();
  const locParams = getActiveLocationParams();
  const params: Record<string, string> = { page: '1', page_size: '12', category: slug, ...locParams };
  const key = `products:${JSON.stringify(params)}`;
  if (!apiCache.get(key)) {
    api.get('/api/products/', { params }).then(res => apiCache.set(key, res.data)).catch(() => {});
  }
  const sponsParams = { ...params, public: 'true' };
  const sponsKey = `sponsored:${JSON.stringify(sponsParams)}`;
  if (!apiCache.get(sponsKey)) {
    api.get('/api/sponsored/', { params: sponsParams }).then(res => apiCache.set(sponsKey, res.data)).catch(() => {});
  }
};

const CAT_STORAGE_KEY = 'uzaspea_categories_cache';

let categoriesCache: any[] | null = (() => {
  try {
    const saved = sessionStorage.getItem(CAT_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
})();
let categoriesPromise: Promise<any> | null = null;

import { useSiteSettings } from '../../utils/siteSettings';

import {
  productCache,
  productPromises,
  invalidateProductCache,
  fetchProductCached,
  getCachedProduct,
  setCachedProduct,
  seedProductsCache,
} from '../../utils/productCache';

export {
  productCache,
  productPromises,
  invalidateProductCache,
  fetchProductCached,
  getCachedProduct,
  setCachedProduct,
  seedProductsCache,
};

const CategoryBar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const siteSettings = useSiteSettings();
  const [categories, setCategories] = useState<any[]>(() => categoriesCache ? ensureArray(categoriesCache) : []);
  const [loading, setLoading] = useState(!categoriesCache || categoriesCache.length === 0);
  const forYouImage = siteSettings?.for_you_image || null;

  useEffect(() => {
    if (categoriesCache && categoriesCache.length > 0) {
      setCategories(ensureArray(categoriesCache));
      setLoading(false);
      // Background revalidation
      api.get('/api/categories/').then(res => {
        const fresh = ensureArray(res.data);
        categoriesCache = fresh;
        try { sessionStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(fresh)); } catch {}
        setCategories(fresh);
      }).catch(() => {});
    } else if (categoriesPromise) {
      categoriesPromise.then(cats => {
        setCategories(ensureArray(cats));
        setLoading(false);
      });
    } else {
      categoriesPromise = api.get('/api/categories/').then(res => {
        categoriesCache = ensureArray(res.data);
        try { sessionStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(categoriesCache)); } catch {}
        return categoriesCache;
      });
      categoriesPromise.then(cats => {
        setCategories(ensureArray(cats));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, []);

  const topCategories = useMemo(() => {
    const catsList = ensureArray(categories);
    if (catsList.length === 0) return [];

    const getDeepCount = (cat: any): number => {
      let count = cat.product_count || 0;
      if (cat.children && Array.isArray(cat.children)) {
        cat.children.forEach((child: any) => {
          count += getDeepCount(child);
        });
      }
      return count;
    };

    return catsList
      .filter((c: any) => !c.parent)
      .map((c: any) => ({ ...c, total_products: getDeepCount(c) }))
      .filter((c: any) => c.total_products > 0)
      .sort((a, b) => b.total_products - a.total_products);
  }, [categories]);

  useEffect(() => {
    if (topCategories.length > 0) {
      topCategories.slice(0, 8).forEach((cat: any) => {
        if (cat?.slug) prefetchCategoryProducts(cat.slug);
      });
    }
  }, [topCategories]);

  const selectedCategoryParam = searchParams.get('category') || '';
  const selectedSubcategoryParam = searchParams.get('subcategory') || '';

  const optimisticCategory = useSyncExternalStore(categoryStore.subscribe, categoryStore.getCategory);
  const optimisticSubcategory = useSyncExternalStore(categoryStore.subscribe, categoryStore.getSubcategory);

  useEffect(() => {
    categoryStore.resetIfMatches(selectedCategoryParam, selectedSubcategoryParam);
  }, [selectedCategoryParam, selectedSubcategoryParam]);

  const activeCategorySlug = optimisticCategory !== null ? optimisticCategory : selectedCategoryParam;
  const activeSubcategorySlug = optimisticSubcategory !== null ? optimisticSubcategory : selectedSubcategoryParam;

  const activeCategory = useMemo(() => {
    if (!activeCategorySlug && !activeSubcategorySlug) return null;
    return topCategories.find((c: any) => c.slug === activeCategorySlug) ||
      topCategories.find((c: any) => c.children?.some((child: any) => child.slug === (activeSubcategorySlug || activeCategorySlug))) ||
      null;
  }, [topCategories, activeCategorySlug, activeSubcategorySlug]);

  const effectiveCategorySlug = activeCategory ? activeCategory.slug : activeCategorySlug;
  const isForYouActive = !effectiveCategorySlug && !activeSubcategorySlug;

  const bgLocation = (location.state as any)?.backgroundLocation;
  const currentPath = bgLocation?.pathname || location.pathname;
  const isProductsPage = currentPath === '/products' || currentPath === '/browse_products' || currentPath === '/browse';

  // Only show on product catalog/listing pages (including background when modal is open)
  if (!isProductsPage) return null;

  const handleCategoryClick = (slug: string) => {
    const nextSlug = effectiveCategorySlug === slug ? '' : slug;
    
    // Instant synchronous UI feedback across CategoryBar and ProductList (0ms latency)
    categoryStore.setCategory(nextSlug, '');

    if (nextSlug) {
      prefetchCategoryProducts(nextSlug);
    } else {
      preloadProductList();
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    if (isProductsPage) {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        if (nextSlug) {
          newParams.set('category', nextSlug);
        } else {
          newParams.delete('category');
        }
        newParams.delete('subcategory');
        newParams.delete('saved');
        return newParams;
      }, { replace: true });
    } else {
      navigate(nextSlug ? `/products?category=${nextSlug}` : '/products');
    }
  };

  // CIRCLES Layout (category circles slider with subcategory pills)
  return (
      <div className="w-full pt-0.5 pb-0 md:pb-1 bg-white dark:bg-[#000000] transition-colors duration-300">
        <div className="container-page">
          <div data-horizontal-scroll="true" className="flex items-start justify-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar pt-2 pb-1.5 md:pt-3 md:pb-4 px-2 sm:px-3 w-full">
            {/* For You / Discover Circle */}
            <div 
              className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group select-none"
              onClick={() => handleCategoryClick('')}
              onMouseEnter={preloadProductList}
              onFocus={preloadProductList}
              onTouchStart={preloadProductList}
            >
              <div className="relative w-20 h-20 md:w-36 md:h-36 rounded-full flex items-center justify-center transition-transform duration-150 group-hover:scale-105 overflow-hidden shadow-sm hover:shadow-md border-2 border-transparent">
                {/* Rotating multicolor animated gradient filling the space between inner and outer circle */}
                <div 
                  className="absolute -inset-[50%] animate-[spin_4s_linear_infinite]"
                  style={{
                    background: 'conic-gradient(from 0deg, #ff007a, #7928ca, #0070f3, #00dfd8, #10b981, #facc15, #f97316, #ff007a)'
                  }}
                />
                {/* Inner circle matching exactly w-14 h-14 md:w-28 md:h-28 of category circles */}
                <div className="relative z-10 w-14 h-14 md:w-28 md:h-28 rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center overflow-hidden shadow-sm">
                  <SafeImage
                    src={forYouImage || '/logo.png'}
                    alt={t('for_you', 'For You')}
                    category="For You"
                    fallback="/logo.png"
                    containMode="cover"
                    className="w-full h-full object-cover rounded-full scale-110"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
              <span className={`text-xs md:text-sm font-bold text-center max-w-[5.5rem] md:max-w-[8.5rem] leading-tight line-clamp-2 ${isForYouActive ? 'text-brand-500 dark:text-brand-500 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>
                {t('for_you', 'For You')}
              </span>
            </div>

            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 shrink-0 animate-pulse">
                  <div className="w-20 h-20 md:w-36 md:h-36 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                  <div className="w-14 h-3 md:w-20 h-3.5 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </div>
              ))
            ) : (
              topCategories.filter((cat: any) => cat.total_products > 0).map((cat: any) => {
                const isActive = effectiveCategorySlug === cat.slug;
                return (
                  <div 
                    key={cat.id} 
                    className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group select-none"
                    onClick={() => handleCategoryClick(cat.slug)}
                    onMouseEnter={() => prefetchCategoryProducts(cat.slug)}
                    onFocus={() => prefetchCategoryProducts(cat.slug)}
                    onTouchStart={() => prefetchCategoryProducts(cat.slug)}
                  >
                    <div className={`relative w-20 h-20 md:w-36 md:h-36 rounded-full flex items-center justify-center transition-transform duration-150 group-hover:scale-105 overflow-visible border-2 ${isActive ? 'border-brand-500 bg-white dark:bg-neutral-900 shadow-md ring-1 ring-brand-500/30' : 'border-transparent bg-neutral-100 dark:bg-neutral-800 shadow-sm hover:shadow-md'}`}>
                      {cat.total_products > 0 && (
                        <span className="absolute -top-1.5 -right-1 md:top-0.5 md:right-0.5 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[9px] md:text-base font-bold md:font-extrabold px-1.5 py-0.5 md:px-2 rounded-full border md:border-2 border-neutral-200 dark:border-neutral-700 shadow-sm md:shadow-md md:min-w-[40px] md:h-[40px] flex items-center justify-center z-10">
                          {cat.total_products.toLocaleString()}
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
                    <span className={`text-xs md:text-sm font-bold text-center max-w-[5.5rem] md:max-w-[8.5rem] leading-tight line-clamp-2 ${isActive ? 'text-brand-500 dark:text-brand-500 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>
                      {cat.name}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        {/* SUB-CATEGORY PILLS */}
        {effectiveCategorySlug && (() => {
          const activeCat = topCategories.find(c => c.slug === effectiveCategorySlug);
          const availableChildren = activeCat?.children?.filter((sub: any) => (sub.product_count || 0) > 0) || [];
          if (activeCat && availableChildren.length > 0) {
            return (
              <div className="w-full bg-gray-50/50 dark:bg-black/50">
                <div className="container-page">
                  <div data-horizontal-scroll="true" className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar py-2.5 w-full scroll-smooth">
                    <button
                      onClick={() => {
                        categoryStore.setCategory(effectiveCategorySlug, '');
                        React.startTransition(() => {
                          setSearchParams(prev => {
                            const p = new URLSearchParams(prev);
                            p.delete('subcategory');
                            return p;
                          });
                        });
                      }}
                      className={`flex items-center px-3 py-1.5 rounded-full text-xs shrink-0 transition-colors ${
                        !activeSubcategorySlug
                          ? 'font-bold bg-neutral-300/80 dark:bg-neutral-700 text-neutral-950 dark:text-white shadow-sm'
                          : 'font-medium bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white shadow-sm'
                      }`}
                    >
                      <span>All {activeCat.name}</span>
                    </button>
                    {availableChildren.map((sub: any) => {
                      const isSelected = activeSubcategorySlug === sub.slug;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            categoryStore.setCategory(effectiveCategorySlug, sub.slug);
                            React.startTransition(() => {
                              setSearchParams(prev => {
                                const p = new URLSearchParams(prev);
                                p.set('subcategory', sub.slug);
                                return p;
                              });
                            });
                          }}
                          className={`flex items-center px-3 py-1.5 rounded-full text-xs shrink-0 transition-colors ${
                            isSelected
                              ? 'font-bold bg-neutral-300/80 dark:bg-neutral-700 text-neutral-950 dark:text-white shadow-sm'
                              : 'font-medium bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white shadow-sm'
                          }`}
                        >
                          <span>{sub.name}</span>
                          {sub.product_count > 0 && (
                            <span className={`ml-1 ${
                              isSelected
                                ? 'font-bold text-neutral-700 dark:text-neutral-300'
                                : 'font-normal text-neutral-500 dark:text-neutral-400'
                            }`}>
                              ({sub.product_count})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
};

export default CategoryBar;
