import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import ProductCard from '../components/ProductCard';
import SponsorCard from '../components/SponsorCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { apiCache } from '../utils/apiCache';
import SEO from '../components/SEO';
import ExpandableSearch from '../components/ExpandableSearch';

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } } as any;
const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as any } },
};

type GridEntry =
  | { type: 'header' }
  | { type: 'promo'; product: any }
  | { type: 'placeholder' }
  | { type: 'regular'; product: any };

// ================================================================
// ProductList
// ================================================================
const ProductList = () => {
  const { t } = useTranslation();

  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const selectedCategory = searchParams.get('category') || '';
  const selectedSubcategory = searchParams.get('subcategory') || '';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const condition = searchParams.get('condition') || '';
  const sortBy = searchParams.get('sort_by') || '';
  const vehicleId = searchParams.get('vehicle_id') || '';
  const oemPartNumber = searchParams.get('oem_part_number') || '';
  const saved = searchParams.get('saved') === 'true';
  const savedTime = searchParams.get('saved_time') || '';
  const sellerFilter = searchParams.get('seller') || '';

  const updateFilters = (updates: Record<string, string>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) newParams.set(key, value);
        else newParams.delete(key);
      });
      return newParams;
    });
  };

  const initialParams = (() => {
    const params: Record<string, string> = { page: '1', page_size: '12' };
    const cat = selectedSubcategory || selectedCategory;
    if (cat) params.category = cat;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    if (condition) params.condition = condition;
    if (sortBy) params.sort_by = sortBy;
    if (vehicleId) params.vehicle_id = vehicleId;
    if (oemPartNumber) params.oem_part_number = oemPartNumber;
    if (urlQuery) params.q = urlQuery;
    if (saved) params.saved = 'true';
    if (savedTime) params.saved_time = savedTime;
    if (sellerFilter) params.seller = sellerFilter;
    return params;
  })();

  const initialProductsCacheKey = `products:${JSON.stringify(initialParams)}`;
  const initialSponsoredCacheKey = `sponsored:${JSON.stringify({ ...initialParams, public: 'true' })}`;

  const [products, setProducts] = useState<any[]>(() => {
    const cached = apiCache.get<any>(initialProductsCacheKey);
    return cached && Array.isArray(cached.data.results) ? cached.data.results : [];
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [sponsoredAds, setSponsoredAds] = useState<any[]>(() => {
    if (saved) return [];
    const cached = apiCache.get<any>(initialSponsoredCacheKey);
    return cached && Array.isArray(cached.data.results) ? cached.data.results : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = apiCache.get<any>(initialProductsCacheKey);
    return !cached;
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => {
    const cached = apiCache.get<any>(initialProductsCacheKey);
    return cached ? !!cached.data.next : true;
  });
  const [_page, setPage] = useState(1);

  const [gridCols, setGridCols] = useState(() => {
    if (typeof window === 'undefined') return 5;
    const w = window.innerWidth;
    if (w >= 1536) return 5;
    if (w >= 1280) return 4;
    if (w >= 1024) return 3;
    if (w >= 640) return 2;
    return 1;
  });

  useEffect(() => {
    let timeoutId: any;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const w = window.innerWidth;
        let c = 1;
        if (w >= 1536) c = 5;
        else if (w >= 1280) c = 4;
        else if (w >= 1024) c = 3;
        else if (w >= 640) c = 2;
        setGridCols(c);
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const urlView = searchParams.get('view');
  const viewMode = urlView === 'grid' || urlView === 'list' ? urlView : (localStorage.getItem('viewMode') as any) || 'grid';

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  const isFetchingRef = useRef(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildParams = useCallback(
    (p: number) => {
      const params: Record<string, string> = { page: String(p), page_size: '12' };
      const cat = searchParams.get('subcategory') || searchParams.get('category');
      if (cat) params.category = cat;
      
      searchParams.forEach((value, key) => {
        if (!['page', 'page_size', 'category', 'subcategory'].includes(key) && value) {
          params[key] = value;
        }
      });
      return params;
    },
    [searchParams]
  );

  const fetchProducts = useCallback(
    (p: number, reset = false) => {
      if (isFetchingRef.current && !reset) return;
      
      const prms = buildParams(p);
      const cacheKey = `products:${JSON.stringify(prms)}`;
      const cached = apiCache.get<any>(cacheKey);

      const sponsParams = { ...buildParams(1), public: 'true' };
      const sponsCacheKey = `sponsored:${JSON.stringify(sponsParams)}`;
      const cachedSpons = apiCache.get<any>(sponsCacheKey);

      if (reset) {
        if (cached) {
          // Instant cache hit for initial load
          setProducts(Array.isArray(cached.data.results) ? cached.data.results : []);
          setHasMore(!!cached.data.next);
          
          if (cachedSpons) {
             const sData = cachedSpons.data.results || cachedSpons.data || [];
             setSponsoredAds(Array.isArray(sData) ? sData : []);
          } else if (!saved) {
             api.get('/api/sponsored/', { params: sponsParams }).then(res => {
               apiCache.set(sponsCacheKey, res.data);
               const sData = res.data.results || res.data || [];
               setSponsoredAds(Array.isArray(sData) ? sData : []);
             }).catch(() => {});
          }

          setLoading(false);
          setPage(1);
        } else {
          setLoading(true);
          setPage(1);
        }
      } else {
        if (cached) {
          // Instant cache hit for infinite scroll next page
          const incoming = Array.isArray(cached.data.results) ? cached.data.results : [];
          setProducts((prev) => {
            const existingIds = new Set(prev.map(pr => pr.id));
            const uniqueIncoming = incoming.filter((item: any) => !existingIds.has(item.id));
            return [...prev, ...uniqueIncoming];
          });
          setHasMore(!!cached.data.next);
          setLoadingMore(false);
          
          // Pre-fetch next page immediately after a cache hit
          if (cached.data.next) {
            const nextParams = buildParams(p + 1);
            const nextKey = `products:${JSON.stringify(nextParams)}`;
            if (!apiCache.get<any>(nextKey)) {
              api.get('/api/products/', { params: nextParams }).then(res => apiCache.set(nextKey, res.data)).catch(()=>{});
            }
          }
          return; // Skip fetch since we already got it instantly
        } else {
          setLoadingMore(true);
        }
      }
      
      isFetchingRef.current = true;
      
      if (reset) {
        Promise.all([
          api.get('/api/products/', { params: prms }).catch(() => ({ data: { results: [] } })),
          saved ? Promise.resolve({ data: { results: [] } }) : api.get('/api/sponsored/', { params: sponsParams }).catch(() => ({ data: { results: [] } }))
        ]).then(([prodRes, sponsRes]) => {
          apiCache.set(cacheKey, prodRes.data); // Store to cache
          if (!saved && sponsRes.data) {
             apiCache.set(sponsCacheKey, sponsRes.data); // Store sponsored to cache
          }
          
          const prodData = prodRes.data.results || prodRes.data || [];
          const sponsData = sponsRes.data.results || sponsRes.data || [];
          
          setSponsoredAds(Array.isArray(sponsData) ? sponsData : []);
          setProducts(Array.isArray(prodData) ? prodData : []);
          setHasMore(!!(prodRes.data && prodRes.data.next));

          // Eager pre-fetch next page
          if (prodRes.data && prodRes.data.next) {
             const nextParams = buildParams(2);
             const nextKey = `products:${JSON.stringify(nextParams)}`;
             if (!apiCache.get<any>(nextKey)) {
               api.get('/api/products/', { params: nextParams }).then(res => apiCache.set(nextKey, res.data)).catch(()=>{});
             }
          }
        }).finally(() => {
          setLoading(false);
          setLoadingMore(false);
          isFetchingRef.current = false;
        });
      } else {
        api.get('/api/products/', { params: prms })
          .then((res) => {
            apiCache.set(cacheKey, res.data); // Store to cache
            
            const data = res.data.results || res.data;
            const incoming = Array.isArray(data) ? data : [];
            
            setProducts((prev) => {
              const existingIds = new Set(prev.map(pr => pr.id));
              const uniqueIncoming = incoming.filter((item: any) => !existingIds.has(item.id));
              return [...prev, ...uniqueIncoming];
            });
            setHasMore(!!res.data.next);

            // Eager pre-fetch next page
            if (res.data.next) {
               const nextParams = buildParams(p + 1);
               const nextKey = `products:${JSON.stringify(nextParams)}`;
               if (!apiCache.get<any>(nextKey)) {
                 api.get('/api/products/', { params: nextParams }).then(nxtRes => apiCache.set(nextKey, nxtRes.data)).catch(()=>{});
               }
            }
          })
          .catch(() => setHasMore(false))
          .finally(() => { 
            setLoading(false); 
            setLoadingMore(false); 
            isFetchingRef.current = false;
          });
      }
    },
    [buildParams, saved]
  );

  useEffect(() => { 
    setPage(1); 
    fetchProducts(1, true); 
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (urlQuery) {
      // Do nothing, results are already filtered
    }
  }, [urlQuery]);



  useEffect(() => {
    api.get('/api/categories/')
      .then((r: any) => setCategories(r.data.results || r.data))
      .catch(() => {});
  }, []);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => { 
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          // Use functional update to avoid race conditions
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchProducts(nextPage);
            return nextPage;
          });
        } 
      },
      { rootMargin: '400px' }
    );
    
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchProducts]);

  const topCategories = useMemo(() => {
    const getDeepCount = (cat: any): number => {
      let count = cat.product_count || 0;
      if (cat.children && Array.isArray(cat.children)) {
        cat.children.forEach((child: any) => {
          count += getDeepCount(child);
        });
      }
      return count;
    };

    return categories
      .filter((c: any) => !c.parent)
      .map((c: any) => ({ ...c, total_products: getDeepCount(c) }))
      .filter((c: any) => c.total_products > 0)
      .sort((a, b) => b.total_products - a.total_products);
  }, [categories]);
  const activeParent = useMemo(() => {
    if (!selectedCategory && !selectedSubcategory) return null;
    return topCategories.find((c: any) => c.slug === selectedCategory) || 
      topCategories.find((c: any) => c.children?.some((child: any) => child.slug === (selectedSubcategory || selectedCategory)));
  }, [topCategories, selectedCategory, selectedSubcategory]);
  const subcategories = useMemo(() => activeParent?.children || [], [activeParent]);



  const activePills: any[] = [];
  if (minPrice) {
    activePills.push({
      id: 'minPrice',
      label: 'Min Price',
      value: `TSh ${parseInt(minPrice).toLocaleString()}`,
      onRemove: () => { updateFilters({ min_price: '' }); },
    });
  }
  if (maxPrice) {
    activePills.push({
      id: 'maxPrice',
      label: 'Max Price',
      value: `TSh ${parseInt(maxPrice).toLocaleString()}`,
      onRemove: () => { updateFilters({ max_price: '' }); },
    });
  }
  if (condition) {
    const condLower = condition.toLowerCase();
    const conditionLabel = 
      condLower === 'new'
        ? 'New'
        : condLower.includes('good')
        ? 'Used - Good'
        : condLower.includes('fair')
        ? 'Used - Fair'
        : condLower.startsWith('used')
        ? 'Used'
        : condition;
    activePills.push({
      id: 'condition',
      label: 'Condition',
      value: conditionLabel,
      onRemove: () => { updateFilters({ condition: '' }); },
    });
  }
  if (sortBy) {
    const sortLabel =
      sortBy === 'price_asc'
        ? 'Price: Low to High'
        : sortBy === 'price_desc'
        ? 'Price: High to Low'
        : sortBy === 'rating'
        ? 'Top Rated'
        : 'Newest';
    activePills.push({
      id: 'sortBy',
      label: 'Sort',
      value: sortLabel,
      onRemove: () => { updateFilters({ sort_by: '' }); },
    });
  }
  if (selectedCategory) {
    const catName = categories.find((c: any) => c.slug === selectedCategory)?.name || selectedCategory;
    activePills.push({
      id: 'category',
      label: 'Category',
      value: catName,
      onRemove: () => {
        updateFilters({ category: '', subcategory: '', saved: '' });
      },
    });
  }
  if (selectedSubcategory) {
    const subName = (categories.find((c: any) => c.slug === selectedSubcategory)?.name) || 
      (subcategories.find((c: any) => c.slug === selectedSubcategory)?.name) || 
      selectedSubcategory;
    activePills.push({
      id: 'subcategory',
      label: 'Subcategory',
      value: subName,
      onRemove: () => updateFilters({ subcategory: '' }),
    });
  }
  if (vehicleId) {
    activePills.push({
      id: 'vehicleId',
      label: 'Vehicle',
      value: vehicleId,
      onRemove: () => updateFilters({ vehicle_id: '' }),
    });
  }
  if (oemPartNumber) {
    activePills.push({
      id: 'oemPartNumber',
      label: 'OEM Part',
      value: oemPartNumber,
      onRemove: () => updateFilters({ oem_part_number: '' }),
    });
  }
  if (saved) {
    activePills.push({
      id: 'saved',
      label: 'Filter',
      value: 'Saved Items',
      onRemove: () => { updateFilters({ saved: '' }); },
    });
  }
  if (savedTime) {
    const label = savedTime === '24h' ? 'Last 24 Hours' : savedTime === '7d' ? 'Last 7 Days' : 'Last 30 Days';
    activePills.push({
      id: 'savedTime',
      label: 'Saved',
      value: label,
      onRemove: () => { updateFilters({ saved_time: '' }); },
    });
  }
  if (sellerFilter) {
    activePills.push({
      id: 'seller',
      label: 'Store',
      value: `@${sellerFilter}`,
      type: 'seller',
      onRemove: () => { updateFilters({ seller: '' }); },
    });
  }

  const brand = searchParams.get('brand') || '';
  if (brand) {
    activePills.push({
      id: 'brand',
      label: 'Brand',
      value: brand.charAt(0).toUpperCase() + brand.slice(1),
      onRemove: () => updateFilters({ brand: '' }),
    });
  }

  const reservedKeys = new Set([
    'category', 'subcategory', 'q', 'min_price', 'max_price', 'condition', 'sort_by', 
    'seller', 'lat', 'lng', 'radius', 'brand', 'reference_product', 
    'mine', 'following', 'saved', 'saved_time', 'view', 'page', 'page_size',
    'limit', 'offset', 'cursor', 'ordering', 'format', 'search', 'vehicle_id',
    'make_id', 'model_id', 'year', 'oem_part_number', 'highlight', 't', '_', 'expand'
  ]);

  searchParams.forEach((value, key) => {
    if (!reservedKeys.has(key) && value && !key.startsWith('_')) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      activePills.push({
        id: `spec_${key}`,
        label,
        value,
        onRemove: () => updateFilters({ [key]: '' }),
      });
    }
  });

  // Interleave sponsored items natively inside CSS grid
  const buildGridEntries = (regular: any[], promoted: any[]): GridEntry[] => {
    // If viewing saved items, don't show promos or placeholders at all
    if (saved) {
      return regular.map(product => ({ type: 'regular', product }));
    }

    // Filter out regular items that are already shown as promoted
    const uniqueRegular = regular.filter((regItem) => {
      return !promoted.some((promoItem) => {
        const promoId = promoItem.product_details?.id || promoItem.product?.id || promoItem.id;
        return promoId === regItem.id;
      });
    });

    const COLS = viewMode === 'list' ? 1 : gridCols;
    const REGULAR_ROWS_BETWEEN = 3; // 3 rows of regular items between each sponsored row
    const entries: GridEntry[] = [];
    let promoIdx = 0;

    const injectSponsoredRow = () => {
      for (let i = 0; i < COLS; i++) {
        if (promoIdx < promoted.length) {
          entries.push({ type: 'promo', product: promoted[promoIdx].product_details || promoted[promoIdx] });
          promoIdx++;
        } else {
          entries.push({ type: 'placeholder' });
        }
      }
    };

    if (uniqueRegular.length > 0) {
      injectSponsoredRow();

      let regularCount = 0;
      for (const item of uniqueRegular) {
        entries.push({ type: 'regular', product: item });
        regularCount++;
        if (regularCount % (COLS * REGULAR_ROWS_BETWEEN) === 0) {
          injectSponsoredRow();
        }
      }
    }

    // Always inject any remaining sponsored items at the end ONLY if there are no more regular products to fetch
    if (!hasMore) {
      while (promoIdx < promoted.length) {
        injectSponsoredRow();
      }
    }

    return entries;
  };

  const gridEntries = buildGridEntries(products, sponsoredAds);

  const seoTitle = urlQuery 
    ? `Search Results for "${urlQuery}" - SokoniMax`
    : selectedCategory 
      ? `${categories.find((c: any) => c.slug === selectedCategory)?.name || 'Category'} - SokoniMax`
      : 'Browse Products - SokoniMax';

  return (
    <div className="bg-surface-muted dark:bg-surface-dark min-h-screen -mt-4 pt-4 md:-mt-6 md:pt-6">
      <SEO 
        title={seoTitle} 
        description={`Find the best ${urlQuery || selectedCategory || 'products'} on SokoniMax. Verified sellers, secure payments, and fast delivery in Tanzania.`} 
      />
      <div id="browse" className="container-page pb-24 md:pb-8">
      <div className="mb-6 space-y-4">
        
        {/* Local Search for Saved Items */}
        {saved && (
          <div className="px-4 md:px-0 flex justify-center w-full">
            <ExpandableSearch 
              value={urlQuery} 
              onChange={(val) => updateFilters({ q: val })} 
              placeholder={t('search_saved_items', 'Search your saved items...')}
              pillLabel={t('search_saved', 'Search Saved')}
            />
          </div>
        )}

        {/* Seller Store Banner */}
        {sellerFilter && (
          <div className="flex items-center gap-3 px-4 md:px-0 py-3 mb-2">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-brand-500/5 dark:bg-brand-500/10 border border-brand-500/15 dark:border-brand-500/20 flex-1">
              <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-500 text-xs font-bold uppercase">
                {sellerFilter.charAt(0)}
              </div>
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Results in <Link to={`/${sellerFilter}`} className="font-bold text-brand-500 hover:underline">@{sellerFilter}</Link>'s store
              </span>
              <button
                onClick={() => updateFilters({ seller: '' })}
                className="ml-auto text-xs font-bold text-neutral-400 hover:text-brand-500 transition-colors"
              >
                Show all
              </button>
            </div>
          </div>
        )}

        {/* Unified Search Query & Active Filters Row */}
        {(urlQuery || activePills.length > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-0 py-2 border-b border-gray-200/60 dark:border-neutral-800/60 pb-3">
            {/* Left: Search Header & Filter Pills Inline */}
            <div className="flex flex-wrap items-center gap-2.5">
              {urlQuery ? (
                <div className="flex items-center gap-2 mr-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Search:</span>
                  <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                    Results for <span className="text-brand-600 dark:text-brand-400">"{urlQuery}"</span>
                  </h1>
                </div>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1">
                  Active Filters:
                </span>
              )}

              {/* Filter Pills */}
              {activePills.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {urlQuery && <span className="text-neutral-300 dark:text-neutral-700 hidden sm:inline">|</span>}
                  {activePills.map((pill) => {
                    let pillClasses = "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold animate-in zoom-in-95 duration-200 border ";
                    if (pill.id === 'category') {
                      pillClasses += "bg-transparent border-brand-500 text-gray-800 dark:text-gray-200";
                    } else {
                      pillClasses += "bg-gray-100 dark:bg-neutral-800 border-transparent text-gray-800 dark:text-gray-200";
                    }

                    return (
                      <div key={pill.id} className={pillClasses}>
                        <span className="opacity-60 font-medium">{pill.label}:</span>
                        <span>{pill.value}</span>
                        <button
                          onClick={pill.onRemove}
                          className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                          aria-label={`Remove ${pill.label} filter`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Clear Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSearchParams(prev => {
                    const newParams = new URLSearchParams();
                    const view = prev.get('view');
                    if (view) newParams.set('view', view);
                    return newParams;
                  });
                }}
                className="text-xs font-bold text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-red-950/30 uppercase tracking-tight"
                title={urlQuery && activePills.length === 0 ? t('clear_search', 'Clear Search') : t('clear_all', 'Clear All')}
              >
                <X size={13} />
                <span>{urlQuery && activePills.length === 0 ? t('clear_search', 'Clear Search') : t('clear_all', 'Clear All')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Product Grid ===== */}
      {loading ? (
        <div 
          className={viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5 p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none"
            : "flex flex-col gap-3"
          }
        >
          {[...Array(10)].map((_, i) => (
            <ProductCardSkeleton key={i} viewMode={viewMode} />
          ))}
        </div>
      ) : (
        <>
          <motion.div 
            className={viewMode === 'grid' 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5 p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none"
              : "flex flex-col gap-3"
            }
            variants={containerVariants} initial="hidden" animate="visible"
          >
            {gridEntries.length === 0 ? (
              <div className="col-span-full card p-16 text-center bg-white/50 dark:bg-gray-800/50 backdrop-blur">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4m16 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1m16 0h-2M4 17h2m3 3h6M9 20h6"/></svg>
                <p className="text-gray-500 dark:text-gray-400 font-medium">{t('no_products_match', 'No products match your filters.')}</p>
                <button onClick={() => { setSearchParams(prev => { const newParams = new URLSearchParams(); const view = prev.get('view'); if (view) newParams.set('view', view); return newParams; }); }} className="text-brand-500 dark:text-brand-500 text-sm mt-2 hover:underline">{t('clear_all_filters', 'Clear all filters')}</button>
              </div>
            ) : (
              gridEntries.map((entry, idx) => {
                if (entry.type === 'placeholder') {
                  if (viewMode !== 'grid') return null;
                  return (
                    <div key={`placeholder-${idx}`} className="relative h-full">
                      <SponsorCard />
                    </div>
                  );
                }
                if ('product' in entry) {
                  const product = entry.product;
                  if (!product) return null;
                  const isPromo = entry.type === 'promo';

                  return (
                    <motion.div key={`${product.id}-${idx}`} variants={cardVariants} className="h-full">
                      <ProductCard product={product} viewMode={viewMode} isSponsored={isPromo} />
                    </motion.div>
                  );
                }
                return null;
              })
            )}
          </motion.div>

          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
            </div>
          )}

          {!hasMore && products.length > 0 && (
            <p className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">{t('reached_end', "You've reached the end")}</p>
          )}
          <div ref={sentinelRef} className="h-1" />
        </>
      )}

      </div>
    </div>
  );
};

export default ProductList;

