import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useVelocity, useSpring, useTransform } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import api from '../api';
import VerifiedBadge from '../components/VerifiedBadge';
import { useTheme } from '../context/ThemeContext';
import { apiCache } from '../utils/apiCache';
import { useSearch } from '../context/SearchContext';

// Snap Sections
import SnapScrollContainer from '../components/landing/SnapScrollContainer';
import CategoryShowcaseSection from '../components/landing/CategoryShowcaseSection';
import SEO from '../components/SEO';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const { openSearch } = useSearch();
  
  const [stats, setStats] = useState<any>(null);

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

    // Fetch stats for the hero
    api.get('/api/analytics/trending/')
      .then(res => {
        setStats(res.data.stats);
      })
      .catch(() => {});

    // Pre-warm the cache for the products list page so navigation is instant
    const productsParams = { page: '1', page_size: '12' };
    const productsCacheKey = `products:${JSON.stringify(productsParams)}`;
    
    const sponsParams = { ...productsParams, public: 'true' };
    const sponsCacheKey = `sponsored:${JSON.stringify(sponsParams)}`;

    if (!apiCache.get(productsCacheKey)) {
      api.get('/api/products/', { params: productsParams })
        .then(res => {
          apiCache.set(productsCacheKey, res.data);
        })
        .catch(() => {});
    }

    if (!apiCache.get(sponsCacheKey)) {
      api.get('/api/sponsored/', { params: sponsParams })
        .then(res => {
          apiCache.set(sponsCacheKey, res.data);
        })
        .catch(() => {});
    }
  }, []);

  const [showCategories] = useState(() => {
    const currentHour = new Date().getHours().toString();
    const lastViewedHour = localStorage.getItem('lastCategoryViewHour');
    return lastViewedHour !== currentHour;
  });

  useEffect(() => {
    if (showCategories) {
      localStorage.setItem('lastCategoryViewHour', new Date().getHours().toString());
    }
  }, [showCategories]);

  const sections = [
    { id: 'hero', label: 'Home' },
    ...(showCategories ? [{ id: 'categories', label: 'Categories' }] : []),
    { id: 'redirect', label: 'Products' } // Invisible redirect section
  ];
  
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const progress = target.scrollTop / (window.innerHeight || 800);
    setScrollProgress(Math.min(progress, 1));
  };

  // When the redirect section comes into view, navigate to products
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        navigate('/products');
      }
    }, { threshold: 0.1 });

    const redirectEl = document.getElementById('redirect');
    if (redirectEl) {
      observer.observe(redirectEl);
    }
    return () => observer.disconnect();
  }, [navigate]);

  // Schemas for Sitelinks Search Box and Organization
  const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://pasifiq.store').replace(/\/$/, '');
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "SokoniMax",
    "url": siteUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteUrl}/products?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SokoniMax",
    "url": siteUrl,
    "logo": `${siteUrl}/logo.png`,
    "description": "Buy and sell car parts, vehicles, electronics, and goods in Tanzania. Verified sellers and secure payments."
  };

  return (
    <>
      <SEO 
        title="SokoniMax - Tanzania Marketplace for Spare Parts, Vehicles & Electronics"
        description="Buy and sell car parts, electronics, vehicles, and goods in Tanzania. Verified sellers, secure payments, and fast delivery across Dar es Salaam and nationwide."
        schema={[websiteSchema, organizationSchema]} 
      />
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
          </div>

          <div className="relative z-10 w-full max-w-4xl px-10 sm:px-14 md:px-16 mx-auto text-center pointer-events-none pt-20">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 drop-shadow-xl tracking-tight leading-tight origin-center flex flex-col items-center justify-center">
            <span className="inline-block text-white">
              <Trans i18nKey="hero_title_main">
                Buy <span className="text-yellow-500">confidently</span> new and used items in <span className="text-yellow-500">Tanzania</span>
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
            <div 
              onClick={openSearch} 
              className="flex-1 flex relative w-full cursor-pointer group"
            >
              <input
                type="text"
                placeholder={t('search_placeholder')}
                readOnly
                className="w-full pl-6 pr-14 py-3 bg-transparent text-gray-900 dark:text-white focus:outline-none font-bold text-base md:text-lg rounded-full cursor-pointer pointer-events-none"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-gray-400 group-hover:text-brand-500 transition-colors pointer-events-none"
                aria-label="Search"
              >
                <Search className="h-6 w-6" />
              </button>
            </div>
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
              document.getElementById(showCategories ? 'categories' : 'redirect')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <ChevronDown className="h-10 w-10 text-white/80 hover:text-white transition-colors drop-shadow-lg" />
          </div>
        </div>
      </div>

      {/* 2. SHOP BY CATEGORY */}
      {showCategories && <CategoryShowcaseSection />}
      
      {/* 3. INVISIBLE REDIRECT TRIGGER */}
      <div id="redirect" className="h-[20vh] w-full invisible pointer-events-none opacity-0"></div>

    </SnapScrollContainer>
    </>
  );
};

export default LandingPage;
