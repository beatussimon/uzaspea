import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Activity, Users, ShoppingBag, TrendingUp, ArrowRight, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InsightsSectionProps {
  stats?: any;
  isActive?: boolean;
}

const AnimatedCounter = ({ from = 0, to, duration = 2, isActive }: { from?: number, to: number, duration?: number, isActive: boolean }) => {
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!isActive) {
      setCount(from);
      return;
    }

    let startTime: number | null = null;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
      
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(easeProgress * (to - from) + from));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [from, to, duration, isActive]);

  return <>{count.toLocaleString()}</>;
};

const InsightsSection: React.FC<InsightsSectionProps> = ({ 
  stats,
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

  // Strictly real stats from backend API
  const displayStats = {
    active_users: stats?.active_users ?? 0,
    products_sold: stats?.products_sold ?? 0,
    weekly_visits: stats?.weekly_visits ?? 0,
    hot_categories: stats?.hot_categories ?? 0
  };

  return (
    <div className="relative w-full h-full bg-transparent transition-colors duration-300 overflow-hidden flex flex-col justify-center">
      {/* Subtle Dynamic Background Accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-[150px]" />
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div 
            className="relative z-10 w-full h-full pt-16 md:pt-20 pb-16 px-4 md:px-8 max-w-7xl mx-auto flex flex-col justify-center items-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {/* Standardized Header */}
            <motion.div variants={itemVariants} className="text-center mb-8 flex-shrink-0">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center justify-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Activity className="w-4.5 h-4.5" />
                </div>
                {t('platform_insights', 'PLATFORM INSIGHTS')}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 max-w-xl mx-auto">
                Join Tanzania's fastest growing marketplace. Buy confidently from verified sellers.
              </p>
            </motion.div>

            {/* Stats Grid */}
            <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-8">
              {[
                { label: 'Active Users', value: displayStats.active_users, icon: <Users className="w-5 h-5" />, color: 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' },
                { label: 'Products Sold', value: displayStats.products_sold, icon: <ShoppingBag className="w-5 h-5" />, color: 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400' },
                { label: 'Weekly Visits', value: displayStats.weekly_visits, icon: <TrendingUp className="w-5 h-5" />, color: 'bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400' },
                { label: 'Hot Categories', value: displayStats.hot_categories, icon: <Activity className="w-5 h-5" />, color: 'bg-fuchsia-100 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400' },
              ].map((stat, i) => (
                <div 
                  key={i} 
                  className="card p-4 md:p-6 flex flex-col items-center text-center relative overflow-hidden group"
                >
                  <div className={`w-10 h-10 rounded-full ${stat.color} flex items-center justify-center mb-3 shadow-sm transform group-hover:scale-110 transition-transform duration-200`}>
                    {stat.icon}
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">
                    <AnimatedCounter to={stat.value} isActive={isActive} />+
                  </div>
                  <div className="text-2xs sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Trust Row & CTA */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-center">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/40 px-4 py-2 rounded-full border border-emerald-200 dark:border-emerald-900/50">
                <ShieldCheck className="w-4.5 h-4.5" />
                <span className="font-bold text-xs sm:text-sm">100% Verified Sellers</span>
              </div>
              
              <Link 
                to="/products" 
                className="btn-primary px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all"
              >
                Start Shopping <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InsightsSection;
