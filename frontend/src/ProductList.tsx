import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import api from './api';
import ProductCard from './components/ProductCard';
import { ProductCardSkeleton } from './components/Skeleton';

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } } as any;
const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as any } },
};

import PromotedProductsRow from './components/PromotedProductsRow';

// ---- Sponsored listing banner (dynamic) ----
const SponsoredBanner = memo(() => {
  const [ad, setAd] = useState<any>(null);

  useEffect(() => {
    api.get('/api/sponsored/')
      .then(res => {
        const ads = res.data.results || res.data;
        if (ads && ads.length > 0) {
          setAd(ads[0]);
        }
      })
      .catch(() => {});
  }, []);

  if (!ad) return null;

  return (
    <div className="col-span-full my-6 overflow-hidden">
      <Link to={`/product/${ad.product_slug}`} className="group relative block w-full h-[180px] sm:h-[220px] rounded-[2rem] bg-gray-900 border border-white/10 overflow-hidden shadow-2xl">
        {/* Background Image with Blur */}
        <div className="absolute inset-0 opacity-40 group-hover:scale-105 transition-transform duration-700">
            {ad.product_details?.images?.[0]?.image && (
                <img src={ad.product_details.images[0].image} alt="" className="w-full h-full object-cover blur-xl" />
            )}
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-900 via-brand-800/80 to-transparent" />
        
        {/* Content */}
        <div className="absolute inset-0 p-8 flex flex-col justify-center max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-brand-600 text-white text-[10px] font-black rounded-full uppercase tracking-[0.2em] shadow-lg shadow-brand-600/50">Sponsored Ad</span>
                <div className="h-1 w-8 bg-brand-500 rounded-full" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2 drop-shadow-lg">
                {ad.title}
            </h3>
            <p className="text-white/70 text-sm sm:text-base font-medium line-clamp-2 max-w-lg mb-6">
                {ad.description}
            </p>
            <div className="flex items-center gap-4">
                <span className="btn-primary py-2 px-6 bg-white text-brand-600 hover:bg-gray-100 border-0 shadow-xl shadow-white/10 group-hover:-translate-y-1 transition text-xs font-black uppercase tracking-widest">
                    Claim Deal
                </span>
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest group-hover:text-white transition">Limited Time Offer</span>
            </div>
        </div>

        {/* Floating Product Image */}
        <div className="absolute right-[-10%] sm:right-0 top-1/2 -translate-y-1/2 w-1/2 h-full hidden md:flex items-center justify-center">
             <div className="relative w-64 h-64 group-hover:rotate-3 transition-transform duration-500">
                <div className="absolute inset-0 bg-brand-500 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition" />
                {ad.product_details?.images?.[0]?.image && (
                    <img src={ad.product_details.images[0].image} alt="" className="relative z-10 w-full h-full object-contain drop-shadow-2xl" />
                )}
             </div>
        </div>
      </Link>
    </div>
  );
});

// Shared ProductCard is used via import

// ================================================================
// ProductList
// ================================================================
const ProductList = () => {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('viewMode') as any) || 'grid');

  const isFetchingRef = useRef(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const urlQuery = searchParams.get('q') || '';
  const isAuthenticated = !!localStorage.getItem('access_token');
  const ITEMS_PER_BANNER = 16; // 4 rows × 4 cols

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
    api.get('/api/categories/').then((r: any) => setCategories(r.data.results || r.data)).catch(() => {}); 
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
    if (localSearch.trim()) navigate(`/?q=${encodeURIComponent(localSearch.trim())}`);
    else navigate('/');
  };

  return (
    <div id="browse" className="container-page py-4 pb-24 md:pb-8">
      {/* ===== Search & Filter Bar (Mobile Optimized) ===== */}
      <div className="mb-6 space-y-4">
        
        {/* Search Input - Prominent on Mobile */}
        <div className="lg:hidden">
          <form onSubmit={onSearchSubmit} className="relative group">
            <input 
              type="search" 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search anything..." 
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-brand-500/20 dark:text-white transition-all overflow-hidden"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors">
              <Search size={20} />
            </div>
            {localSearch && (
              <button 
                type="button" 
                onClick={() => { setLocalSearch(''); navigate('/'); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </form>
          {urlQuery && isAuthenticated && (
            <button onClick={async () => {
                await api.post('/api/saved-searches/', { query: urlQuery, category: selectedCategory, min_price: minPrice, max_price: maxPrice, notify_on_match: true });
                toast.success('Search saved! You\'ll be notified of new matches.');
            }} className="flex text-xs text-brand-600 font-bold mt-2 items-center gap-1 hover:underline lg:hidden">
                <Bell size={14} /> Save this search
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white hidden lg:block">
            {urlQuery ? `Results for "${urlQuery}"` : 'Browse Marketplace'}
          </h2>
          {urlQuery && isAuthenticated && (
            <button onClick={async () => {
                await api.post('/api/saved-searches/', { query: urlQuery, category: selectedCategory, min_price: minPrice, max_price: maxPrice, notify_on_match: true });
                toast.success('Search saved! You\'ll be notified of new matches.');
            }} className="hidden lg:flex text-xs text-brand-600 font-bold ml-4 items-center gap-1 hover:underline">
                <Bell size={14} /> Save this search
            </button>
          )}
          
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            {/* View Mode Toggle */}
            <div className="bg-white dark:bg-gray-800 border border-surface-border dark:border-surface-dark-border rounded-btn p-1 flex mr-auto md:mr-0">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-btn transition-colors ${viewMode === 'grid' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30' : 'text-gray-400'}`}
                title="Grid View"
              >
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h8v8H3zm0 10h8v8H3zm10-10h8v8h-8zm0 10h8v8h-8z"/></svg>
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-btn transition-colors ${viewMode === 'list' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30' : 'text-gray-400'}`}
                title="List View"
              >
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M3 4h18v2H3zm0 7h18v2H3zm0 7h18v2H3z"/></svg>
              </button>
            </div>

            <button onClick={() => setFiltersOpen(!filtersOpen)}
              className={`pill ${filtersOpen ? 'pill-active' : 'pill-inactive'} flex items-center gap-1.5 h-[38px]`}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 4h18M7 9h10M10 14h4"/></svg>
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Horizontal Category Slider (Mobile optimized) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth">
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

        {/* Collapsible filter panel */}
        {filtersOpen && (
          <div className="card p-5 grid grid-cols-2 md:flex md:flex-wrap items-end gap-3 md:gap-4 animate-fade-in shadow-lg">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Min Price</label>
              <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" className="input py-2" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Max Price</label>
              <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Any" className="input py-2" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="input py-2">
                <option value="">All</option><option value="New">New</option><option value="Used">Used</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Sort By</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input py-2">
                <option value="">Newest</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="rating">Top Rated</option>
              </select>
            </div>
            <div className="col-span-full md:col-auto flex gap-2 w-full md:w-auto mt-2 md:mt-0">
              <button onClick={() => { setPage(1); fetchProducts(1, true); setFiltersOpen(false); }} className="btn-primary flex-1 py-2">Apply</button>
              <button 
                onClick={() => { setMinPrice(''); setMaxPrice(''); setCondition(''); setSortBy(''); }}
                className="btn-secondary py-2"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Promoted Products Section */}
      {!urlQuery && !selectedCategory && <PromotedProductsRow />}

      {/* ===== Product Grid ===== */}
      {loading ? (
        <div 
          className={viewMode === 'grid' 
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4.5"
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
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4.5"
              : "flex flex-col gap-3"
            }
            variants={containerVariants} initial="hidden" animate="visible"
          >
            {products.length === 0 ? (
              <div className="col-span-full card p-16 text-center bg-white/50 dark:bg-gray-800/50 backdrop-blur">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4m16 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1m16 0h-2M4 17h2m3 3h6M9 20h6"/></svg>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No products match your filters.</p>
                <button onClick={() => { setMinPrice(''); setMaxPrice(''); setCondition(''); setSortBy(''); setSelectedCategory(''); }} className="text-brand-600 dark:text-brand-400 text-sm mt-2 hover:underline">Clear all filters</button>
              </div>
            ) : (
              products.map((product: any, idx: number) => (
                <React.Fragment key={`${product.id}-${idx}`}>
                  {idx > 0 && idx % ITEMS_PER_BANNER === 0 && <SponsoredBanner />}
                  <motion.div variants={cardVariants}>
                    <ProductCard product={product} viewMode={viewMode} />
                  </motion.div>
                </React.Fragment>
              ))
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

