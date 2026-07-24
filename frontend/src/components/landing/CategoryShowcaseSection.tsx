import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LayoutGrid, ArrowRight } from 'lucide-react';
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

                  const renderCard = (cat: any) => (
                    <div 
                      key={cat.id} 
                      className="snap-start shrink-0 w-[240px] md:w-[280px] h-[250px] md:h-[300px] relative group rounded-2xl overflow-hidden block shadow-sm border border-surface-border dark:border-surface-dark-border"
                    >
                      <Link to={`/products?category=${cat.slug}`} className="absolute inset-0 w-full h-full">
                        <SafeImage 
                          src={cat.image || getCategoryFallbackImage(cat.name)} 
                          alt={cat.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-85 group-hover:opacity-95 transition-opacity duration-300" />
                        
                        <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-end">
                          <h3 className="text-lg md:text-2xl font-black text-white capitalize group-hover:text-purple-200 transition-colors">
                            {cat.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-purple-300 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 mt-2">
                            <span className="text-sm font-bold uppercase tracking-wider">Explore</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </Link>
                    </div>
                  );

                  return (
                    <motion.div variants={itemVariants} className="flex flex-col gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 w-full">
                      {loading ? (
                        <div className="flex gap-4 w-max">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="snap-start shrink-0 w-[240px] md:w-[280px] h-[250px] md:h-[300px] rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse border border-surface-border dark:border-white/10" />
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
