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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch categories once
  useEffect(() => {
    api.get('/api/categories/')
      .then((r: any) => setCategories(r.data.results || r.data))
      .catch(() => {});
  }, []);

  const topCategories = useMemo(() => categories.filter((c: any) => !c.parent), [categories]);

  // Load recent searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentSearches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const saveRecentSearch = (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;
    try {
      const updated = [q, ...recentSearches.filter(item => item !== q)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    } catch (e) {}
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  // Hydrate states when opened
  useEffect(() => {
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
    } else {
      document.body.style.overflow = '';
      setShowMobileFilters(false);
    }
  }, [isSearchOpen, searchParams]);

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
      api.get('/api/products/', { 
        params: { 
          q, 
          category,
          min_price: minPrice,
          max_price: maxPrice,
          condition,
          sort_by: sortBy,
          page_size: 4 
        } 
      })
        .then(res => {
          setSuggestions(res.data.results || []);
          setIsSearching(false);
        })
        .catch(() => {
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, category, minPrice, maxPrice, condition, sortBy]);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    if (condition) params.set('condition', condition);
    if (sortBy) params.set('sort_by', sortBy);
    if (viewMode !== 'grid') params.set('view', viewMode);
    return params.toString();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim()) saveRecentSearch(query);
    
    const qs = buildQueryString();
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

  const handleSuggestionClick = (product: any) => {
    if (query.trim()) saveRecentSearch(query);
    navigate(`/product/${product.slug}`);
    closeSearch();
  };

  const activeFilterCount = [category, minPrice, maxPrice, condition, sortBy].filter(Boolean).length;

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-safe sm:pt-[5vh] px-4 pb-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSearch}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-5xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row max-h-[90vh]"
          >
            {/* Desktop Sidebar Filters */}
            <div className="hidden md:flex flex-col w-[280px] border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-wider text-xs">
                  <Filter className="w-4 h-4" />
                  Filters
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-bold uppercase tracking-wider">Clear</button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Category</label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)} 
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300"
                  >
                    <option value="">All Categories</option>
                    {topCategories.map((c: any) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Price Range</label>
                  <div className="flex items-center gap-2">
                    <input type="number" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300" />
                    <span className="text-neutral-400">-</span>
                    <input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Condition</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300">
                    <option value="">Any Condition</option>
                    <option value="new">New</option>
                    <option value="used_good">Used - Good</option>
                    <option value="used_fair">Used - Fair</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Sort By</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300">
                    <option value="">Newest Listings</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating">Top Rated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">View Mode</label>
                  <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 flex shadow-sm">
                    <button 
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`flex-1 p-2 rounded-lg transition-colors flex justify-center items-center ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                      title="Grid View"
                    >
                      <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h8v8H3zm0 10h8v8H3zm10-10h8v8h-8zm0 10h8v8h-8z"/></svg>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`flex-1 p-2 rounded-lg transition-colors flex justify-center items-center ${viewMode === 'list' ? 'bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
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
              <div className="relative border-b border-neutral-200 dark:border-neutral-800 z-10 bg-white dark:bg-neutral-900">
                <form onSubmit={handleSubmit} className="flex items-center w-full relative">
                  <Search className="absolute left-4 w-6 h-6 text-neutral-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('search_placeholder', 'Search products, categories, or brands...')}
                    className="w-full h-16 pl-14 pr-[120px] sm:pr-24 bg-transparent text-lg font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none"
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
                      
                      <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none">
                        <option value="">All Categories</option>
                        {topCategories.map((c: any) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                      </select>

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
                          onClick={() => setViewMode('grid')}
                          className={`flex-1 p-2 rounded-lg transition-colors flex justify-center items-center ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-white font-bold' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
                        >
                          <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24" className="mr-1.5"><path d="M3 3h8v8H3zm0 10h8v8H3zm10-10h8v8h-8zm0 10h8v8h-8z"/></svg>
                          <span className="text-xs">Grid</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setViewMode('list')}
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
                          <button onClick={clearRecent} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Clear</button>
                        </div>
                        <div className="space-y-1">
                          {recentSearches.map((term, i) => (
                            <button
                              key={i}
                              onClick={() => { setQuery(term); handleSubmit(); }}
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
                        {topCategories.slice(0, 8).map((cat: any) => (
                          <button
                            key={cat.slug}
                            onClick={() => { setCategory(cat.slug); handleSubmit(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 text-sm font-medium transition-colors"
                          >
                            <Tag className="w-3.5 h-3.5 text-neutral-400" />
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
                          {suggestions.map(product => (
                            <button
                              key={product.id}
                              onClick={() => handleSuggestionClick(product)}
                              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors text-left group"
                            >
                              <div className="w-12 h-12 rounded-lg bg-neutral-200 dark:bg-neutral-800 overflow-hidden shrink-0">
                                <SafeImage 
                                  src={product.images?.[0]?.image} 
                                  alt={product.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-neutral-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                  {product.title}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1">
                                  {product.category_name} 
                                  {product.condition && <span className="opacity-50">• {product.condition}</span>}
                                </p>
                              </div>
                              <div className="shrink-0 text-right pr-2">
                                <p className="font-bold text-sm text-brand-600 dark:text-brand-400">
                                  {product.price ? product.price.toLocaleString() : 'Negotiable'}
                                  {product.price && <span className="text-[10px] ml-1">TZS</span>}
                                </p>
                              </div>
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
              <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10 shrink-0">
                <button 
                  onClick={() => handleSubmit()}
                  className="w-full p-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
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
