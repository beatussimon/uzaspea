import React, { useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Star, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProductCard from '../ProductCard';
import { ProductCardSkeleton } from '../Skeleton';

interface FeaturedSectionProps {
  promotions: any[];
  loading?: boolean;
  isActive?: boolean;
}

const FeaturedSection: React.FC<FeaturedSectionProps> = ({ 
  promotions = [], 
  loading = false,
  isActive = false
}) => {
  const { t } = useTranslation();

  // Pick up to 16 promoted products
  const featuredProducts = useMemo(() => {
    return promotions.map(p => p.product_details).slice(0, 16);
  }, [promotions]);



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
      {/* Subtle Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/5 dark:bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-yellow-500/5 dark:bg-yellow-500/10 blur-[120px]" />
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
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Star className="w-4.5 h-4.5 fill-amber-500" />
                </div>
                {t('featured', 'FEATURED LISTINGS')}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Sponsored & Premium Listings</p>
            </motion.div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-16 px-4 md:px-8 max-w-7xl mx-auto w-full flex flex-col">
              <div className="my-auto w-full flex flex-col">
              {(() => {
                const itemsPerRow = 8;
                const row1 = featuredProducts.slice(0, itemsPerRow);
                const row2 = featuredProducts.slice(itemsPerRow, itemsPerRow * 2);
                
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
                    ) : featuredProducts.length > 0 ? (
                      <>
                        <div className="flex gap-4 w-max">
                          {row1.map((product) => (
                            <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px] h-full relative">
                              <ProductCard product={product} viewMode="grid" isSponsored={true} />
                            </div>
                          ))}
                        </div>
                        {row2.length > 0 && (
                          <div className="flex gap-4 w-max">
                            {row2.map((product) => (
                              <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px] h-full relative">
                                <ProductCard product={product} viewMode="grid" isSponsored={true} />
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500 w-full h-full">
                        <Star className="w-10 h-10 mb-2 opacity-50 text-amber-500" />
                        <p className="text-sm font-semibold">No featured items right now</p>
                      </div>
                    )}
                  </motion.div>
                );
              })()}

              {/* Bottom CTA */}
              <motion.div variants={itemVariants} className="mt-8 flex justify-center">
                <Link 
                  to="/products" 
                  className="text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:underline"
                >
                  Explore All Products <ArrowRight className="w-4 h-4" />
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

export default FeaturedSection;
