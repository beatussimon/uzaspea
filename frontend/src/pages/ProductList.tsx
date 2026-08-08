import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, X, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import api from '../api';
import ProductCard from '../components/ProductCard';
import SponsorCard from '../components/SponsorCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { useSearch } from '../context/SearchContext';
import { apiCache } from '../utils/apiCache';
import SEO from '../components/SEO';

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const selectedCategory = searchParams.get('category') || '';
  const selectedSubcategory = searchParams.get('subcategory') || '';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const condition = searchParams.get('condition') || '';
  const sortBy = searchParams.get('sort_by') || '';
  const saved = searchParams.get('saved') === 'true';
  const savedTime = searchParams.get('saved_time') || '';

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
    if (urlQuery) params.q = urlQuery;
    if (saved) params.saved = 'true';
    if (savedTime) params.saved_time = savedTime;
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

  const [filtersOpen, setFiltersOpen] = useState(false);
  const { openSearch } = useSearch();

  // Temporary local states for filter inputs inside collapsible panel
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempCondition, setTempCondition] = useState('');
  const [tempSortBy, setTempSortBy] = useState('');
  const [tempSavedTime, setTempSavedTime] = useState('');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('viewMode') as any) || 'grid');

  const isFetchingRef = useRef(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = !!localStorage.getItem('access_token');
  
  

  const buildParams = useCallback(
    (p: number) => {
      const params: Record<string, string> = { page: String(p), page_size: '12' };
      const cat = selectedSubcategory || selectedCategory;
      if (cat) params.category = cat;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (condition) params.condition = condition;
      if (sortBy) params.sort_by = sortBy;
      if (urlQuery) params.q = urlQuery;
      if (saved) params.saved = 'true';
      if (savedTime) params.saved_time = savedTime;
      return params;
    },
    [selectedCategory, selectedSubcategory, minPrice, maxPrice, condition, sortBy, urlQuery, saved, savedTime]
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
  }, [selectedCategory, selectedSubcategory, condition, sortBy, urlQuery, minPrice, maxPrice, saved, savedTime]);

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (urlQuery) {
      // Do nothing, results are already filtered
    }
  }, [urlQuery]);

  const [pullY, setPullY] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  // Overscroll to go back to Home
  useEffect(() => {
    let pullDistance = 0;
    let startY = 0;
    let isFlipping = false;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && !isFlipping) {
        startY = e.touches[0].clientY;
        pullDistance = 0;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY <= 0 && startY > 0 && !isFlipping) {
        const y = e.touches[0].clientY;
        const deltaY = y - startY;
        if (deltaY > 0) {
          // Add friction to the pull
          pullDistance = deltaY * 0.4;
          setPullY(pullDistance);
          
          if (pullDistance > 120) {
            isFlipping = true;
            setIsNavigating(true);
            setPullY(window.innerHeight); // Swipe all the way down
            setTimeout(() => navigate('/'), 300);
          }
        }
      } else if (!isFlipping) {
         setPullY(0);
      }
    };
    
    const handleTouchEnd = () => {
      startY = 0;
      if (!isFlipping) setPullY(0);
    };
    
    const handleWheel = (e: WheelEvent) => {
      if (window.scrollY <= 0 && e.deltaY < 0 && !isFlipping) {
        pullDistance -= e.deltaY * 0.5;
        setPullY(pullDistance);
        
        if (pullDistance > 150) { 
          isFlipping = true;
          setIsNavigating(true);
          setPullY(window.innerHeight);
          setTimeout(() => navigate('/'), 300);
        }
      } else if (!isFlipping && e.deltaY > 0) {
        pullDistance = 0;
        setPullY(0);
      }
    };

    // Debounce resetting the wheel pull to allow smooth returning
    let wheelTimeout: ReturnType<typeof setTimeout>;
    const handleWheelEnd = () => {
      clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        if (!isFlipping) {
           pullDistance = 0;
           setPullY(0);
        }
      }, 150);
    };

    const handleWheelWrapper = (e: WheelEvent) => {
      handleWheel(e);
      handleWheelEnd();
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('wheel', handleWheelWrapper, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('wheel', handleWheelWrapper);
      clearTimeout(wheelTimeout);
    };
  }, [navigate]);


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
      { rootMargin: '2000px' }
    );
    
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchProducts]);

  const topCategories = useMemo(() => categories.filter((c: any) => !c.parent), [categories]);
  const activeParent = useMemo(() => topCategories.find((c: any) => c.slug === selectedCategory), [topCategories, selectedCategory]);
  const subcategories = useMemo(() => activeParent?.children || [], [activeParent]);



  const hasActiveFilters = !!(minPrice || maxPrice || condition || sortBy || selectedCategory || selectedSubcategory || savedTime);

  // Sync temp inputs with active state when panel opens
  useEffect(() => {
    if (filtersOpen) {
      setTempMinPrice(minPrice);
      setTempMaxPrice(maxPrice);
      setTempCondition(condition);
      setTempSortBy(sortBy);
      setTempSavedTime(savedTime);
    }
  }, [filtersOpen, minPrice, maxPrice, condition, sortBy, savedTime]);

  const activePills: any[] = [];
  if (minPrice) {
    activePills.push({
      id: 'minPrice',
      label: 'Min Price',
      value: `TSh ${parseInt(minPrice).toLocaleString()}`,
      onRemove: () => { updateFilters({ min_price: '' }); setTempMinPrice(''); },
    });
  }
  if (maxPrice) {
    activePills.push({
      id: 'maxPrice',
      label: 'Max Price',
      value: `TSh ${parseInt(maxPrice).toLocaleString()}`,
      onRemove: () => { updateFilters({ max_price: '' }); setTempMaxPrice(''); },
    });
  }
  if (condition) {
    activePills.push({
      id: 'condition',
      label: 'Condition',
      value: condition,
      onRemove: () => { updateFilters({ condition: '' }); setTempCondition(''); },
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
      onRemove: () => { updateFilters({ sort_by: '' }); setTempSortBy(''); },
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
    const subName = subcategories.find((c: any) => c.slug === selectedSubcategory)?.name || selectedSubcategory;
    activePills.push({
      id: 'subcategory',
      label: 'Subcategory',
      value: subName,
      onRemove: () => updateFilters({ subcategory: '' }),
    });
  }
  if (savedTime) {
    const label = savedTime === '24h' ? 'Last 24 Hours' : savedTime === '7d' ? 'Last 7 Days' : 'Last 30 Days';
    activePills.push({
      id: 'savedTime',
      label: 'Saved',
      value: label,
      onRemove: () => { updateFilters({ saved_time: '' }); setTempSavedTime(''); },
    });
  }

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
    <div 
      style={{ 
        transform: `translateY(${pullY}px)`, 
        transition: isNavigating ? 'transform 0.4s cubic-bezier(0.3, 0, 0.2, 1)' : pullY === 0 ? 'transform 0.2s ease' : 'none',
        opacity: isNavigating ? 0 : 1 
      }}
      className="transition-opacity duration-300 bg-surface-muted dark:bg-surface-dark min-h-screen -mt-4 pt-4 md:-mt-6 md:pt-6"
    >
      <SEO 
        title={seoTitle} 
        description={`Find the best ${urlQuery || selectedCategory || 'products'} on SokoniMax. Verified sellers, secure payments, and fast delivery in Tanzania.`} 
      />
      <div id="browse" className="container-page pb-24 md:pb-8">
      <div className={filtersOpen ? "mb-6 space-y-4" : ""}>





        {/* Collapsible Filter Panel */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-neutral-800 rounded-card p-5 shadow-md my-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Min Price (TSh)</label>
                    <input 
                      type="number" 
                      value={tempMinPrice} 
                      onChange={(e) => setTempMinPrice(e.target.value)} 
                      placeholder="0" 
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:text-white outline-none focus:border-gray-900 dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Max Price (TSh)</label>
                    <input 
                      type="number" 
                      value={tempMaxPrice} 
                      onChange={(e) => setTempMaxPrice(e.target.value)} 
                      placeholder="Any" 
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:text-white outline-none focus:border-gray-900 dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{t('condition', 'Condition')}</label>
                    <select 
                      value={tempCondition} 
                      onChange={(e) => setTempCondition(e.target.value)} 
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:text-white outline-none focus:border-gray-900 dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all"
                    >
                      <option value="">{t('all_conditions', 'All Conditions')}</option>
                      <option value="New">{t('new', 'New')}</option>
                      <option value="Used">{t('used', 'Used')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{t('sort_by', 'Sort By')}</label>
                    <select 
                      value={tempSortBy} 
                      onChange={(e) => setTempSortBy(e.target.value)} 
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:text-white outline-none focus:border-gray-900 dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all"
                    >
                      <option value="">{t('newest_listings', 'Newest Listings')}</option>
                      <option value="price_asc">{t('price_low_high', 'Price: Low to High')}</option>
                      <option value="price_desc">{t('price_high_low', 'Price: High to Low')}</option>
                      <option value="rating">{t('top_rated', 'Top Rated')}</option>
                    </select>
                  </div>
                  {saved && (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Time Saved</label>
                      <select 
                        value={tempSavedTime} 
                        onChange={(e) => setTempSavedTime(e.target.value)} 
                        className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:text-white outline-none focus:border-gray-900 dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all"
                      >
                        <option value="">All Time</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-gray-100 dark:border-neutral-900">
                  <button 
                    onClick={() => {
                      setTempMinPrice('');
                      setTempMaxPrice('');
                      setTempCondition('');
                      setTempSortBy('');
                      setTempSavedTime('');
                      updateFilters({
                        min_price: '',
                        max_price: '',
                        condition: '',
                        sort_by: '',
                        saved_time: ''
                      });
                      setPage(1);
                      setFiltersOpen(false);
                    }}
                    className="px-4 py-2 border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    {t('reset_filters', 'Reset Filters')}
                  </button>
                  <button 
                    onClick={() => {
                      updateFilters({
                        min_price: tempMinPrice,
                        max_price: tempMaxPrice,
                        condition: tempCondition,
                        sort_by: tempSortBy,
                        saved_time: tempSavedTime
                      });
                      setPage(1);
                      setFiltersOpen(false);
                    }} 
                    className="px-6 py-2 bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                  >
                    {t('apply_filters', 'Apply Filters')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Controls Row */}
        <div className="flex justify-end w-full px-4 md:px-0 mb-3">
          <div className="flex items-center gap-2.5 shrink-0">
            {urlQuery && isAuthenticated && (
              <button 
                onClick={async () => {
                  await api.post('/api/saved-searches/', { query: urlQuery, category: selectedCategory, min_price: minPrice, max_price: maxPrice, notify_on_match: true });
                  toast.success('Search saved! You\'ll be notified of new matches.');
                }} 
                className="flex text-[10px] text-brand-600 dark:text-brand-400 font-black uppercase tracking-wider items-center gap-1 hover:underline"
              >
                <Bell size={12} /> Save search
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 flex shadow-sm">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Grid View"
              >
                <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h8v8H3zm0 10h8v8H3zm10-10h8v8h-8zm0 10h8v8h-8z"/></svg>
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="List View"
              >
                <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M3 4h18v2H3zm0 7h18v2H3zm0 7h18v2H3z"/></svg>
              </button>
            </div>

            {/* Search Toggle Button */}
            <button 
              onClick={openSearch}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm ${
                urlQuery
                  ? 'bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-400'
                  : 'bg-white border-gray-200 text-gray-700 dark:bg-[#0A0A0A] dark:border-neutral-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-900'
              }`}
            >
              <Search size={12} />
              <span>{urlQuery ? `Search: ${urlQuery}` : t('search', 'Search')}</span>
            </button>

            {/* Filter Toggle Button */}
            <button 
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm ${
                filtersOpen 
                  ? 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-gray-900' 
                  : hasActiveFilters
                    ? 'bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-400'
                    : 'bg-white border-gray-200 text-gray-700 dark:bg-[#0A0A0A] dark:border-neutral-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-900'
              }`}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 4h18M7 9h10M10 14h4"/></svg>
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 ml-0.5 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Pills */}
        {activePills.length > 0 && (
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pb-2 mb-2 animate-fade-in px-4 md:px-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1">
              Active Filters:
            </span>
            {activePills.map((pill) => {
              let pillClasses = "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold animate-in zoom-in-95 duration-200 border ";
              if (pill.id === 'category') {
                pillClasses += "bg-transparent border-brand-500 text-gray-800 dark:text-gray-200";
              } else {
                pillClasses += "bg-gray-100 dark:bg-neutral-800 border-transparent text-gray-800 dark:text-gray-200";
              }

              return (
              <div
                key={pill.id}
                className={pillClasses}
              >
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
            {activePills.length > 1 && (
              <button
                onClick={() => {
                  updateFilters({ min_price: '', max_price: '', condition: '', sort_by: '', category: '', subcategory: '', saved: '', saved_time: '' });
                  setTempMinPrice('');
                  setTempMaxPrice('');
                  setTempCondition('');
                  setTempSortBy('');
                  setTempSavedTime('');
                }}
                className="text-xs font-bold text-gray-400 hover:text-brand-600 transition-colors ml-1 uppercase tracking-tighter"
              >
                Clear All
              </button>
            )}
          </div>
        )}

        {/* Subcategory slider */}
        {subcategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-2 px-4 md:px-0">
            <button onClick={() => updateFilters({ subcategory: '', saved: '' })}
              className={`pill text-xs py-1 shrink-0 ${!selectedSubcategory ? 'pill-active' : 'pill-inactive'}`}>
              All {activeParent?.name} <span className="opacity-60 ml-1">{activeParent?.product_count}</span>
            </button>
            {subcategories.map((s: any) => (
              <button key={s.id} onClick={() => updateFilters({ subcategory: s.slug, saved: '' })}
                className={`pill text-xs py-1 shrink-0 ${selectedSubcategory === s.slug ? 'pill-active' : 'pill-inactive'}`}>
                {s.name} <span className="opacity-60 ml-1">{s.product_count}</span>
              </button>
            ))}
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
                <button onClick={() => { updateFilters({ min_price: '', max_price: '', condition: '', sort_by: '', category: '', subcategory: '', saved_time: '' }); setTempMinPrice(''); setTempMaxPrice(''); setTempCondition(''); setTempSortBy(''); setTempSavedTime(''); }} className="text-brand-600 dark:text-brand-400 text-sm mt-2 hover:underline">{t('clear_all_filters', 'Clear all filters')}</button>
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
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent"></div>
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

