import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProductCard from '../ProductCard';
import { ProductCardSkeleton } from '../Skeleton';

interface NewArrivalsSectionProps {
  newArrivals: any[];
  loading?: boolean;
  isActive?: boolean;
}

const NewArrivalsSection: React.FC<NewArrivalsSectionProps> = ({ 
  newArrivals = [], 
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
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 600, damping: 35 }
    }
  };

  return (
    <div className="relative w-full h-full bg-transparent transition-colors duration-300 overflow-hidden flex flex-col justify-center">
      {/* Subtle Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-teal-500/5 dark:bg-teal-500/10 blur-[100px]" />
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
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Clock className="w-4.5 h-4.5" />
                </div>
                {t('new_arrivals', 'NEW ARRIVALS')}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Fresh drops just landed</p>
            </motion.div>

            {/* Content Area - Grid on Desktop / Scroll on Mobile */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-16 px-4 md:px-8 max-w-7xl mx-auto w-full flex flex-col">
              <div className="my-auto w-full flex flex-col">
              {(() => {
                const itemsPerRow = 8;
                const row1 = newArrivals.slice(0, itemsPerRow);
                const row2 = newArrivals.slice(itemsPerRow, itemsPerRow * 2);
                
                return (
                  <motion.div variants={itemVariants} className="flex flex-col gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 w-full">
                    {loading ? (
                      <div className="flex gap-4 w-max">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="snap-start shrink-0 w-[260px] sm:w-[280px] h-full">
                            <ProductCardSkeleton viewMode="grid" />
                          </div>
                        ))}
                      </div>
                    ) : newArrivals.length > 0 ? (
                      <>
                                                <div className="flex gap-4 w-max">
                          {row1.map((product, idx) => (
                            <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px] h-full relative">
                              <ProductCard product={product} viewMode="grid" showTrendingMetrics="new" isTopFold={idx < 4} />
                            </div>
                          ))}
                        </div>
                        {row2.length > 0 && (
                          <div className="flex gap-4 w-max">
                            {row2.map((product) => (
                              <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px] h-full relative">
                                <ProductCard product={product} viewMode="grid" showTrendingMetrics="new" isTopFold={false} />
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="col-span-full w-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 py-12">
                        <Clock className="w-10 h-10 mb-2 opacity-50 text-emerald-500" />
                        <p className="text-sm font-semibold">No new arrivals right now</p>
                      </div>
                    )}
                  </motion.div>
                );
              })()}

              {/* Bottom CTA */}
              <motion.div variants={itemVariants} className="mt-8 flex justify-center">
                <Link 
                  to="/products?sort_by=newest"
                  className="text-brand-500 dark:text-brand-500 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:underline"
                >
                  Explore All New Arrivals <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NewArrivalsSection;
