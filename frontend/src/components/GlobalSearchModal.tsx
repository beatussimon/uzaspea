import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, ArrowRight, Loader2, Tag, Filter, ShoppingCart } from 'lucide-react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { useCart } from '../context/CartContext';
import { useTranslation } from 'react-i18next';
import api from '../api';
import SafeImage from './SafeImage';
import VehicleSelector from './VehicleSelector';

const GlobalSearchModal: React.FC = () => {
  const { isSearchOpen, sellerScope, closeSearch, openSearch } = useSearch();
  const { addToCart } = useCart();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Search State
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Filters State
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryBrands, setCategoryBrands] = useState<any[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [condition, setCondition] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [oemPartNumber, setOemPartNumber] = useState('');
  
  // Dynamic Specs
  const [specSchema, setSpecSchema] = useState<any[]>([]);
  const [specFilters, setSpecFilters] = useState<Record<string, string>>({});
  
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
    if (subcategory) params.set('subcategory', subcategory);
    if (brand) params.set('brand', brand);
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

  const activeCategorySlug = subcategory || category;

  useEffect(() => {
    if (activeCategorySlug) {
      api.get(`/api/categories/${activeCategorySlug}/spec-schema/`)
        .then((r: any) => setSpecSchema(r.data))
        .catch(() => setSpecSchema([]));
      api.get(`/api/categories/${activeCategorySlug}/brands/`)
        .then((r: any) => setCategoryBrands(Array.isArray(r.data) ? r.data : r.data.results || []))
        .catch(() => setCategoryBrands([]));
    } else {
      setSpecSchema([]);
      setSpecFilters({});
      setCategoryBrands([]);
      setBrand('');
    }
  }, [activeCategorySlug]);

  const rootCategories = useMemo(() => {
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
      .filter((c: any) => c.total_products > 0);
  }, [categories]);

  const activeRootCategory = useMemo(() => {
    if (!category || !categories.length) return null;
    return categories.find((c: any) => 
      c.slug === category || (c.children && c.children.some((child: any) => child.slug === category))
    );
  }, [category, categories]);

  const handleRootCategoryChange = (slug: string) => {
    setCategory(slug);
    setSubcategory('');
    setBrand('');
    setVehicleId('');
    setOemPartNumber('');
    setSpecFilters({});
  };

  const handleSubCategoryChange = (slug: string) => {
    setSubcategory(slug);
    setBrand('');
    setVehicleId('');
    setOemPartNumber('');
    setSpecFilters({});
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

  // Load recent searches (scoped per seller when applicable)
  const recentSearchesKey = sellerScope ? `recentSearches_@${sellerScope.username}` : 'recentSearches';
  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentSearchesKey);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      } else {
        setRecentSearches([]);
      }
    } catch (e) {}
  }, [recentSearchesKey]);



  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem(recentSearchesKey);
  };

  // Hydrate states when opened
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };

    if (isSearchOpen) {
      setQuery(searchParams.get('q') || '');
      const urlCat = searchParams.get('category') || '';
      const urlSubCat = searchParams.get('subcategory') || '';
      setCategory(urlCat);
      setSubcategory(urlSubCat);
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
    const effectiveCategory = subcategory || category;
    if (!q && !effectiveCategory && !brand && !minPrice && !maxPrice && !condition && !vehicleId && !oemPartNumber && Object.keys(specFilters).length === 0) {
      setSuggestions([]);
      setTotalCount(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      const productParams: any = { 
        q, 
        category: effectiveCategory, 
        min_price: minPrice, 
        max_price: maxPrice, 
        condition, 
        sort_by: sortBy, 
        vehicle_id: vehicleId, 
        oem_part_number: oemPartNumber, 
        page_size: 6 
      };
      if (brand) productParams.brand = brand;
      if (specFilters && typeof specFilters === 'object') {
        Object.entries(specFilters).forEach(([k, v]) => {
          if (v) productParams[k] = v;
        });
      }
      if (sellerScope) productParams.seller = sellerScope.username;

      const promises: Promise<any>[] = [];
      // Only search user profiles when a search keyword is typed, NEVER on pure category/filter browse
      if (q.length >= 2 && !sellerScope && !vehicleId && !oemPartNumber) {
        promises.push(api.get('/api/profiles/', { params: { q, page_size: 3 } }).catch(() => ({ data: { results: [] } })));
      } else {
        promises.push(Promise.resolve({ data: { results: [] } }));
      }
      promises.push(
        api.get('/api/products/', { params: productParams }).catch(() => ({ data: { results: [] } }))
      );

      Promise.all(promises).then(([profileRes, productRes]) => {
        const profiles = sellerScope ? [] : (profileRes.data.results || profileRes.data || []).map((p: any) => ({ ...p, type: 'account' }));
        const products = (productRes.data.results || []).map((p: any) => ({ ...p, type: 'product' }));
        const sortedProducts = [...products].sort((a: any, b: any) => (b.is_sponsored ? 1 : 0) - (a.is_sponsored ? 1 : 0));
        
        setSuggestions([...profiles, ...sortedProducts]);
        setTotalCount(productRes.data.count ?? (products.length > 0 ? products.length : 0));
        setIsSearching(false);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, category, subcategory, brand, minPrice, maxPrice, condition, sortBy, sellerScope, vehicleId, oemPartNumber, specFilters]);

  const buildQueryString = (overrides?: { category?: string; subcategory?: string; query?: string; clearSeller?: boolean }) => {
    const params = new URLSearchParams();
    const q = overrides?.query !== undefined ? overrides.query : query;
    const cat = overrides?.category !== undefined ? overrides.category : category;
    const subcat = overrides?.subcategory !== undefined ? overrides.subcategory : subcategory;

    if (q.trim()) params.set('q', q.trim());
    if (cat) params.set('category', cat);
    if (subcat) params.set('subcategory', subcat);
    if (brand) params.set('brand', brand);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    if (condition) params.set('condition', condition);
    if (sortBy) params.set('sort_by', sortBy);
    if (vehicleId) params.set('vehicle_id', vehicleId);
    if (oemPartNumber) params.set('oem_part_number', oemPartNumber);
    if (viewMode !== 'grid') params.set('view', viewMode);
    if (sellerScope && !overrides?.clearSeller) params.set('seller', sellerScope.username);
    Object.entries(specFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return params.toString();
  };

  const handleSubmit = (e?: React.FormEvent, overrides?: { category?: string; subcategory?: string; query?: string }) => {
    if (e) e.preventDefault();
    const finalQuery = overrides?.query !== undefined ? overrides.query.trim() : query.trim();
    const finalCat = overrides?.category !== undefined ? overrides.category : category;
    const finalSubCat = overrides?.subcategory !== undefined ? overrides.subcategory : subcategory;
    
    if (!finalQuery && !finalCat && !finalSubCat && !brand && !minPrice && !maxPrice && !condition && !vehicleId && !oemPartNumber && Object.keys(specFilters).length === 0) return;
    
    // Save to recent searches if query was provided
    if (finalQuery) {
      const newSearches = [finalQuery, ...recentSearches.filter(s => s !== finalQuery)].slice(0, 5);
      setRecentSearches(newSearches);
      localStorage.setItem(recentSearchesKey, JSON.stringify(newSearches));
    }

    const qs = buildQueryString(overrides);
    navigate(qs ? `/products?${qs}` : '/products');
    closeSearch();
  };

  const clearFilters = () => {
    setCategory('');
    setSubcategory('');
    setBrand('');
    setMinPrice('');
    setMaxPrice('');
    setCondition('');
    setSortBy('');
    setVehicleId('');
    setOemPartNumber('');
    setSpecFilters({});
  };

  const activeFilterCount = [category, subcategory, brand, minPrice, maxPrice, condition, sortBy, vehicleId, oemPartNumber].filter(Boolean).length + Object.values(specFilters).filter(Boolean).length;

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSearch}
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md pointer-events-auto"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-5xl h-[85vh] max-h-[85dvh] bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-2xl rounded-[24px] shadow-2xl border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col md:flex-row overflow-hidden pointer-events-auto min-h-0"
          >
            {/* Desktop Sidebar Filters */}
            <div className="hidden md:flex flex-col w-[280px] shrink-0 border-r border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-900/20 h-full min-h-0">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-wider text-xs">
                  <Filter className="w-4 h-4" />
                  Filters
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-[10px] text-brand-600 dark:text-brand-500 hover:underline font-bold uppercase tracking-wider">Clear</button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
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
                  {activeRootCategory && activeRootCategory.children && (() => {
                    const availableSubcats = activeRootCategory.children.filter((c: any) => (c.product_count || 0) > 0);
                    if (availableSubcats.length === 0) return null;
                    return (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Subcategory</label>
                        <select 
                          value={subcategory} 
                          onChange={(e) => handleSubCategoryChange(e.target.value)} 
                          className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                        >
                          <option value="">All in {activeRootCategory.name}</option>
                          {availableSubcats.map((c: any) => (
                            <option key={c.slug} value={c.slug}>{c.name}</option>
                          ))}
                        </select>
                      </motion.div>
                    );
                  })()}
                </div>

                {/* Category Brand Filter */}
                {categoryBrands.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Brand</label>
                    <select 
                      value={brand} 
                      onChange={(e) => setBrand(e.target.value)} 
                      className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                    >
                      <option value="">All Brands</option>
                      {categoryBrands.map((b: any) => (
                        <option key={b.slug || b.name} value={b.slug || b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Auto Parts / Vehicle Filters */}
                {(activeRootCategory?.slug?.startsWith('vehicle') || activeRootCategory?.slug === 'vehicles' || activeRootCategory?.slug === 'vehicles-automotive' || activeRootCategory?.slug === 'auto-parts') && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <VehicleSelector 
                      category={category}
                      subcategory={subcategory}
                      onVehicleSelect={setVehicleId} 
                      selectedVehicleId={vehicleId} 
                    />
                    
                    <div className="mt-4 mb-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">OEM Part Number</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 04465-42180" 
                        value={oemPartNumber} 
                        onChange={(e) => setOemPartNumber(e.target.value)} 
                        className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow" 
                      />
                    </div>
                  </motion.div>
                )}

                {/* Dynamic Category Specifications (Desktop) */}
                {specSchema && specSchema.length > 0 && (
                  <div className="space-y-3 pt-1">
                    {specSchema.filter(s => s.filterable !== false).map((spec: any) => (
                      <div key={spec.key}>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">{spec.label}</label>
                        {spec.options && Array.isArray(spec.options) && spec.options.length > 0 ? (
                          <select 
                            value={specFilters[spec.key] || ''} 
                            onChange={(e) => setSpecFilters(prev => ({...prev, [spec.key]: e.target.value}))}
                            className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                          >
                            <option value="">Any {spec.label}</option>
                            {spec.options.map((opt: string) => (
                              <option key={opt} value={opt}>{opt}{spec.unit ? ` ${spec.unit}` : ''}</option>
                            ))}
                          </select>
                        ) : (
                          <input 
                            type={spec.type === 'number' ? 'number' : 'text'} 
                            placeholder={`Enter ${spec.label}`}
                            value={specFilters[spec.key] || ''}
                            onChange={(e) => setSpecFilters(prev => ({...prev, [spec.key]: e.target.value}))}
                            className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
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
                    <option value="used">Used</option>
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
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              <div className="relative border-b border-neutral-100 dark:border-neutral-800/50 z-10 bg-transparent shrink-0">
                <form onSubmit={handleSubmit} className="flex items-center w-full relative">
                  <Search className="absolute left-6 w-6 h-6 text-brand-500" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={sellerScope ? `Search @${sellerScope.username}'s products...` : t('search_placeholder', 'Search products, categories, or brands...')}
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

              {/* Seller Scope Banner */}
              {sellerScope && (
                <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-brand-500/5 dark:bg-brand-500/10 border-b border-brand-500/10 dark:border-brand-500/20 shrink-0">
                  {sellerScope.avatar ? (
                    <img src={sellerScope.avatar} alt={sellerScope.username} className="w-6 h-6 rounded-full object-cover ring-2 ring-brand-500/20" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-500 text-xs font-bold uppercase">
                      {sellerScope.username.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Searching in <span className="font-bold text-brand-500">@{sellerScope.username}</span>'s store
                  </span>
                  <button
                    onClick={() => openSearch()}
                    className="ml-auto text-xs font-bold text-brand-500 hover:underline transition-colors whitespace-nowrap"
                  >
                    Search entire marketplace →
                  </button>
                </div>
              )}

              {/* Mobile Filters Dropdown */}
              <AnimatePresence>
                {showMobileFilters && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="md:hidden border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 shrink-0 overflow-hidden z-0"
                  >
                    <div className="p-4 space-y-4 max-h-[35vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold uppercase text-neutral-500 tracking-wider">Filters</span>
                        {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs text-brand-600 dark:text-brand-500 font-bold">Clear All</button>}
                      </div>
                      
                      <div className="space-y-2">
                        <select value={activeRootCategory ? activeRootCategory.slug : ''} onChange={(e) => handleRootCategoryChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300">
                          <option value="">All Categories</option>
                          {rootCategories.map((c: any) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                        </select>
                        {activeRootCategory && activeRootCategory.children && (() => {
                          const availableSubcats = activeRootCategory.children.filter((c: any) => (c.product_count || 0) > 0);
                          if (availableSubcats.length === 0) return null;
                          return (
                            <select value={subcategory} onChange={(e) => handleSubCategoryChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300">
                              <option value="">All in {activeRootCategory.name}</option>
                              {availableSubcats.map((c: any) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                            </select>
                          );
                        })()}
                        {categoryBrands.length > 0 && (
                          <select 
                            value={brand} 
                            onChange={(e) => setBrand(e.target.value)} 
                            className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300"
                          >
                            <option value="">All Brands</option>
                            {categoryBrands.map((b: any) => (
                              <option key={b.slug || b.name} value={b.slug || b.name}>{b.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Auto Parts / Vehicle Filters (Mobile) */}
                      {(activeRootCategory?.slug?.startsWith('vehicle') || activeRootCategory?.slug === 'vehicles' || activeRootCategory?.slug === 'vehicles-automotive' || activeRootCategory?.slug === 'auto-parts') && (
                        <div className="space-y-3 pt-2">
                          <VehicleSelector 
                            category={category}
                            subcategory={subcategory}
                            onVehicleSelect={setVehicleId} 
                            selectedVehicleId={vehicleId} 
                          />
                          <input 
                            type="text" 
                            placeholder="OEM Part Number (e.g. 04465-42180)" 
                            value={oemPartNumber} 
                            onChange={(e) => setOemPartNumber(e.target.value)} 
                            className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-neutral-300" 
                          />
                        </div>
                      )}


                      <div className="flex items-center gap-2">
                        <input type="number" placeholder="Min Price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none" />
                        <span className="text-neutral-400">-</span>
                        <input type="number" placeholder="Max Price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none" />
                      </div>

                      <div className="flex gap-2">
                        <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none">
                          <option value="">Any Condition</option>
                          <option value="new">New</option>
                          <option value="used">Used</option>
                          <option value="used_good">Used - Good</option>
                          <option value="used_fair">Used - Fair</option>
                        </select>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none">
                          <option value="">Newest</option>
                          <option value="price_asc">Price Low</option>
                          <option value="price_desc">Price High</option>
                        </select>
                      </div>
                      
                      {specSchema && specSchema.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Specifications</span>
                          <div className="grid grid-cols-2 gap-2">
                            {specSchema.filter(s => s.filterable !== false).map((spec: any) => (
                              <div key={spec.key}>
                                {spec.type === 'select' && spec.options ? (
                                  <select 
                                    value={specFilters[spec.key] || ''} 
                                    onChange={(e) => setSpecFilters(prev => ({...prev, [spec.key]: e.target.value}))}
                                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none"
                                  >
                                    <option value="">Any {spec.label}</option>
                                    {spec.options.map((opt: string) => <option key={opt} value={opt}>{opt}{spec.unit ? ` ${spec.unit}` : ''}</option>)}
                                  </select>
                                ) : (
                                  <input 
                                    type={spec.type === 'number' ? 'number' : 'text'} 
                                    placeholder={spec.label}
                                    value={specFilters[spec.key] || ''}
                                    onChange={(e) => setSpecFilters(prev => ({...prev, [spec.key]: e.target.value}))}
                                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 dark:text-white outline-none"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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

              {/* Results Area - Always Scrollable with visible content */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative">
                {(!query.trim() && !category && !subcategory && !minPrice && !maxPrice && !condition && !vehicleId && !oemPartNumber && Object.keys(specFilters).length === 0) ? (
                  // Default State (Recent & Popular)
                  <div className="p-4 sm:p-6 space-y-6">
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Recent Searches</h3>
                          <button onClick={clearRecent} className="text-xs text-brand-600 dark:text-brand-500 hover:underline font-bold">Clear</button>
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
                            onClick={() => { setCategory(cat.slug); setSubcategory(''); handleSubmit(undefined, { category: cat.slug, subcategory: '' }); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-100 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:text-brand-600 dark:hover:text-brand-500 text-sm font-medium transition-colors border border-transparent hover:border-brand-500/30"
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
                          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                            Preview Results {totalCount !== null ? `(${totalCount.toLocaleString()} matching)` : ''}
                          </h3>
                        </div>
                        <div className="space-y-1">
                          {suggestions.map(item => {
                            const isAccount = item.type === 'account';
                            const targetUrl = isAccount ? `/${item.username}` : `/product/${item.slug || item.id}`;
                            const targetState = isAccount ? undefined : {
                              backgroundLocation: location.pathname.startsWith('/product/') ? undefined : location,
                              initialProduct: item
                            };

                            return (
                              <Link
                                key={`${item.type}-${item.id}`}
                                to={targetUrl}
                                state={targetState}
                                onClick={() => closeSearch()}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors text-left group cursor-pointer"
                              >
                                <div className={`w-12 h-12 overflow-hidden shrink-0 flex items-center justify-center ${isAccount ? 'rounded-full ring-2 ring-transparent group-hover:ring-brand-500/20 transition-all' : 'rounded-lg'} bg-neutral-200 dark:bg-neutral-800`}>
                                  {isAccount ? (
                                    item.profile_picture ? (
                                      <SafeImage 
                                        src={item.profile_picture} 
                                        alt={item.username}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full text-brand-500 dark:text-brand-500 flex items-center justify-center font-bold text-lg uppercase">
                                        {item.username.charAt(0)}
                                      </div>
                                    )
                                  ) : (
                                    <SafeImage 
                                      src={item.images?.[0]?.image} 
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {isAccount ? (
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
                                        {item.tier ? item.tier.replace('_', ' ') : 'Account'}
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-bold text-sm text-neutral-900 dark:text-white truncate flex items-center gap-2 group-hover:text-brand-500 dark:group-hover:text-brand-500 transition-colors">
                                        {item.name}
                                        {item.is_sponsored && (
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-brand-500 dark:text-brand-500 bg-brand-500/10">
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
                                  <div className="shrink-0 flex items-center gap-3 pr-2">
                                    <div className="text-right">
                                      <p className="font-bold text-sm text-brand-600 dark:text-brand-400">
                                        {item.price ? Number(item.price).toLocaleString() : 'Negotiable'}
                                        {item.price && <span className="text-[10px] ml-1 font-normal text-neutral-500">TZS</span>}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        addToCart(item);
                                      }}
                                      className="p-2 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 transition-colors"
                                      aria-label="Add to cart"
                                      title="Add to cart"
                                    >
                                      <ShoppingCart className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                                {isAccount && (
                                  <div className="shrink-0 text-right pr-2">
                                    <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[9px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest border border-neutral-200 dark:border-neutral-700/50">
                                      Profile
                                    </span>
                                  </div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
                          <Search className="w-6 h-6 text-neutral-400" />
                        </div>
                        <p className="font-bold text-neutral-900 dark:text-white">No products found</p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-[250px]">
                          {sellerScope 
                            ? `No results in @${sellerScope.username}'s store.`
                            : 'Try adjusting your filters or search keywords to find what you\'re looking for.'
                          }
                        </p>
                        {sellerScope && (
                          <button
                            type="button"
                            onClick={() => openSearch()}
                            className="mt-3 px-4 py-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold text-sm hover:bg-brand-500/20 transition-colors"
                          >
                            Search entire marketplace
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Sticky Submit Button Footer - Clean style without glowing colored shadows */}
              <div className="p-4 border-t border-neutral-100 dark:border-neutral-800/80 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md z-10 shrink-0">
                <button 
                  type="button"
                  onClick={() => handleSubmit()}
                  className="w-full py-3.5 px-4 bg-brand-500 hover:bg-brand-400 text-neutral-950 rounded-xl font-bold text-base shadow-sm active:scale-[0.99] transition-all flex items-center justify-center gap-2 select-none"
                >
                  <Search className="w-5 h-5" />
                  <span>
                    {sellerScope 
                      ? `Search @${sellerScope.username}'s Store` 
                      : totalCount !== null 
                        ? (totalCount > 0 ? `Show ${totalCount.toLocaleString()} Results` : 'No Results Found') 
                        : 'Show Results'} {activeFilterCount > 0 ? `(${activeFilterCount} Filters)` : ''}
                  </span>
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
