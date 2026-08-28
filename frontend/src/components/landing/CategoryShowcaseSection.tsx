import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LayoutGrid, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SafeImage from '../SafeImage';
import { getCategoryFallbackImage } from '../../utils/categoryFallbacks';
import api from '../../api';
import { apiCache } from '../../utils/apiCache';

import { ensureArray } from '../../utils/arrayUtils';

interface CategoryShowcaseSectionProps {
  isActive?: boolean;
}

const CategoryShowcaseSection: React.FC<CategoryShowcaseSectionProps> = ({ 
  isActive = false
}) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>(() => {
    const cached = apiCache.get<any>('categories:all');
    return cached ? ensureArray(cached.data) : [];
  });
  const [loading, setLoading] = useState(!categories.length);

  useEffect(() => {
    if (categories.length > 0) return; // Skip if already loaded from cache
    api.get('/api/categories/')
      .then((res) => {
        apiCache.set('categories:all', res.data);
        const allCats = ensureArray(res.data);
        if (allCats.length === 0) {
          setLoading(false);
          return;
        }
        
        const getDeepCount = (cat: any): number => {
          let count = cat.product_count || 0;
          if (cat.children && Array.isArray(cat.children)) {
            cat.children.forEach((child: any) => {
              count += getDeepCount(child);
            });
          }
          return count;
        };

        const filtered = allCats
          .filter((c: any) => !c.parent)
          .map((c: any) => ({ ...c, total_products: getDeepCount(c) }))
          .filter((c: any) => c.total_products > 0)
          .sort((a: any, b: any) => b.total_products - a.total_products);

        setCategories(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [categories.length]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.05 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8, y: 15 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 400, damping: 25 }
    }
  };

  return (
    <div className="relative w-full h-[100dvh] bg-transparent overflow-hidden flex flex-col justify-start">
      {/* Subtle Dynamic Background Accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full blur-[100px]" />
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div 
            className="relative z-10 w-full h-full pt-16 md:pt-20 pb-20 md:pb-24 flex flex-col items-center justify-start max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {/* Header */}
            <motion.div variants={itemVariants} className="mb-4 sm:mb-6 shrink-0 flex justify-center w-full">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-purple-500 dark:text-purple-500 shrink-0 shadow-sm">
                  <LayoutGrid className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-gray-900 dark:text-white leading-none">
                    {t('shop_by_category', 'SHOP BY CATEGORY')}
                  </h2>
                  <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                    {t('find_exactly_what_youre_looking_for', 'Find exactly what you\'re looking for')}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Circular Category Grid - Scrollable with mouse wheel & touch */}
            <div className="w-full flex-1 overflow-y-auto overscroll-contain no-scrollbar py-2 px-2">
              <div className="w-full grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-6 md:gap-8 auto-rows-max justify-items-center pb-12">
                {loading ? (
                  [...Array(12)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-3 w-full">
                      <div className="w-18 h-18 sm:w-22 sm:h-22 md:w-24 md:h-24 rounded-full bg-gray-200 dark:bg-white/5 animate-pulse" />
                      <div className="w-16 h-3 bg-gray-200 dark:bg-white/5 animate-pulse rounded-full" />
                    </div>
                  ))
                ) : (
                  categories.map((cat) => (
                    <motion.div key={cat.id} variants={itemVariants} className="w-full flex flex-col items-center gap-2 group">
                      <Link 
                        to={`/products?category=${cat.slug}`} 
                        className="w-18 h-18 sm:w-22 sm:h-22 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full relative overflow-hidden bg-gray-100 dark:bg-gray-800/50 border-2 sm:border-4 border-transparent hover:border-brand-500 hover:shadow-[0_0_20px_rgba(var(--color-brand-500),0.3)] transition-all duration-300 active:scale-95 shrink-0"
                      >
                        <SafeImage 
                          src={cat.image || getCategoryFallbackImage(cat.name)} 
                          alt={cat.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300" />
                      </Link>
                      
                      <Link 
                        to={`/products?category=${cat.slug}`}
                        className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 text-center line-clamp-2 leading-tight group-hover:text-brand-500 dark:group-hover:text-brand-500 transition-colors mt-1"
                      >
                        {cat.name}
                      </Link>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
            
            {/* Scroll indicator for the redirect section with subtle gradient backdrop */}
            <div className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex justify-center w-full z-20 pointer-events-none bg-gradient-to-t from-black/40 via-black/20 to-transparent pt-4 pb-2">
              <motion.div variants={itemVariants} className="flex flex-col items-center justify-center opacity-80 pointer-events-auto">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-0.5 drop-shadow">Scroll for Products</span>
                <div 
                  className="animate-float cursor-pointer"
                  onClick={() => {
                    document.getElementById('redirect')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <ChevronDown className="h-7 w-7 md:h-8 md:w-8 text-gray-300 hover:text-white transition-colors drop-shadow-md" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryShowcaseSection;
