import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import api from '../api';

const CategoriesSidebar = ({ defaultExpanded = false, variant = 'card' }: { defaultExpanded?: boolean, variant?: 'card' | 'sidebar' }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const location = useLocation();

  useEffect(() => {
    api.get('/api/categories/')
      .then((r: any) => setCategories(r.data.results || r.data))
      .catch(() => {});
  }, []);

  const topCategories = categories.filter((c: any) => !c.parent);

  if (topCategories.length === 0) return null;

  if (variant === 'sidebar') {
    return (
      <div className="hidden xl:flex flex-col w-64 shrink-0 h-full bg-white dark:bg-[#18191a] border-r border-gray-200 dark:border-neutral-800 overflow-y-auto no-scrollbar">
        <div className="p-4 font-bold text-lg text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800">
          Categories
        </div>
        <div className="p-3 flex flex-col gap-1">
          {topCategories.map((cat: any) => {
            const isActive = location.search.includes(`category=${cat.slug}`);
            return (
              <div key={cat.id} className="flex flex-col">
                <Link
                  to={`/products?category=${cat.slug}`}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-900'
                  }`}
                >
                  {cat.name}
                </Link>
                {isActive && cat.children && cat.children.length > 0 && (
                  <div className="ml-4 pl-2 border-l border-gray-100 dark:border-neutral-800 mt-1 mb-1 flex flex-col gap-1">
                    {cat.children.map((sub: any) => {
                      const isSubActive = location.search.includes(`subcategory=${sub.slug}`);
                      return (
                        <Link
                          key={sub.id}
                          to={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                          className={`px-2 py-1.5 rounded-lg text-xs transition-colors ${
                            isSubActive
                              ? 'text-brand-600 dark:text-brand-400 font-bold'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          {sub.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:block w-64 shrink-0">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-neutral-900 shadow-sm overflow-hidden sticky top-24">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-neutral-900/50 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <span>Categories</span>
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        
        {isExpanded && (
          <div className="p-2 flex flex-col gap-1 max-h-[70vh] overflow-y-auto no-scrollbar">
            {topCategories.map((cat: any) => {
              const isActive = location.search.includes(`category=${cat.slug}`);
              return (
                <div key={cat.id} className="flex flex-col">
                  <Link
                    to={`/products?category=${cat.slug}`}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {cat.name}
                  </Link>
                  {isActive && cat.children && cat.children.length > 0 && (
                    <div className="ml-4 pl-2 border-l border-gray-100 dark:border-neutral-800 mt-1 flex flex-col gap-1">
                      {cat.children.map((sub: any) => {
                        const isSubActive = location.search.includes(`subcategory=${sub.slug}`);
                        return (
                          <Link
                            key={sub.id}
                            to={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                            className={`px-2 py-1.5 rounded-lg text-xs transition-colors ${
                              isSubActive
                                ? 'text-brand-600 dark:text-brand-400 font-bold'
                                : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            {sub.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesSidebar;
