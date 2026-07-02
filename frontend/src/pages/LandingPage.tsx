import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useVelocity, useSpring, useTransform } from 'framer-motion';
import api from '../api';
import ProductCard from '../components/ProductCard';
import PromotedProductsRow from '../components/PromotedProductsRow';
import PlatformInsights from '../components/PlatformInsights';
import { ProductCardSkeleton } from '../components/Skeleton';
import { useTheme } from '../context/ThemeContext';

const WavyChar = ({ char, index, velocity }: { char: string, index: number, velocity: any }) => {
  const y = useTransform(velocity, [-1000, 0, 1000], [
    -12 * Math.sin(index * 0.4), 
    0, 
    12 * Math.sin(index * 0.4)
  ]);
  const rotate = useTransform(velocity, [-1000, 0, 1000], [
    -5 * Math.cos(index * 0.4), 
    0, 
    5 * Math.cos(index * 0.4)
  ]);
  return (
    <motion.span style={{ y, rotate, display: 'inline-block', whiteSpace: 'pre' }}>
      {char}
    </motion.span>
  );
};

const WavyText = ({ text, velocity, startIndex = 0 }: { text: string, velocity: any, startIndex?: number }) => {
  return (
    <span style={{ display: 'inline-block' }}>
      {text.split('').map((char, i) => (
        <WavyChar key={i} char={char} index={startIndex + i} velocity={velocity} />
      ))}
    </span>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [latestProducts, setLatestProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Framer motion values for the drag-to-wiggle effect
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);
  const dragVelocity = useVelocity(dragX);
  const smoothVelocity = useSpring(dragVelocity, { damping: 50, stiffness: 400 });
  
  // Group transforms for the paragraph and form
  const rotateP = useTransform(smoothVelocity, [-1000, 0, 1000], [2, 0, -2]);
  const xP = useTransform(smoothVelocity, [-1000, 0, 1000], [4, 0, -4]);

  const rotateForm = useTransform(smoothVelocity, [-1000, 0, 1000], [-1, 0, 1]);
  const skewForm = useTransform(smoothVelocity, [-1000, 0, 1000], [2, 0, -2]);

  const lightHero = '/kariakoo_daytime.png';
  const darkHero = '/kariakoo_nightscape.png';

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

        <div className="relative z-10 w-full max-w-4xl px-10 sm:px-14 md:px-16 text-center -translate-y-12 md:-translate-y-16 pointer-events-none">
          <h1 className="text-4xl md:text-6.5xl font-black text-white mb-4 drop-shadow-xl tracking-tight leading-tight origin-center flex flex-col items-center justify-center">
            <div className="inline-block">
              <WavyText text="Buy and Sell " velocity={smoothVelocity} />
              <span className="text-yellow-400 inline-block">
                <WavyText text="Anything" velocity={smoothVelocity} startIndex={13} />
              </span>
              <WavyText text="," velocity={smoothVelocity} startIndex={21} /> 
            </div>
            <div className="hidden md:inline-block">
              <WavyText text="Instantly." velocity={smoothVelocity} startIndex={22} />
            </div>
            <div className="inline-block md:hidden">
              <WavyText text="Instantly." velocity={smoothVelocity} startIndex={22} />
            </div>
          </h1>
          <motion.p 
            style={{ rotate: rotateP, x: xP }}
            className="text-base md:text-lg text-gray-200 mb-8 drop-shadow-md font-medium max-w-xl mx-auto origin-center"
          >
            The community marketplace for new, used, and verified products in Tanzania.
          </motion.p>

          <motion.div 
            style={{ rotate: rotateForm, skewX: skewForm }}
            className="bg-white/95 dark:bg-black/90 p-2 rounded-[2rem] shadow-2xl flex flex-col md:flex-row gap-2 max-w-2xl mx-auto border-4 border-white/10 backdrop-blur-md pointer-events-auto origin-center"
          >
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
          </motion.div>
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
