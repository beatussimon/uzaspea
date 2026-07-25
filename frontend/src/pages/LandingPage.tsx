import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useVelocity, useSpring, useTransform } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import api from '../api';
import VerifiedBadge from '../components/VerifiedBadge';
import { useTheme } from '../context/ThemeContext';

// Snap Sections
import SnapScrollContainer from '../components/landing/SnapScrollContainer';
import TrendingSection from '../components/landing/TrendingSection';
import FeaturedSection from '../components/landing/FeaturedSection';
import NewArrivalsSection from '../components/landing/NewArrivalsSection';
import CategoryShowcaseSection from '../components/landing/CategoryShowcaseSection';
import InsightsSection from '../components/landing/InsightsSection';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useTranslation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [promotions, setPromotions] = useState<any[]>([]);
  const [newArrivals, setNewArrivals] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [trendingGroups, setTrendingGroups] = useState<any>(null);
  
  const [loadingPromotions, setLoadingPromotions] = useState(true);
  const [loadingNew, setLoadingNew] = useState(true);

  // Framer motion values for the drag-to-wiggle effect
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);
  const dragVelocity = useVelocity(dragX);
  const smoothVelocity = useSpring(dragVelocity, { damping: 50, stiffness: 400 });
  const rotateForm = useTransform(smoothVelocity, [-1000, 0, 1000], [-1, 0, 1]);
  const skewForm = useTransform(smoothVelocity, [-1000, 0, 1000], [2, 0, -2]);

  const lightHero = '/kariakoo_daytime.webp?v=3';
  const darkHero = '/kariakoo_nightscape.webp?v=3';
  const currentHero = isDark ? darkHero : lightHero;

  useEffect(() => {
    // Preload hero images
    [lightHero, darkHero].forEach(src => {
      const img = new Image();
      img.src = src;
    });

    // Fetch stats & trending
    api.get('/api/analytics/trending/')
      .then(res => {
        setStats(res.data.stats);
        setTrendingGroups(res.data.trending_products || { top_sellers: [], most_saved: [], newest_trending: [] });
      })
      .catch(() => {
        setTrendingGroups({ top_sellers: [], most_saved: [], newest_trending: [] });
      });

    // Fetch promotions
    api.get('/api/sponsored/?public=true&page_size=16')
      .then(promoRes => {
        const promoData = Array.isArray(promoRes.data.results || promoRes.data) 
          ? (promoRes.data.results || promoRes.data) : [];
        setPromotions(promoData);
        setLoadingPromotions(false);
      })
      .catch(() => setLoadingPromotions(false));

    // Fetch new arrivals (latest products)
    api.get('/api/products/?page_size=16&sort_by=newest')
      .then(prodRes => {
        const prodData = Array.isArray(prodRes.data.results || prodRes.data) 
          ? (prodRes.data.results || prodRes.data) : [];
        setNewArrivals(prodData);
        setLoadingNew(false);
      })
      .catch(() => setLoadingNew(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/products');
    }
  };

  const sections = [
    { id: 'hero', label: 'Home' },
    { id: 'categories', label: 'Categories' },
    { id: 'trending', label: 'Trending' },
    { id: 'featured', label: 'Featured' },
    { id: 'new-arrivals', label: 'New Arrivals' },
    { id: 'insights', label: 'Insights' }
  ];
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const progress = target.scrollTop / (window.innerHeight || 800);
    setScrollProgress(Math.min(progress, 1));
  };

  return (
    <>
      {/* Global Fixed Background */}
      <div className="fixed inset-0 z-0 overflow-hidden flex pointer-events-none bg-black">
        <div 
          className="absolute inset-[-5%] w-[110%] h-[110%]"
          style={{ filter: `blur(${scrollProgress * 10}px)` }}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={currentHero}
              src={currentHero}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="h-full w-full object-cover brightness-[0.6] dark:brightness-[0.35] max-w-none"
              alt="Global background"
            />
          </AnimatePresence>
        </div>
        
        {/* Dark Mode Overlay */}
        <div className="absolute inset-0 bg-black/10 dark:bg-transparent pointer-events-none"></div>
      </div>

      <SnapScrollContainer sections={sections} onScroll={handleScroll}>
        {/* 1. HERO SECTION */}
        <div className="relative w-full h-full flex flex-col justify-center overflow-hidden group">
          <div className="absolute inset-0 z-0 overflow-hidden flex cursor-grab active:cursor-grabbing" ref={constraintsRef}>
            {/* Draggable surface for wobble effect, background is now global */}
          </div>

          <div className="relative z-10 w-full max-w-4xl px-10 sm:px-14 md:px-16 mx-auto text-center pointer-events-none pt-20">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 drop-shadow-xl tracking-tight leading-tight origin-center flex flex-col items-center justify-center">
            <span className="inline-block text-white">
              <Trans i18nKey="hero_title_main">
                Buy <span className="text-yellow-400">confidently</span> new and used items in <span className="text-yellow-400">Tanzania</span>
              </Trans>
            </span>
          </h1>
          <div className="flex items-center justify-center gap-2 mb-8 text-white/90 text-base md:text-lg font-medium drop-shadow-md">
            <span>{t('all_sellers_verified', 'All sellers on this platform are verified')}</span>
            <VerifiedBadge tier="seller_pro" isVerified={true} className="w-7 h-7 md:w-9 md:h-9" />
            <VerifiedBadge tier="business" isVerified={true} className="w-7 h-7 md:w-9 md:h-9" />
          </div>

          <motion.div 
            style={{ rotate: rotateForm, skewX: skewForm }}
            className="bg-white/95 dark:bg-black/90 p-2 rounded-full shadow-2xl flex flex-col md:flex-row gap-2 max-w-2xl mx-auto border-4 border-white/10 backdrop-blur-md pointer-events-auto origin-center"
          >
            <form onSubmit={handleSearch} className="flex-1 flex relative w-full">
              <input
                type="text"
                placeholder={t('search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-6 pr-14 py-3 bg-transparent text-gray-900 dark:text-white focus:outline-none font-bold text-base md:text-lg rounded-full"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-gray-400 hover:text-brand-600 transition-colors"
                aria-label="Search"
              >
                <Search className="h-6 w-6" />
              </button>
            </form>
          </motion.div>

          {stats && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.5 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-white/90 drop-shadow-md tracking-wide"
            >
              <span>{stats.active_users.toLocaleString()} {t('active_users')}</span>
              <span>•</span>
              <span>{stats.products_sold.toLocaleString()} {t('products_sold')}</span>
              <span>•</span>
              <span>{stats.weekly_visits > 1000 ? `${(stats.weekly_visits / 1000).toFixed(1)}K` : stats.weekly_visits} {t('weekly_visits')}</span>
            </motion.div>
          )}
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 cursor-pointer flex justify-center items-center">
          <div 
            className="animate-float"
            onClick={() => {
              document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <ChevronDown className="h-10 w-10 text-white/80 hover:text-white transition-colors drop-shadow-lg" />
          </div>
        </div>
      </div>

      {/* 2. SHOP BY CATEGORY */}
      <CategoryShowcaseSection />

      {/* 3. TRENDING NOW */}
      <TrendingSection 
        trendingGroups={trendingGroups} 
        loading={!trendingGroups} 
      />

      {/* 4. FEATURED LISTINGS */}
      <FeaturedSection 
        promotions={promotions} 
        loading={loadingPromotions} 
      />

      {/* 5. NEW ARRIVALS */}
      <NewArrivalsSection 
        newArrivals={newArrivals} 
        loading={loadingNew} 
      />

      {/* 6. PLATFORM INSIGHTS */}
      <InsightsSection 
        stats={stats} 
      />

    </SnapScrollContainer>
    </>
  );
};

export default LandingPage;
