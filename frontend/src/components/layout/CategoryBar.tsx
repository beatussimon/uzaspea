import React, { useEffect, useState, useMemo, useSyncExternalStore } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
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
const SETTINGS_STORAGE_KEY = 'uzaspea_sitesettings_cache';

let categoriesCache: any[] | null = (() => {
  try {
    const saved = sessionStorage.getItem(CAT_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
})();
let categoriesPromise: Promise<any> | null = null;

let siteSettingsCache: any = (() => {
  try {
    const saved = sessionStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
})();
let siteSettingsPromise: Promise<any> | null = null;

const fetchSiteSettingsCached = () => {
  if (siteSettingsCache) return Promise.resolve(siteSettingsCache);
  if (siteSettingsPromise !== null) return siteSettingsPromise;
  siteSettingsPromise = api.get('/api/site-settings/')
    .then(res => {
      siteSettingsCache = res.data;
      try { sessionStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(res.data)); } catch {}
      return siteSettingsCache;
    })
    .catch(() => null);
  return siteSettingsPromise;
};

export const productCache: Record<string, { data: any; timestamp: number }> = {};
export const productPromises: Record<string, Promise<any>> = {};

export const invalidateProductCache = (slugOrId?: string | number) => {
  if (slugOrId) {
    const key = String(slugOrId);
    delete productCache[key];
    delete productPromises[key];
  } else {
    Object.keys(productCache).forEach(k => delete productCache[k]);
    Object.keys(productPromises).forEach(k => delete productPromises[k]);
  }
};

export const fetchProductCached = (slug: string, forceFresh = false) => {
  const now = Date.now();
  if (!forceFresh && productCache[slug] && (now - productCache[slug].timestamp < 30000)) {
    return Promise.resolve({ data: productCache[slug].data });
  }
  if (!forceFresh && productPromises[slug] !== undefined) return productPromises[slug];
  productPromises[slug] = api.get(`/api/products/${slug}/`).then(res => {
    productCache[slug] = { data: res.data, timestamp: Date.now() };
    if (res.data?.id) {
      productCache[String(res.data.id)] = { data: res.data, timestamp: Date.now() };
    }
    delete productPromises[slug];
    return res;
  }).catch(err => {
    delete productPromises[slug];
    throw err;
  });
  return productPromises[slug];
};

const CategoryBar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [categories, setCategories] = useState<any[]>(() => categoriesCache ? ensureArray(categoriesCache) : []);
  const [loading, setLoading] = useState(!categoriesCache || categoriesCache.length === 0);
  const [product, setProduct] = useState<any>(null);
  const [forYouImage, setForYouImage] = useState<string | null>(() => siteSettingsCache?.for_you_image || null);

  useEffect(() => {
    fetchSiteSettingsCached().then(data => {
      if (data?.for_you_image) {
        setForYouImage(data.for_you_image);
      }
    });
  }, []);

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

  const isProductsPage = location.pathname === '/products' || location.pathname === '/browse_products' || location.pathname === '/browse';
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
      fetchProductCached(productSlug)
        .then(res => setProduct(res.data))
        .catch(() => {});
    } else {
      setProduct(null);
    }
  }, [productSlug]);

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
  const allowedPaths = ['/products', '/product', '/browse_products', '/browse'];
  const showBar = allowedPaths.some(p => location.pathname.startsWith(p));

  if (!showBar) return null;

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

  // Render a loading skeleton for product details page
  if (isProductDetailPage && (loading || !product)) {
    return (
      <div className="w-full bg-white dark:bg-[#000000] transition-colors duration-300">
        <div className="container-page">
          <div className="flex items-center justify-center gap-2 py-2.5 w-full">
            <div className="h-7 w-24 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            <div className="h-7 w-24 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isProductsPage) {
    // CIRCLES Layout (original category circles slider, updated with desktop-large/mobile-small sizes)
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
                <div className="relative z-10 w-14 h-14 md:w-28 md:h-28 rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center overflow-hidden shadow-sm p-1.5 md:p-3">
                  <SafeImage
                    src={forYouImage || '/logo.png'}
                    alt={t('for_you', 'For You')}
                    category="For You"
                    fallback="/logo.png"
                    containMode="contain"
                    className="w-full h-full object-contain rounded-full"
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
              <div className="w-full bg-gray-50/50 dark:bg-black/50 border-t border-surface-border/30 dark:border-surface-dark-border/30">
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
                      className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold transition-transform duration-150 border shrink-0 ${!activeSubcategorySlug ? 'bg-brand-500 text-white border-brand-500 shadow-md' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
                    >
                      All {activeCat.name}
                    </button>
                    {availableChildren.map((sub: any) => (
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
                        className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold transition-transform duration-150 border shrink-0 ${activeSubcategorySlug === sub.slug ? 'bg-brand-500 text-white border-brand-500 shadow-md' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
                      >
                        {sub.name} {sub.product_count > 0 && <span className="ml-1 opacity-70">({sub.product_count})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
  }

  // PILLS Layout (displayed on details page, otherwise falls back to all categories if ever rendered elsewhere)
  const pillsToRender = isProductDetailPage 
    ? [productParentCat, productSubCat].filter(Boolean)
    : topCategories.filter((cat: any) => cat.total_products > 0);

  return (
    <div className="w-full bg-white dark:bg-[#000000] transition-colors duration-300">
      <div className="container-page">
        <div data-horizontal-scroll="true" className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar py-2.5 scroll-smooth w-full">
          {/* All Products Pill - only shown when showing all categories */}
          {!isProductDetailPage && (
            <button 
              onClick={() => handleCategoryClick('')}
              onMouseEnter={preloadProductList}
              onFocus={preloadProductList}
              onTouchStart={preloadProductList}
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
                  onMouseEnter={preloadProductList}
                  onFocus={preloadProductList}
                  onTouchStart={preloadProductList}
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
    </div>
  );
};

export default CategoryBar;
