import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LayoutGrid, Flame, ShoppingBag, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SafeImage from '../SafeImage';
import { getCategoryFallbackImage } from '../../utils/categoryFallbacks';
import api from '../../api';

interface CategoryShowcaseSectionProps {
  isActive?: boolean;
}

const CategoryShowcaseSection: React.FC<CategoryShowcaseSectionProps> = ({ 
  isActive = false
}) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/categories/')
      .then((res) => {
        const allCats = res.data.results || res.data;
        setCategories(allCats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.05 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.98, y: 15 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 600, damping: 35 }
    }
  };



  return (
    <div className="relative w-full h-full bg-transparent transition-colors duration-300 overflow-hidden flex flex-col justify-center">
      {/* Subtle Dynamic Background Accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 dark:bg-purple-500/10 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[100px]" />
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div 
            className="relative z-10 w-full h-full pt-16 md:pt-20 pb-16 flex flex-col justify-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {/* Standardized Header */}
            <motion.div variants={itemVariants} className="text-center mb-6 flex-shrink-0 px-4 md:px-8">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center justify-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <LayoutGrid className="w-4.5 h-4.5" />
                </div>
                {t('shop_by_category', 'SHOP BY CATEGORY')}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Find exactly what you're looking for</p>
            </motion.div>

            {/* Content Area - Sliding List */}
            <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col items-center justify-start overflow-y-auto no-scrollbar px-4 md:px-8">
              <div className="my-auto w-full flex flex-col">
                {(() => {
                  const itemsPerRow = 8;
                  const row1 = categories.slice(0, itemsPerRow);
                  const row2 = categories.slice(itemsPerRow, itemsPerRow * 2);

                  const renderCard = (cat: any) => {
                    const sales = cat.total_sales || 0;
                    const saves = cat.total_saves || 0;
                    
                    return (
                      <div 
                        key={cat.id} 
                        className="snap-start shrink-0 w-[260px] sm:w-[280px] h-[320px] relative"
                      >
                        <div className="group relative card overflow-hidden flex flex-col h-full w-full bg-white dark:bg-[#0A0A0A] border-2 border-surface-border dark:border-surface-dark-border hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-card-hover active:scale-95 transition-all duration-75">
                          <Link to={`/products?category=${cat.slug}`} className="relative flex-1 flex flex-col h-full w-full">
                            
                            <div className="absolute inset-0 w-full h-full bg-gray-100 dark:bg-gray-800/50 overflow-hidden">
                              <SafeImage 
                                src={cat.image || getCategoryFallbackImage(cat.name)} 
                                alt={cat.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                              {/* Gradient to make text readable */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                            </div>

                            {/* Top-left Badges */}
                            <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10 pointer-events-none">
                              {cat.product_count > 5 && (
                                <div className="flex items-center gap-1 text-[8.5px] font-black bg-neutral-900/90 text-white backdrop-blur-md px-2 py-0.5 rounded-card border border-orange-500/40 shadow-md uppercase tracking-wider w-fit">
                                  <Flame size={10} className="shrink-0 text-orange-400" />
                                  <span>{t('hot_category', 'HOT CATEGORY')}</span>
                                </div>
                              )}
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-2.5 flex flex-col gap-1.5 z-10 bg-transparent">
                              {/* Badges row */}
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-brand-600 dark:text-brand-400 bg-brand-50/80 dark:bg-brand-900/30 backdrop-blur-md px-1.5 py-0.5 rounded-card text-[8.5px] uppercase font-bold tracking-wider whitespace-nowrap shrink-0 border border-brand-200/20 dark:border-brand-500/10 shadow-sm">
                                  {t('explore_category', 'Explore Category')}
                                </span>
                              </div>

                              {/* Category Name Bubble */}
                              <div className="w-fit max-w-full px-3 py-1.5 rounded-card bg-white/70 dark:bg-[#0A0A0A]/70 backdrop-blur-md border border-white/20 dark:border-white/5 shadow-sm">
                                <h3 className="font-black text-xl md:text-2xl text-gray-900 dark:text-white line-clamp-1 transition-colors capitalize">
                                  {cat.name}
                                </h3>
                              </div>
                              
                              {/* Stats Bubbles */}
                              <div className="flex items-center gap-1 w-full overflow-x-auto no-scrollbar pb-1">
                                {/* Items Bubble */}
                                <div className="flex items-center gap-0.5 text-[8.5px] text-gray-800 dark:text-gray-200 bg-white/90 dark:bg-black/95 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-card px-1.5 py-0.5 shadow-sm shrink-0 font-bold">
                                  <LayoutGrid size={8} strokeWidth={2.5} className="shrink-0 text-brand-500 dark:text-brand-400" />
                                  <span className="truncate">{cat.product_count || 0} {t('items', 'Items')}</span>
                                </div>

                                {/* Sales Bubble */}
                                <div className="flex items-center gap-0.5 text-[8.5px] text-gray-800 dark:text-gray-200 bg-white/90 dark:bg-black/95 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-card px-1.5 py-0.5 shadow-sm shrink-0 font-bold">
                                  <ShoppingBag size={8} strokeWidth={2.5} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
                                  <span className="truncate">{sales.toLocaleString()} {t('sold', 'Sold')}</span>
                                </div>

                                {/* Saves Bubble */}
                                <div className="flex items-center gap-0.5 text-[8.5px] text-gray-800 dark:text-gray-200 bg-white/90 dark:bg-black/95 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-card px-1.5 py-0.5 shadow-sm shrink-0 font-bold">
                                  <Heart size={8} strokeWidth={2.5} className="shrink-0 text-red-500 dark:text-red-400" />
                                  <span className="truncate">{saves.toLocaleString()} {t('saved', 'Saved')}</span>
                                </div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <motion.div variants={itemVariants} className="flex flex-col gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 w-full">
                      {loading ? (
                        <div className="flex gap-4 w-max">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="snap-start shrink-0 w-[260px] sm:w-[280px] h-[320px] rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse border border-surface-border dark:border-white/10" />
                          ))}
                        </div>
                      ) : categories.length > 0 ? (
                        <>
                          <div className="flex gap-4 w-max">
                            {row1.map(renderCard)}
                          </div>
                          {row2.length > 0 && (
                            <div className="flex gap-4 w-max">
                              {row2.map(renderCard)}
                            </div>
                          )}
                        </>
                      ) : null}
                    </motion.div>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryShowcaseSection;
