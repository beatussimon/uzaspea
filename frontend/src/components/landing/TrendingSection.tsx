import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProductCard from '../ProductCard';
import { ProductCardSkeleton } from '../Skeleton';

interface TrendingSectionProps {
  trendingGroups?: {
    top_sellers: any[];
    most_saved: any[];
  };
  loading?: boolean;
  isActive?: boolean;
}

const TrendingSection: React.FC<TrendingSectionProps> = ({ 
  trendingGroups, 
  loading = false,
  isActive = false
}) => {
  const { t } = useTranslation();

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
        <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] rounded-full   blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/5 dark:bg-amber-500/10 blur-[120px]" />
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div 
            className="relative z-10 w-full h-full pt-16 md:pt-20 flex flex-col justify-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {/* Standardized Header */}
            <motion.div variants={itemVariants} className="text-center mb-6 px-4 flex-shrink-0">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center justify-center gap-2.5">
                <div className="w-8 h-8 rounded-full   flex items-center justify-center text-orange-500 dark:text-orange-500">
                  <Flame className="w-5 h-5" />
                </div>
                {t('trending_now', 'TRENDING NOW')}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Platform's hottest items this week</p>
            </motion.div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-16 px-4 md:px-8 max-w-7xl mx-auto w-full flex flex-col">
              <div className="my-auto w-full flex flex-col">
              {(() => {
                const row1 = (trendingGroups?.top_sellers || []).slice(0, 8);
                const row2 = (trendingGroups?.most_saved || []).slice(0, 8);
                
                return (
                  <motion.div variants={itemVariants} className="flex flex-col gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 w-full">
                    {loading ? (
                      <div className="flex gap-4 w-max">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="snap-start shrink-0 w-[260px] sm:w-[280px] h-full relative">
                            <ProductCardSkeleton viewMode="grid" />
                          </div>
                        ))}
                      </div>
                    ) : (row1.length > 0 || row2.length > 0) ? (
                      <>
                        {row1.length > 0 && (
                          <div className="flex gap-4 w-max">
                            {row1.map((product) => (
                              <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px] h-full relative">
                                <ProductCard product={product} viewMode="grid" showTrendingMetrics="sales" />
                              </div>
                            ))}
                          </div>
                        )}
                        {row2.length > 0 && (
                          <div className="flex gap-4 w-max">
                            {row2.map((product) => (
                              <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px] h-full relative">
                                <ProductCard product={product} viewMode="grid" showTrendingMetrics="saves" />
                              </div>
                            ))}
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

export default TrendingSection;
