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
        setCategories(allCats.slice(0, 6));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.15 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 200, damping: 20 }
    }
  };

  // Bento grid layouts for the 6 items
  const gridClasses = [
    "col-span-2 row-span-2 md:col-span-2 md:row-span-2",
    "col-span-2 row-span-1 md:col-span-1 md:row-span-1",
    "col-span-1 row-span-1",
    "col-span-1 row-span-1",
    "col-span-2 row-span-1 md:col-span-1 md:row-span-2",
    "col-span-2 row-span-1 md:col-span-1 md:row-span-1"
  ];

  return (
    <div className="relative w-full h-full bg-surface-muted dark:bg-surface-dark transition-colors duration-300 overflow-hidden flex flex-col justify-center">
      {/* Subtle Dynamic Background Accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 dark:bg-purple-500/10 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[100px]" />
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div 
            className="relative z-10 w-full h-full pt-16 md:pt-20 pb-16 px-4 md:px-8 max-w-7xl mx-auto flex flex-col justify-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {/* Standardized Header */}
            <motion.div variants={itemVariants} className="text-center mb-6 flex-shrink-0">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center justify-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <LayoutGrid className="w-4.5 h-4.5" />
                </div>
                {t('shop_by_category', 'SHOP BY CATEGORY')}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Find exactly what you're looking for</p>
            </motion.div>

            {/* Content Area - Bento Grid */}
            <div className="flex-1 w-full flex items-center justify-center max-h-[520px]">
              {loading ? (
                <div className="w-full h-full grid grid-cols-2 md:grid-cols-4 grid-rows-4 md:grid-rows-3 gap-3 md:gap-4">
                  {[...Array(6)].map((_, i) => (
                    <motion.div key={i} variants={itemVariants} className={`${gridClasses[i]} rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse border border-surface-border dark:border-white/10`} />
                  ))}
                </div>
              ) : categories.length > 0 ? (
                <div className="w-full h-full grid grid-cols-2 md:grid-cols-4 grid-rows-4 md:grid-rows-3 gap-3 md:gap-4">
                  {categories.map((cat, i) => (
                    <motion.div 
                      key={cat.id} 
                      variants={itemVariants} 
                      className={`${gridClasses[i]} relative group rounded-2xl overflow-hidden block shadow-sm border border-surface-border dark:border-surface-dark-border`}
                    >
                      <Link to={`/products?category=${cat.slug}`} className="absolute inset-0 w-full h-full">
                        <SafeImage 
                          src={cat.image || getCategoryFallbackImage(cat.name)} 
                          alt={cat.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-85 group-hover:opacity-95 transition-opacity duration-300" />
                        
                        <div className="absolute inset-0 p-3 md:p-5 flex flex-col justify-end">
                          <h3 className="text-base md:text-xl font-black text-white capitalize group-hover:text-purple-200 transition-colors">
                            {cat.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-purple-300 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 mt-1">
                            <span className="text-xs font-bold uppercase tracking-wider">Explore</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryShowcaseSection;
