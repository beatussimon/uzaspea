import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, ArrowRight, Loader2, Tag, Filter } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { useTranslation } from 'react-i18next';
import api from '../api';
import SafeImage from './SafeImage';

const GlobalSearchModal: React.FC = () => {
  const { isSearchOpen, closeSearch } = useSearch();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Search State
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Filters State
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [condition, setCondition] = useState('');
  const [sortBy, setSortBy] = useState('');
  const urlView = searchParams.get('view');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (urlView === 'grid' || urlView === 'list') return urlView;
    return (localStorage.getItem('viewMode') as 'grid' | 'list') || 'grid';
  });

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
    
    // Build full query with all current filters + new view mode, navigate instantly
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    if (condition) params.set('condition', condition);
    if (sortBy) params.set('sort_by', sortBy);
    if (mode !== 'grid') params.set('view', mode);
    const qs = params.toString();
    navigate(qs ? `/products?${qs}` : '/products', { replace: true });
    // Do NOT close modal — user can see the layout change live
  };


  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch categories once
  useEffect(() => {
    api.get('/api/categories/')
      .then((r: any) => setCategories(r.data.results || r.data))
      .catch(() => {});
  }, []);

  const rootCategories = useMemo(() => {
    return categories.filter((c: any) => !c.parent);
  }, [categories]);

  const activeRootCategory = useMemo(() => {
    if (!category || !categories.length) return null;
    return categories.find((c: any) => 
      c.slug === category || (c.children && c.children.some((child: any) => child.slug === category))
    );
  }, [category, categories]);

  const activeSubCategory = useMemo(() => {
    if (!activeRootCategory || activeRootCategory.slug === category) return null;
    return activeRootCategory.children?.find((c: any) => c.slug === category) || null;
  }, [activeRootCategory, category]);

  const handleRootCategoryChange = (slug: string) => {
    setCategory(slug);
  };

  const handleSubCategoryChange = (slug: string) => {
    setCategory(slug || (activeRootCategory ? activeRootCategory.slug : ''));
  };

  const popularCategories = useMemo(() => {
    const flattenCategories = (cats: any[]): any[] => {
      let flat: any[] = [];
      cats.forEach(cat => {
        flat.push(cat);
        if (cat.children && Array.isArray(cat.children) && cat.children.length > 0) {
          flat = flat.concat(flattenCategories(cat.children));
        }
      });
      return flat;
    };

    const allFlattened = flattenCategories(categories);
    return allFlattened
      .filter((c: any) => (!c.children || c.children.length === 0) && (c.product_count || c.annotated_product_count || 0) > 0)
      .sort((a, b) => (b.product_count || b.annotated_product_count || 0) - (a.product_count || a.annotated_product_count || 0));
  }, [categories]);

  // Load recent searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentSearches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);



  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  // Hydrate states when opened
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };

    if (isSearchOpen) {
      setQuery(searchParams.get('q') || '');
      setCategory(searchParams.get('category') || '');
      setMinPrice(searchParams.get('min_price') || '');
      setMaxPrice(searchParams.get('max_price') || '');
      setCondition(searchParams.get('condition') || '');
      setSortBy(searchParams.get('sort_by') || '');
      setViewMode((searchParams.get('view') as any) || 'grid');
      
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    } else {
      document.body.style.overflow = '';
      setShowMobileFilters(false);
      window.removeEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchOpen]);

  // Debounced API call for predictive search
  useEffect(() => {
    const q = query.trim();
    if (!q && !category && !minPrice && !maxPrice && !condition) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      Promise.all([
        api.get('/api/profiles/', { params: { q, page_size: 3 } }).catch(() => ({ data: { results: [] } })),
        api.get('/api/products/', { 
          params: { q, category, min_price: minPrice, max_price: maxPrice, condition, sort_by: sortBy, page_size: 4 } 
        }).catch(() => ({ data: { results: [] } }))
      ]).then(([profileRes, productRes]) => {
        const profiles = (profileRes.data.results || profileRes.data || []).map((p: any) => ({ ...p, type: 'account' }));
        const products = (productRes.data.results || []).map((p: any) => ({ ...p, type: 'product' }));
        const sortedProducts = [...products].sort((a: any, b: any) => (b.is_sponsored ? 1 : 0) - (a.is_sponsored ? 1 : 0));
        
        setSuggestions([...profiles, ...sortedProducts]);
        setIsSearching(false);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, category, minPrice, maxPrice, condition, sortBy]);

  const buildQueryString = (overrides?: { category?: string; query?: string }) => {
    const params = new URLSearchParams();
    const q = overrides?.query !== undefined ? overrides.query : query;
    const cat = overrides?.category !== undefined ? overrides.category : category;

    if (q.trim()) params.set('q', q.trim());
    if (cat) params.set('category', cat);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    if (condition) params.set('condition', condition);
    if (sortBy) params.set('sort_by', sortBy);
    if (viewMode !== 'grid') params.set('view', viewMode);
    return params.toString();
  };

  const handleSubmit = (e?: React.FormEvent, overrides?: { category?: string; query?: string }) => {
    if (e) e.preventDefault();
    const finalQuery = overrides?.query !== undefined ? overrides.query.trim() : query.trim();
    const finalCat = overrides?.category !== undefined ? overrides.category : category;
    
    if (!finalQuery && !finalCat && !minPrice && !maxPrice && !condition) return;
    
    // Save to recent searches
    if (finalQuery) {
      const newSearches = [finalQuery, ...recentSearches.filter(s => s !== finalQuery)].slice(0, 5);
      setRecentSearches(newSearches);
      localStorage.setItem('recentSearches', JSON.stringify(newSearches));
    }

    if (suggestions.length > 0 && suggestions[0].type === 'account') {
      navigate(`/${suggestions[0].username}`);
      closeSearch();
      return;
    }

    const qs = buildQueryString(overrides);
    navigate(qs ? `/products?${qs}` : '/products');
    closeSearch();
  };

  const clearFilters = () => {
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setCondition('');
    setSortBy('');
  };

  const handleSuggestionClick = (item: any) => {
    if (item.type === 'account') {
      navigate(`/${item.username}`);
      closeSearch();
      return;
    }
    closeSearch();
    navigate(`/product/${item.slug}`, {
      state: { backgroundLocation: location }
    });
  };

  const activeFilterCount = [category, minPrice, maxPrice, condition, sortBy].filter(Boolean).length;

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-safe sm:pt-[8vh] px-4 pb-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSearch}
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md pointer-events-auto"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-5xl bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-2xl rounded-[24px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden border border-white/20 dark:border-white/5 flex flex-col md:flex-row max-h-[85vh] pointer-events-auto"
          >
            {/* Desktop Sidebar Filters */}
            <div className="hidden md:flex flex-col w-[280px] border-r border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-transparent">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-wider text-xs">
                  <Filter className="w-4 h-4" />
                  Filters
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-[10px] text-brand-500 dark:text-brand-500 hover:underline font-bold uppercase tracking-wider">Clear</button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Category</label>
                    <select 
                      value={activeRootCategory ? activeRootCategory.slug : ''} 
                      onChange={(e) => handleRootCategoryChange(e.target.value)} 
                      className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                    >
                      <option value="">All Categories</option>
                      {rootCategories.map((c: any) => (
                        <option key={c.slug} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {activeRootCategory && activeRootCategory.children && activeRootCategory.children.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Subcategory</label>
                      <select 
                        value={activeSubCategory ? activeSubCategory.slug : ''} 
                        onChange={(e) => handleSubCategoryChange(e.target.value)} 
                        className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                      >
                        <option value="">All in {activeRootCategory.name}</option>
                        {activeRootCategory.children.map((c: any) => (
                          <option key={c.slug} value={c.slug}>{c.name}</option>
                        ))}
                      </select>
                    </motion.div>
                  )}
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Price Range</label>
                  <div className="flex items-center gap-2">
                    <input type="number" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow" />
                    <span className="text-neutral-400">-</span>
                    <input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Condition</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow">
                    <option value="">Any Condition</option>
                    <option value="new">New</option>
                    <option value="used_good">Used - Good</option>
                    <option value="used_fair">Used - Fair</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Sort By</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow">
                    <option value="">Newest Listings</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating">Top Rated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">View Mode</label>
                  <div className="bg-neutral-200/50 dark:bg-neutral-900/50 rounded-xl p-1 flex">
                    <button 
                      type="button"
                      onClick={() => handleViewModeChange('grid')}
                      className={`flex-1 p-2 rounded-lg transition-all flex justify-center items-center ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                      title="Grid View"
                    >
                      <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h8v8H3zm0 10h8v8H3zm10-10h8v8h-8zm0 10h8v8h-8z"/></svg>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleViewModeChange('list')}
                      className={`flex-1 p-2 rounded-lg transition-all flex justify-center items-center ${viewMode === 'list' ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                      title="List View"
                    >
                      <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M3 4h18v2H3zm0 7h18v2H3zm0 7h18v2H3z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Search Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="relative border-b border-neutral-100 dark:border-neutral-800/50 z-10 bg-transparent">
                <form onSubmit={handleSubmit} className="flex items-center w-full relative">
                  <Search className="absolute left-6 w-6 h-6 text-brand-500" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('search_placeholder', 'Search products, categories, or brands...')}
                    className="w-full h-20 pl-16 pr-[120px] sm:pr-24 bg-transparent text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white placeholder:text-neutral-300 dark:placeholder:text-neutral-700 focus:outline-none"
                  />
                  
                  {/* Mobile Filters Toggle & Clear Button */}
                  <div className="absolute right-4 flex items-center gap-2">
                    {query && (
                      <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    <button type="button" onClick={() => setShowMobileFilters(!showMobileFilters)} className="md:hidden flex items-center gap-1 p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      <Filter className="w-4 h-4" />
                      {activeFilterCount > 0 && <span className="w-2 h-2 bg-brand-500 rounded-full"></span>}
                    </button>
                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                      <span>ESC</span>
                    </div>
                  </div>
                </form>
              </div>

              {/* Mobile Filters Dropdown */}
              <AnimatePresence>
                {showMobileFilters && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="md:hidden border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 overflow-hidden z-0"
                  >
                    <div className="p-4 space-y-4 max-h-[40vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold uppercase text-neutral-500 tracking-wider">Filters</span>
                        {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs text-brand-500 font-bold">Clear All</button>}
                      </div>
                      
                      <div className="space-y-2">
                        <select value={activeRootCategory ? activeRootCategory.slug : ''} onChange={(e) => handleRootCategoryChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300">
                          <option value="">All Categories</option>
                          {rootCategories.map((c: any) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                        </select>
                        {activeRootCategory && activeRootCategory.children && activeRootCategory.children.length > 0 && (
                          <select value={activeSubCategory ? activeSubCategory.slug : ''} onChange={(e) => handleSubCategoryChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300">
                            <option value="">All in {activeRootCategory.name}</option>
                            {activeRootCategory.children.map((c: any) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                          </select>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input type="number" placeholder="Min Price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none" />
                        <span className="text-neutral-400">-</span>
                        <input type="number" placeholder="Max Price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none" />
                      </div>

                      <div className="flex gap-2">
                        <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none">
                          <option value="">Any Condition</option>
                          <option value="new">New</option>
                          <option value="used_good">Used - Good</option>
                        </select>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none">
                          <option value="">Newest</option>
                          <option value="price_asc">Price Low</option>
                          <option value="price_desc">Price High</option>
                        </select>
                      </div>

                      <div className="bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-700 rounded-xl p-1 flex shadow-sm w-full mt-2">
                        <button 
                          type="button"
                          onClick={() => handleViewModeChange('grid')}
                          className={`flex-1 p-2 rounded-lg transition-colors flex justify-center items-center ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-white font-bold' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
                        >
                          <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24" className="mr-1.5"><path d="M3 3h8v8H3zm0 10h8v8H3zm10-10h8v8h-8zm0 10h8v8h-8z"/></svg>
                          <span className="text-xs">Grid</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleViewModeChange('list')}
                          className={`flex-1 p-2 rounded-lg transition-colors flex justify-center items-center ${viewMode === 'list' ? 'bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-white font-bold' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
                        >
                          <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24" className="mr-1.5"><path d="M3 4h18v2H3zm0 7h18v2H3zm0 7h18v2H3z"/></svg>
                          <span className="text-xs">List</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Results Area */}
              <div className="flex-1 overflow-y-auto no-scrollbar relative">
                {(!query.trim() && !category && !minPrice && !maxPrice && !condition) ? (
                  // Default State (Recent & Popular)
                  <div className="p-4 sm:p-6 space-y-6">
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Recent Searches</h3>
                          <button onClick={clearRecent} className="text-xs text-brand-500 dark:text-brand-500 hover:underline">Clear</button>
                        </div>
                        <div className="space-y-1">
                          {recentSearches.map((term, i) => (
                            <button
                              key={i}
                              onClick={() => { setQuery(term); handleSubmit(undefined, { query: term }); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 transition-colors text-left group"
                            >
                              <Clock className="w-4 h-4 text-neutral-400 group-hover:text-brand-500" />
                              <span className="flex-1 font-medium">{term}</span>
                              <ArrowRight className="w-4 h-4 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Popular Categories</h3>
                      <div className="flex flex-wrap gap-2">
                        {popularCategories.slice(0, 8).map((cat: any) => (
                          <button
                            key={cat.slug}
                            onClick={() => { setCategory(cat.slug); handleSubmit(undefined, { category: cat.slug }); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-100 dark:bg-neutral-800/60   text-neutral-700 dark:text-neutral-300 hover:text-brand-500 dark:hover:text-brand-500 text-sm font-medium transition-colors border border-transparent hover:border-brand-500/30"
                          >
                            <Tag className="w-3.5 h-3.5 opacity-50" />
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Suggestions State
                  <div className="p-2 sm:p-4">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                      </div>
                    ) : suggestions.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between px-3 mb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Preview Results</h3>
                        </div>
                        <div className="space-y-1">
                          {suggestions.map(item => (
                            <button
                              key={`${item.type}-${item.id}`}
                              onClick={() => handleSuggestionClick(item)}
                              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors text-left group"
                            >
                              <div className={`w-12 h-12 overflow-hidden shrink-0 flex items-center justify-center ${item.type === 'account' ? 'rounded-full ring-2 ring-transparent group-hover:ring-brand-500/20 transition-all' : 'rounded-lg'} bg-neutral-200 dark:bg-neutral-800`}>
                                {item.type === 'account' ? (
                                  item.profile_picture ? (
                                    <SafeImage 
                                      src={item.profile_picture} 
                                      alt={item.username}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full  text-brand-500  dark:text-brand-500 flex items-center justify-center font-bold text-lg uppercase">
                                      {item.username.charAt(0)}
                                    </div>
                                  )
                                ) : (
                                  <SafeImage 
                                    src={item.images?.[0]?.image} 
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {item.type === 'account' ? (
                                  <>
                                    <p className="font-bold text-sm text-neutral-900 dark:text-white truncate flex items-center gap-2 group-hover:text-brand-500 dark:group-hover:text-brand-500 transition-colors">
                                      @{item.username}
                                      {item.is_verified && (
                                        <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                        </svg>
                                      )}
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1 capitalize">
                                      {item.tier.replace('_', ' ')}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="font-bold text-sm text-neutral-900 dark:text-white truncate flex items-center gap-2 group-hover:text-brand-500 dark:group-hover:text-brand-500 transition-colors">
                                      {item.name}
                                      {item.is_sponsored && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider  text-brand-500 dark:text-brand-500">
                                          Ad
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1">
                                      {item.category_name} 
                                      {item.condition && <span className="opacity-50">• {item.condition}</span>}
                                    </p>
                                  </>
                                )}
                              </div>
                              {item.type === 'product' && (
                                <div className="shrink-0 text-right pr-2">
                                  <p className="font-bold text-sm text-brand-500 dark:text-brand-500">
                                    {item.price ? item.price.toLocaleString() : 'Negotiable'}
                                    {item.price && <span className="text-[10px] ml-1">TZS</span>}
                                  </p>
                                </div>
                              )}
                              {item.type === 'account' && (
                                <div className="shrink-0 text-right pr-2">
                                  <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[9px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest border border-neutral-200 dark:border-neutral-700/50">
                                    Profile
                                  </span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
                          <Search className="w-6 h-6 text-neutral-400" />
                        </div>
                        <p className="font-bold text-neutral-900 dark:text-white">No products found</p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-[250px]">
                          Try adjusting your filters or search keywords to find what you're looking for.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Sticky Submit Button Footer */}
              <div className="p-4 border-t border-neutral-100 dark:border-neutral-800/50 bg-transparent z-10 shrink-0">
                <button 
                  onClick={() => handleSubmit()}
                  className="w-full p-4  bg-brand-500  text-neutral-950 rounded-xl font-black text-base shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  Show Results {activeFilterCount > 0 ? `(${activeFilterCount} Filters)` : ''}
                </button>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GlobalSearchModal;
