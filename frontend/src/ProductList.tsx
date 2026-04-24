import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import api from './api';
import toast from 'react-hot-toast';
import ProductCard from './components/ProductCard';

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

// ---- Sponsored listing banner (dynamic) ----
const SponsoredBanner = memo(() => {
  const [ad, setAd] = useState<any>(null);

  useEffect(() => {
    api.get('/api/sponsored/')
      .then(res => {
        const ads = res.data.results || res.data;
        if (ads && ads.length > 0) {
          // just pick first since backend already randomizes
          setAd(ads[0]);
        }
      })
      .catch(() => {});
  }, []);

  if (!ad) return null;

  return (
    <div className="col-span-full my-3">
      <Link to={`/product/${ad.product_slug}`} className="block bg-gradient-to-r from-brand-50 to-blue-50 dark:from-brand-900/15 dark:to-blue-900/15 border border-brand-200 dark:border-brand-800/40 rounded-card p-4 flex items-center justify-between gap-3 hover:shadow-md transition">
        <div className="min-w-0">
          <p className="font-semibold text-brand-900 dark:text-brand-200 text-sm flex items-center gap-1.5">
            <span className="badge-blue text-2xs uppercase">Sponsored</span>
            {ad.title}
          </p>
          <p className="text-xs text-brand-700 dark:text-brand-300 mt-0.5 truncate">{ad.description}</p>
        </div>
        <span className="btn-primary text-xs px-3 py-1.5 shrink-0 bg-brand-600">View Product</span>
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
  const [page, setPage] = useState(1);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [condition, setCondition] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const urlQuery = searchParams.get('q') || '';
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
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }
      
      api.get('/api/products/', { params: buildParams(p) })
        .then((res) => {
          const data = res.data.results || res.data;
          const arr = Array.isArray(data) ? data : [];
          if (reset) setProducts(arr); 
          else setProducts((prev) => [...prev, ...arr]);
          // Strict NEXT string check prevents double load assumptions
          setHasMore(!!res.data.next);
        })
        .catch(() => setHasMore(false))
        .finally(() => { setLoading(false); setLoadingMore(false); });
    },
    [buildParams]
  );

  useEffect(() => { 
    setPage(1); 
    fetchProducts(1, true); 
  }, [selectedCategory, selectedSubcategory, condition, sortBy, urlQuery, minPrice, maxPrice]);
  useEffect(() => { api.get('/api/categories/').then((r) => setCategories(r.data.results || r.data)).catch(() => {}); }, []);

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

  return (
    <div className="container-page py-4">
      {/* ===== Filter Pills ===== */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => { setSelectedCategory(''); setSelectedSubcategory(''); }}
            className={`pill ${!selectedCategory ? 'pill-active' : 'pill-inactive'}`}>All</button>
          {topCategories.map((cat: any) => (
            <button key={cat.id}
              onClick={() => { setSelectedCategory(selectedCategory === cat.slug ? '' : cat.slug); setSelectedSubcategory(''); }}
              className={`pill ${selectedCategory === cat.slug ? 'pill-active' : 'pill-inactive'}`}>
              {cat.name}
            </button>
          ))}
          <button onClick={() => setFiltersOpen(!filtersOpen)}
            className={`pill ml-auto ${filtersOpen ? 'pill-active' : 'pill-inactive'} flex items-center gap-1`}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 4h18M7 9h10M10 14h4"/></svg>
            Filters
          </button>
        </div>

        {/* Subcategory pills */}
        {subcategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            <button onClick={() => setSelectedSubcategory('')}
              className={`pill text-xs py-1 ${!selectedSubcategory ? 'pill-active' : 'pill-inactive'}`}>All {activeParent?.name}</button>
            {subcategories.map((s: any) => (
              <button key={s.id} onClick={() => setSelectedSubcategory(s.slug)}
                className={`pill text-xs py-1 ${selectedSubcategory === s.slug ? 'pill-active' : 'pill-inactive'}`}>{s.name}</button>
            ))}
          </div>
        )}

        {/* Collapsible filter panel */}
        {filtersOpen && (
          <div className="card p-4 flex flex-wrap items-end gap-4 animate-fade-in">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Min Price</label>
              <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" className="input w-24 py-1.5" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max Price</label>
              <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="∞" className="input w-24 py-1.5" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="input w-auto py-1.5">
                <option value="">All</option><option value="New">New</option><option value="Used">Used</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sort By</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input w-auto py-1.5">
                <option value="">Newest</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="rating">Rating</option>
              </select>
            </div>
            <button onClick={() => { setPage(1); fetchProducts(1, true); }} className="btn-primary text-sm py-1.5">Apply</button>
            <button onClick={() => { setMinPrice(''); setMaxPrice(''); setCondition(''); setSortBy(''); }} className="btn-secondary text-sm py-1.5">Clear</button>
          </div>
        )}
      </div>

      {/* ===== Product Grid ===== */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-600 border-t-transparent"></div>
        </div>
      ) : (
        <>
          <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
            variants={containerVariants} initial="hidden" animate="visible">
            {products.length === 0 ? (
              <div className="col-span-full card p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">No products found matching your criteria.</p>
              </div>
            ) : (
              products.map((product: any, idx: number) => (
                <React.Fragment key={product.id}>
                  {idx > 0 && idx % ITEMS_PER_BANNER === 0 && <SponsoredBanner />}
                  <motion.div variants={cardVariants}><ProductCard product={product} /></motion.div>
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
