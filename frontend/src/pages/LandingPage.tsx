import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useVelocity, useSpring, useTransform } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import api from '../api';
import ProductCard from '../components/ProductCard';
import PromotedProductsRow from '../components/PromotedProductsRow';
import PlatformInsights from '../components/PlatformInsights';
import { ProductCardSkeleton } from '../components/Skeleton';
import VerifiedBadge from '../components/VerifiedBadge';
import { useTheme } from '../context/ThemeContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [latestProducts, setLatestProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPromotions, setLoadingPromotions] = useState(true);

  // Framer motion values for the drag-to-wiggle effect
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);
  const dragVelocity = useVelocity(dragX);
  const smoothVelocity = useSpring(dragVelocity, { damping: 50, stiffness: 400 });
  
  // Group transforms for the paragraph and form

  const rotateForm = useTransform(smoothVelocity, [-1000, 0, 1000], [-1, 0, 1]);
  const skewForm = useTransform(smoothVelocity, [-1000, 0, 1000], [2, 0, -2]);

  const lightHero = '/kariakoo_daytime.webp?v=3';
  const darkHero = '/kariakoo_nightscape.webp?v=3';

  useEffect(() => {
    // Preload hero images for seamless transitions
    [lightHero, darkHero].forEach(src => {
      const img = new Image();
      img.src = src;
    });

    // Fetch stats
    api.get('/api/analytics/trending/')
      .then(res => setStats(res.data.stats))
      .catch(() => {});

    // Fetch promotions and products, filtering out duplicates
    api.get('/api/sponsored/?public=true&page_size=16')
      .then((promoRes) => {
        const promoData = Array.isArray(promoRes.data.results || promoRes.data) 
          ? (promoRes.data.results || promoRes.data) : [];
        setPromotions(promoData);
        setLoadingPromotions(false);
        
        return api.get('/api/products/?page_size=16').then((prodRes) => {
          const prodData = Array.isArray(prodRes.data.results || prodRes.data) 
            ? (prodRes.data.results || prodRes.data) : [];
          // Filter out products that are already in promotions
          const filtered = prodData.filter((p: any) => !promoData.some((promo: any) => promo.product_details?.id === p.id));
          setLatestProducts(filtered.slice(0, 8));
          setLoading(false);
        });
      })
      .catch(() => {
        setLoading(false);
        setLoadingPromotions(false);
      });
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/products');
    }
  };

  const currentHero = isDark ? darkHero : lightHero;

  return (
    <div className="space-y-16 pb-24">
      {/* Hero Search Section */}
      <section className="relative h-[100vh] min-h-[540px] w-full flex items-center justify-center overflow-hidden -mt-[96px] md:-mt-[104px] pt-16 md:pt-20">
        <div className="absolute inset-0 z-0 overflow-hidden flex cursor-grab active:cursor-grabbing" ref={constraintsRef}>
          <AnimatePresence mode="wait">
            <motion.img
              key={currentHero}
              src={currentHero}
              drag="x"
              dragConstraints={constraintsRef}
              dragElastic={0.1}
              style={{ x: dragX }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="h-full w-auto min-w-[160vw] md:w-full md:min-w-full object-cover brightness-[0.6] dark:brightness-[0.35] max-w-none"
              alt="Hero background"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-black/10 dark:bg-transparent pointer-events-none sticky left-0"></div>
        </div>

        <div className="relative z-10 w-full max-w-4xl px-10 sm:px-14 md:px-16 text-center pointer-events-none">
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
        <div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 cursor-pointer"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          <div className="animate-bounce">
            <ChevronDown className="h-10 w-10 text-white/80 hover:text-white transition-colors drop-shadow-lg" />
          </div>
        </div>
      </section>

      {/* Platform Insights */}
      <div className="container-page">
        <PlatformInsights />
      </div>

      {/* Featured Selections Section */}
      <div className="container-page">
        <PromotedProductsRow promotions={promotions} loading={loadingPromotions} />
      </div>

      {/* Latest Products Listings Section */}
      <section className="container-page">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">{t('latest_listings', 'Latest Listings')}</h2>
          </div>
          <Link to="/products" className="text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-wider flex items-center gap-1 hover:underline">
            {t('view_all', 'View all')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <ProductCardSkeleton key={i} viewMode="grid" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 p-4 md:p-5 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50">
            {latestProducts.map((product, idx) => (
              <ProductCard key={product.id} product={product} viewMode="grid" isTopFold={idx < 4} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default LandingPage;
