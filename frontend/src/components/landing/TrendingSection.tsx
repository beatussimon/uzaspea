import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Flame, ArrowRight, Zap, Star } from 'lucide-react';
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
      transition: { staggerChildren: 0.1, delayChildren: 0.15 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  const renderProductRow = (products: any[], title: string, icon: React.ReactNode, link: string, metricType: string) => {
    if (!products || products.length === 0) return null;

    return (
      <div className="mb-6 w-full">
        <div className="flex items-center justify-between mb-3 px-4 md:px-8 max-w-7xl mx-auto">
          <motion.div variants={itemVariants} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 dark:text-orange-400">
              {icon}
            </div>
            <h3 className="font-black text-lg md:text-xl text-gray-900 dark:text-white uppercase tracking-tight">{title}</h3>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Link to={link} className="text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-wider flex items-center gap-1 hover:underline">
              {t('view_all', 'View all')} <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>

        <motion.div 
          variants={itemVariants}
          className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 px-4 md:px-8 scrollbar-hide md:grid md:grid-cols-4 md:gap-5 max-w-7xl mx-auto"
        >
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="snap-start shrink-0 w-[260px] sm:w-[280px] md:w-auto">
                <ProductCardSkeleton viewMode="grid" />
              </div>
            ))
          ) : (
            products.slice(0, 4).map((product) => (
              <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px] md:w-auto h-full relative group">
                <ProductCard product={product} viewMode="grid" showTrendingMetrics={metricType} />
              </div>
            ))
          )}
        </motion.div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full bg-surface-muted dark:bg-surface-dark transition-colors duration-300 overflow-hidden flex flex-col justify-center">
      {/* Subtle Dynamic Background Accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-500/5 dark:bg-orange-500/10 blur-[120px]" />
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
            <motion.div variants={itemVariants} className="text-center mb-6 px-4">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center justify-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <Flame className="w-5 h-5" />
                </div>
                {t('trending_now', 'TRENDING NOW')}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Platform's hottest items this week</p>
            </motion.div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-16 flex flex-col justify-center">
              {renderProductRow(
                trendingGroups?.top_sellers || [], 
                t('top_sellers', 'Top Sellers'), 
                <Zap className="w-4 h-4" />, 
                '/products?sort_by=popular',
                'sales'
              )}

              {renderProductRow(
                trendingGroups?.most_saved || [], 
                t('most_saved', 'Most Saved'), 
                <Star className="w-4 h-4" />, 
                '/products?sort_by=most_saved',
                'saves'
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrendingSection;
