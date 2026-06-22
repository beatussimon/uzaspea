import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from './api';
import ProductCard from './components/ProductCard';
import SponsorCard from './components/SponsorCard';
import { ProductCardSkeleton } from './components/Skeleton';

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
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sponsoredAds, setSponsoredAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [_page, setPage] = useState(1);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [condition, setCondition] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(!!urlQuery);

  // Temporary local states for filter inputs inside collapsible panel
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempCondition, setTempCondition] = useState('');
  const [tempSortBy, setTempSortBy] = useState('');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('viewMode') as any) || 'grid');

  const isFetchingRef = useRef(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = !!localStorage.getItem('access_token');
  
  

  const buildParams = useCallback(
    (p: number) => {
      const params: Record<string, string> = { page: String(p) };
      const cat = selectedSubcategory || selectedCategory;
      if (cat) params.category = cat;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (condition) params.condition = condition;
      if (sortBy) params.sort_by = sortBy;
      if (urlQuery) params.q = urlQuery;
      return params;
    },
    [selectedCategory, selectedSubcategory, minPrice, maxPrice, condition, sortBy, urlQuery]
  );

  const fetchProducts = useCallback(
    (p: number, reset = false) => {
      if (isFetchingRef.current && !reset) return;
      
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }
      
      isFetchingRef.current = true;
      
      api.get('/api/products/', { params: buildParams(p) })
        .then((res) => {
          const data = res.data.results || res.data;
          const incoming = Array.isArray(data) ? data : [];
          
          if (reset) {
            setProducts(incoming);
          } else {
            setProducts((prev) => {
              // Deduplicate based on product ID to prevent React key warnings
              const existingIds = new Set(prev.map(p => p.id));
              const uniqueIncoming = incoming.filter(p => !existingIds.has(p.id));
              return [...prev, ...uniqueIncoming];
            });
          }
          setHasMore(!!res.data.next);
        })
        .catch(() => setHasMore(false))
        .finally(() => { 
          setLoading(false); 
          setLoadingMore(false); 
          isFetchingRef.current = false;
        });
    },
    [buildParams]
  );

  useEffect(() => { 
    setPage(1); 
    fetchProducts(1, true); 
  }, [selectedCategory, selectedSubcategory, condition, sortBy, urlQuery, minPrice, maxPrice]);

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (urlQuery) {
      setSearchOpen(true);
    }
  }, [urlQuery]);

  useEffect(() => { 
    api.get('/api/categories/').then((r: any) => setCategories(r.data.results || r.data)).catch(() => {}); 
    api.get('/api/sponsored/?public=true').then((r: any) => setSponsoredAds(r.data.results || r.data)).catch(() => {});
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
      { rootMargin: '800px' }
    );
    
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchProducts]);

  const topCategories = categories.filter((c: any) => !c.parent);
  const activeParent = topCategories.find((c: any) => c.slug === selectedCategory);
  const subcategories = activeParent?.children || [];

  const [localSearch, setLocalSearch] = useState(urlQuery);
  const navigate = useNavigate();

  useEffect(() => { setLocalSearch(urlQuery); }, [urlQuery]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearch.trim()) navigate(`/products?q=${encodeURIComponent(localSearch.trim())}`);
    else navigate('/products');
  };

  const hasActiveFilters = !!(minPrice || maxPrice || condition || sortBy || selectedCategory || selectedSubcategory);

  // Sync temp inputs with active state when panel opens
  useEffect(() => {
    if (filtersOpen) {
      setTempMinPrice(minPrice);
      setTempMaxPrice(maxPrice);
      setTempCondition(condition);
      setTempSortBy(sortBy);
    }
  }, [filtersOpen, minPrice, maxPrice, condition, sortBy]);

  const activePills: any[] = [];
  if (minPrice) {
    activePills.push({
      id: 'minPrice',
      label: 'Min Price',
      value: `TSh ${parseInt(minPrice).toLocaleString()}`,
      onRemove: () => { setMinPrice(''); setTempMinPrice(''); },
    });
  }
  if (maxPrice) {
    activePills.push({
      id: 'maxPrice',
      label: 'Max Price',
      value: `TSh ${parseInt(maxPrice).toLocaleString()}`,
      onRemove: () => { setMaxPrice(''); setTempMaxPrice(''); },
    });
  }
  if (condition) {
    activePills.push({
      id: 'condition',
      label: 'Condition',
      value: condition,
      onRemove: () => { setCondition(''); setTempCondition(''); },
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
      onRemove: () => { setSortBy(''); setTempSortBy(''); },
    });
  }
  if (selectedCategory) {
    const catName = categories.find((c: any) => c.slug === selectedCategory)?.name || selectedCategory;
    activePills.push({
      id: 'category',
      label: 'Category',
      value: catName,
      onRemove: () => {
        setSelectedCategory('');
        setSelectedSubcategory('');
      },
    });
  }
  if (selectedSubcategory) {
    const subName = subcategories.find((c: any) => c.slug === selectedSubcategory)?.name || selectedSubcategory;
    activePills.push({
      id: 'subcategory',
      label: 'Subcategory',
      value: subName,
      onRemove: () => setSelectedSubcategory(''),
    });
  }

  // Interleave sponsored items natively inside CSS grid
  const buildGridEntries = (regular: any[], promoted: any[]): GridEntry[] => {
    const COLS = 4;
    const REGULAR_ROWS_BETWEEN = 3; // 3 rows of regular items between each sponsored row
    const entries: GridEntry[] = [];
    let promoIdx = 0;

    const injectSponsoredRow = () => {
      entries.push({ type: 'header' });
      for (let i = 0; i < COLS; i++) {
        if (promoIdx < promoted.length) {
          entries.push({ type: 'promo', product: promoted[promoIdx].product_details || promoted[promoIdx] });
          promoIdx++;
        } else {
          entries.push({ type: 'placeholder' });
        }
      }
    };

    if (regular.length > 0) {
      injectSponsoredRow();

      let regularCount = 0;
      for (const item of regular) {
        entries.push({ type: 'regular', product: item });
        regularCount++;
        if (regularCount % (COLS * REGULAR_ROWS_BETWEEN) === 0) {
          injectSponsoredRow();
        }
      }
    }

    return entries;
  };

  const gridEntries = buildGridEntries(products, sponsoredAds);

  return (
    <div id="browse" className="container-page py-4 pb-24 md:pb-8">
      {/* ===== Unified Search & Filter Section ===== */}
      <div className="mb-6 space-y-4">

        {/* Active Filter Pills (drawn from kiboss project inspiration) */}
        {activePills.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 animate-fade-in">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1">
              Active Filters:
            </span>
            {activePills.map((pill) => (
              <div
                key={pill.id}
                className="flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-full text-xs font-bold text-brand-700 dark:text-brand-400 animate-in zoom-in-95 duration-200"
              >
                <span className="opacity-60 font-medium">{pill.label}:</span>
                <span>{pill.value}</span>
                <button
                  onClick={pill.onRemove}
                  className="p-0.5 hover:bg-brand-100 dark:hover:bg-brand-800 rounded-full transition-colors"
                  aria-label={`Remove ${pill.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {activePills.length > 1 && (
              <button
                onClick={() => {
                  setMinPrice('');
                  setMaxPrice('');
                  setCondition('');
                  setSortBy('');
                  setTempMinPrice('');
                  setTempMaxPrice('');
                  setTempCondition('');
                  setTempSortBy('');
                  setSelectedCategory('');
                  setSelectedSubcategory('');
                }}
                className="text-xs font-bold text-gray-400 hover:text-brand-600 transition-colors ml-1 uppercase tracking-tighter"
              >
                Clear All
              </button>
            )}
          </div>
        )}

        {/* Integrated Action & Category Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Horizontal Category Slider (Mobile optimized) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 flex-1 -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth">
            <button onClick={() => { setSelectedCategory(''); setSelectedSubcategory(''); }}
              className={`pill shrink-0 ${!selectedCategory ? 'pill-active' : 'pill-inactive'}`}>All Products</button>
            {topCategories.map((cat: any) => (
              <button key={cat.id}
                onClick={() => { setSelectedCategory(selectedCategory === cat.slug ? '' : cat.slug); setSelectedSubcategory(''); }}
                className={`pill shrink-0 ${selectedCategory === cat.slug ? 'pill-active' : 'pill-inactive'}`}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Action controls aligned to the right */}
          <div className="flex items-center justify-between md:justify-end gap-2.5 shrink-0">
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
              onClick={() => setSearchOpen(!searchOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm ${
                searchOpen 
                  ? 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-gray-900' 
                  : urlQuery
                    ? 'bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-400'
                    : 'bg-white border-gray-200 text-gray-700 dark:bg-[#0A0A0A] dark:border-neutral-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-900'
              }`}
            >
              <Search size={12} />
              <span>Search</span>
              {urlQuery && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 ml-0.5 animate-pulse" />
              )}
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

        {/* Collapsible Search Panel */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-md my-2 flex justify-center">
                <form onSubmit={onSearchSubmit} className="relative flex items-center w-full max-w-2xl group">
                  <Search className="absolute left-4 text-gray-400 dark:text-neutral-500 transition-colors group-focus-within:text-brand-500 pointer-events-none" size={20} />
                  <input
                    type="search"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    placeholder="Search products, categories, or brands..."
                    className="w-full pl-12 pr-12 py-3 text-sm bg-white dark:bg-[#0A0A0A] text-gray-950 dark:text-white rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm focus:border-brand-500 focus:bg-white dark:focus:bg-black outline-none transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-600"
                    aria-label="Search products"
                  />
                  {localSearch && (
                    <button
                      type="button"
                      onClick={() => { setLocalSearch(''); navigate('/products'); }}
                      className="absolute right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      aria-label="Clear search"
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-md my-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Min Price (TSh)</label>
                    <input 
                      type="number" 
                      value={tempMinPrice} 
                      onChange={(e) => setTempMinPrice(e.target.value)} 
                      placeholder="0" 
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:text-white outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-black transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Max Price (TSh)</label>
                    <input 
                      type="number" 
                      value={tempMaxPrice} 
                      onChange={(e) => setTempMaxPrice(e.target.value)} 
                      placeholder="Any" 
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:text-white outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-black transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Condition</label>
                    <select 
                      value={tempCondition} 
                      onChange={(e) => setTempCondition(e.target.value)} 
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:text-white outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-black transition-all"
                    >
                      <option value="">All Conditions</option>
                      <option value="New">New</option>
                      <option value="Used">Used</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Sort By</label>
                    <select 
                      value={tempSortBy} 
                      onChange={(e) => setTempSortBy(e.target.value)} 
                      className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/50 dark:text-white outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-black transition-all"
                    >
                      <option value="">Newest Listings</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="rating">Top Rated</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-gray-100 dark:border-neutral-900">
                  <button 
                    onClick={() => {
                      setTempMinPrice('');
                      setTempMaxPrice('');
                      setTempCondition('');
                      setTempSortBy('');
                      setMinPrice('');
                      setMaxPrice('');
                      setCondition('');
                      setSortBy('');
                    }}
                    className="px-4 py-2 border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    Reset Filters
                  </button>
                  <button 
                    onClick={() => {
                      setMinPrice(tempMinPrice);
                      setMaxPrice(tempMaxPrice);
                      setCondition(tempCondition);
                      setSortBy(tempSortBy);
                      setPage(1);
                      setFiltersOpen(false);
                    }} 
                    className="px-6 py-2 bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subcategory slider */}
        {subcategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setSelectedSubcategory('')}
              className={`pill text-xs py-1 shrink-0 ${!selectedSubcategory ? 'pill-active' : 'pill-inactive'}`}>All {activeParent?.name}</button>
            {subcategories.map((s: any) => (
              <button key={s.id} onClick={() => setSelectedSubcategory(s.slug)}
                className={`pill text-xs py-1 shrink-0 ${selectedSubcategory === s.slug ? 'pill-active' : 'pill-inactive'}`}>{s.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* ===== Product Grid ===== */}
      {loading ? (
        <div 
          className={viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5"
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
              ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5"
              : "flex flex-col gap-3"
            }
            variants={containerVariants} initial="hidden" animate="visible"
          >
            {products.length === 0 ? (
              <div className="col-span-full card p-16 text-center bg-white/50 dark:bg-gray-800/50 backdrop-blur">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4m16 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1m16 0h-2M4 17h2m3 3h6M9 20h6"/></svg>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No products match your filters.</p>
                <button onClick={() => { setMinPrice(''); setMaxPrice(''); setCondition(''); setSortBy(''); setTempMinPrice(''); setTempMaxPrice(''); setTempCondition(''); setTempSortBy(''); setSelectedCategory(''); }} className="text-brand-600 dark:text-brand-400 text-sm mt-2 hover:underline">Clear all filters</button>
              </div>
            ) : (
              gridEntries.map((entry, idx) => {
                if (entry.type === 'header') {
                  if (viewMode !== 'grid') return null;
                  return (
                    <div key={`header-${idx}`} className="col-span-full flex items-center gap-2 mt-4 mb-2">
                      <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-850" />
                      <span className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Sponsored</span>
                      <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-850" />
                    </div>
                  );
                }

                if (entry.type === 'placeholder') {
                  if (viewMode !== 'grid') return null;
                  return (
                    <div key={`placeholder-${idx}`} className="relative h-full">
                      <SponsorCard />
                    </div>
                  );
                }

                const product = entry.product;
                if (!product) return null;
                const isPromo = entry.type === 'promo';

                return (
                  <motion.div key={`${product.id}-${idx}`} variants={cardVariants}>
                    <ProductCard product={product} viewMode={viewMode} isSponsored={isPromo} />
                  </motion.div>
                );
              })
            )}
          </motion.div>

          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent"></div>
            </div>
          )}

          {!hasMore && products.length > 0 && (
            <p className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">You've reached the end</p>
          )}
          <div ref={sentinelRef} className="h-1" />
        </>
      )}
    </div>
  );
};

export default ProductList;

