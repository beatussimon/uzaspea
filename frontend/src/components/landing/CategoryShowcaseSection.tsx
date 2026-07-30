import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
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
        // Ensure we only show top-level categories or limit to a reasonable number if too many
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
    hidden: { opacity: 0, scale: 0.8, y: 15 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 400, damping: 25 }
    }
  };

  return (
    <div className="relative w-full h-[100dvh] bg-transparent overflow-hidden flex flex-col justify-center">
      {/* Subtle Dynamic Background Accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 dark:bg-purple-500/10 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[100px]" />
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div 
            className="relative z-10 w-full h-full pt-20 pb-10 flex flex-col items-center justify-center max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {/* Header */}
            <motion.div variants={itemVariants} className="mb-10 flex-shrink-0 flex justify-center w-full">
              <div className="flex items-center gap-4 md:gap-5">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 shadow-sm">
                  <LayoutGrid className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-black uppercase tracking-tight text-gray-900 dark:text-white leading-none">
                    {t('shop_by_category', 'SHOP BY CATEGORY')}
                  </h2>
                  <p className="text-sm md:text-base lg:text-lg font-medium text-gray-500 dark:text-gray-400 mt-1.5 md:mt-2">
                    {t('find_exactly_what_youre_looking_for', 'Find exactly what you\'re looking for')}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Circular Category Grid */}
            <div className="w-full flex-1 flex items-center justify-center overflow-y-auto no-scrollbar pb-10">
              <div className="w-full grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6 md:gap-10 auto-rows-max justify-items-center">
                {loading ? (
                  [...Array(12)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-3 w-full">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gray-200 dark:bg-white/5 animate-pulse" />
                      <div className="w-16 h-3 bg-gray-200 dark:bg-white/5 animate-pulse rounded-full" />
                    </div>
                  ))
                ) : (
                  categories.map((cat) => (
                    <motion.div key={cat.id} variants={itemVariants} className="w-full flex flex-col items-center gap-3 group">
                      <Link 
                        to={`/products?category=${cat.slug}`} 
                        className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full relative overflow-hidden bg-gray-100 dark:bg-gray-800/50 border-4 border-transparent hover:border-brand-500 hover:shadow-[0_0_20px_rgba(var(--color-brand-500),0.3)] transition-all duration-300 active:scale-95"
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
                        className="text-xs sm:text-sm md:text-base font-bold text-gray-800 dark:text-gray-200 text-center line-clamp-2 leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
                      >
                        {cat.name}
                      </Link>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
            
            {/* Scroll indicator for the redirect section */}
            <motion.div variants={itemVariants} className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center opacity-50">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Scroll for Products</span>
              <div className="w-1 h-6 bg-gradient-to-b from-gray-400 to-transparent rounded-full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryShowcaseSection;
