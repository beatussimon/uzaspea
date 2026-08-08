import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, ArrowRight, Loader2, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { useTranslation } from 'react-i18next';
import api from '../api';
import SafeImage from './SafeImage';

const POPULAR_CATEGORIES = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Vehicles', slug: 'vehicles' },
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Real Estate', slug: 'real-estate' },
];

const GlobalSearchModal: React.FC = () => {
  const { isSearchOpen, closeSearch } = useSearch();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentSearches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  // Save recent search
  const saveRecentSearch = (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;
    try {
      const updated = [q, ...recentSearches.filter(item => item !== q)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    } catch (e) {}
  };

  // Clear recent searches
  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  // Keyboard shortcut to open (Cmd+K / Ctrl+K) handled globally, this handles Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, closeSearch]);

  // Focus input when opened
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setSuggestions([]);
    }
  }, [isSearchOpen]);

  // Debounced API call for predictive search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      api.get('/api/products/', { params: { q, page_size: 4 } })
        .then(res => {
          setSuggestions(res.data.results || []);
          setIsSearching(false);
        })
        .catch(() => {
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query);
      navigate(`/products?q=${encodeURIComponent(query.trim())}`);
      closeSearch();
    }
  };

  const handleSuggestionClick = (product: any) => {
    saveRecentSearch(query);
    navigate(`/product/${product.slug}`);
    closeSearch();
  };

  const handleCategoryClick = (slug: string) => {
    navigate(`/products?category=${slug}`);
    closeSearch();
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    navigate(`/products?q=${encodeURIComponent(term)}`);
    closeSearch();
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-safe sm:pt-[10vh] px-4 pb-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSearch}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[85vh]"
          >
            {/* Search Input Area */}
            <div className="relative border-b border-neutral-200 dark:border-neutral-800">
              <form onSubmit={handleSubmit} className="flex items-center w-full relative">
                <Search className="absolute left-4 w-6 h-6 text-neutral-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search_placeholder', 'Search products, categories, or brands...')}
                  className="w-full h-16 pl-14 pr-16 bg-transparent text-lg font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                    className="absolute right-4 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="absolute right-4 hidden sm:flex items-center gap-1 text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                    <span>ESC</span>
                  </div>
                )}
              </form>
            </div>

            {/* Results Area */}
            <div className="overflow-y-auto no-scrollbar flex-1 pb-4">
              {query.trim() === '' ? (
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
                            onClick={() => handleRecentClick(term)}
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
                      {POPULAR_CATEGORIES.map(cat => (
                        <button
                          key={cat.slug}
                          onClick={() => handleCategoryClick(cat.slug)}
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
                      <h3 className="px-3 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Products</h3>
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
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                {product.category_name}
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
                      
                      <button 
                        onClick={handleSubmit}
                        className="w-full mt-2 p-3 text-sm font-bold text-center text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-colors"
                      >
                        View all results for "{query}"
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-neutral-400" />
                      </div>
                      <p className="font-bold text-neutral-900 dark:text-white">No products found</p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-[250px]">
                        We couldn't find anything matching "{query}". Try different keywords.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GlobalSearchModal;
