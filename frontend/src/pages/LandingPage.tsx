import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import ProductCard from '../components/ProductCard';
import PromotedProductsRow from '../components/PromotedProductsRow';
import PlatformInsights from '../components/PlatformInsights';
import { ProductCardSkeleton } from '../components/Skeleton';
import { useTheme } from '../context/ThemeContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [latestProducts, setLatestProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const lightHero = 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&q=80&w=2070';
  const darkHero = 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&q=80&w=2070';

  useEffect(() => {
    // Preload hero images for seamless transitions
    [lightHero, darkHero].forEach(src => {
      const img = new Image();
      img.src = src;
    });

    api.get('/api/products/?page_size=8')
      .then((res) => {
        const data = res.data.results || res.data;
        setLatestProducts(Array.isArray(data) ? data.slice(0, 8) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
      <section className="relative h-[480px] flex items-center justify-center overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 md:-mt-6">
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentHero}
              src={currentHero}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full object-cover brightness-[0.6] dark:brightness-[0.35]"
              alt="Hero background"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-black/10 dark:bg-transparent"></div>
        </div>

        <div className="relative z-10 w-full max-w-4xl px-4 text-center">
          <h1 className="text-4xl md:text-6.5xl font-black text-white mb-4 drop-shadow-xl tracking-tight leading-tight">
            Buy & Sell <span className="text-yellow-400">Anything</span>, <br className="hidden md:block" />
            Instantly.
          </h1>
          <p className="text-base md:text-lg text-gray-200 mb-8 drop-shadow-md font-medium max-w-xl mx-auto">
            The community marketplace for new, used, and verified products in Tanzania.
          </p>

          <div className="bg-white/95 dark:bg-black/90 p-2 rounded-[2rem] shadow-2xl flex flex-col md:flex-row gap-2 max-w-2xl mx-auto border-4 border-white/10 backdrop-blur-md">
            <form onSubmit={handleSearch} className="flex-1 flex relative w-full">
              <input
                type="text"
                placeholder="What are you looking for?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-6 pr-14 py-3 bg-transparent text-gray-900 dark:text-white focus:outline-none font-bold text-base md:text-lg"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-gray-400 hover:text-brand-600 transition-colors"
                aria-label="Search"
              >
                <Search className="h-6 w-6" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Featured Selections Section */}
      <div className="container-page">
        <PromotedProductsRow />
      </div>

      {/* Platform Insights */}
      <div className="container-page">
        <PlatformInsights />
      </div>

      {/* Latest Products Listings Section */}
      <section className="container-page">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Latest Listings</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest -mt-0.5">Explore the newest uploads from our community</p>
          </div>
          <Link to="/products" className="text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-wider flex items-center gap-1 hover:underline">
            View all <ArrowRight className="h-4 w-4" />
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
            {latestProducts.map((product) => (
              <ProductCard key={product.id} product={product} viewMode="grid" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default LandingPage;
