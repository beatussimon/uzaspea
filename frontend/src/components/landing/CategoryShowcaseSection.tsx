import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
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
            <motion.div variants={itemVariants} className="mb-4 sm:mb-6 shrink-0 flex flex-col items-center justify-center text-center w-full">
              <h2 className="text-2xl md:text-3xl font-black text-white leading-none drop-shadow-md">
                {t('shop_by_category', 'Shop by category')}
              </h2>
              <p className="text-xs md:text-sm font-medium text-gray-300 mt-1">
                {t('find_exactly_what_youre_looking_for', "Find exactly what you're looking for")}
              </p>
            </motion.div>

            {/* Circular Category Showcase - Centered responsive flex wrap */}
            <div className="w-full flex-1 flex flex-col justify-center items-center overflow-y-auto overscroll-contain no-scrollbar py-2 px-2">
              <div className="w-full flex flex-wrap justify-center items-start gap-5 sm:gap-7 md:gap-9 max-w-4xl mx-auto pb-4">
                {loading ? (
                  [...Array(7)].map((_, i) => (
                    <div key={i} className="w-[96px] sm:w-[112px] md:w-[128px] flex flex-col items-center gap-2.5">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 rounded-full bg-white/10 animate-pulse" />
                      <div className="w-16 h-3 bg-white/10 animate-pulse rounded-full" />
                    </div>
                  ))
                ) : (
                  categories.map((cat) => (
                    <motion.div 
                      key={cat.id} 
                      variants={itemVariants} 
                      className="w-[96px] sm:w-[112px] md:w-[128px] flex flex-col items-center gap-2 group text-center"
                    >
                      <Link 
                        to={`/products?category=${cat.slug}`} 
                        className="w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 rounded-full relative overflow-hidden bg-black/40 border-2 border-white/20 hover:border-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.45)] transition-all duration-300 group-hover:scale-105 active:scale-95 shrink-0 shadow-lg shadow-black/50"
                      >
                        <SafeImage 
                          src={cat.image || getCategoryFallbackImage(cat.name)} 
                          alt={cat.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent group-hover:from-black/10 transition-colors duration-300" />
                      </Link>
                      
                      <Link 
                        to={`/products?category=${cat.slug}`}
                        className="text-xs sm:text-sm font-bold text-white text-center line-clamp-2 leading-tight group-hover:text-amber-400 transition-colors mt-0.5 drop-shadow"
                      >
                        {cat.name}
                      </Link>

                      {cat.total_products !== undefined && cat.total_products > 0 && (
                        <span className="text-[10px] font-semibold text-gray-400 group-hover:text-amber-300/90 transition-colors">
                          {cat.total_products.toLocaleString()} {cat.total_products === 1 ? t('item', 'item') : t('items_count', 'items')}
                        </span>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </div>
            
            {/* Scroll indicator for the redirect section */}
            <div className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex justify-center w-full z-20 pointer-events-none pt-4 pb-2">
              <motion.div variants={itemVariants} className="flex flex-col items-center justify-center opacity-80 pointer-events-auto">
                <span className="text-[11px] tracking-wider text-gray-400 font-medium mb-0.5 drop-shadow">
                  {t('scroll_for_products', 'Scroll for products')}
                </span>
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
