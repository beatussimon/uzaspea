import React, { memo } from 'react';
import { Star, Heart, Share2, ShoppingCart, Shield, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import SafeImage from './SafeImage';
import toast from 'react-hot-toast';
import VerifiedBadge from './VerifiedBadge';
import { useCart } from '../context/CartContext';
import { timeAgo } from '../utils/timeAgo';

const ProductImageCarousel = ({ product, viewMode, isSponsored }: any) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const images = product.images || [];
  const { t } = useTranslation();

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const width = scrollRef.current.offsetWidth;
    const index = Math.round(scrollLeft / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const scrollToIndex = (index: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: scrollRef.current.offsetWidth * index, behavior: 'smooth' });
    setCurrentIndex(index);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (currentIndex < images.length - 1) scrollToIndex(currentIndex + 1);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (currentIndex > 0) scrollToIndex(currentIndex - 1);
  };

  return (
    <div className={`relative ${viewMode === 'list' ? 'w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-lg' : 'h-48'} bg-gray-100 dark:bg-gray-800/50 overflow-hidden group/carousel`}>
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full w-full"
      >
        {images.length > 0 ? (
          images.map((img: any, i: number) => (
            <div key={i} className="flex-none w-full h-full snap-center">
              <SafeImage
                src={img.image || ''}
                alt={`${product.name} - ${i + 1}`}
                category={product.category_name}
                className="object-cover object-top w-full h-full"
              />
            </div>
          ))
        ) : (
          <div className="flex-none w-full h-full snap-center">
            <SafeImage src="" alt={product.name} category={product.category_name} className="object-cover object-top w-full h-full" />
          </div>
        )}
      </div>

      {viewMode === 'list' ? (
        <span className={`absolute top-1 left-1 text-[8px] px-1.5 py-0.5 rounded font-bold text-white shadow-sm uppercase z-10 ${product.condition === 'New' ? 'bg-green-500' : 'bg-gray-500'}`}>
          {product.condition === 'New' ? t('new', 'New') : t('used', 'Used')}
        </span>
      ) : (
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10 pointer-events-none">
          {isSponsored && (
            <span className="bg-brand-600 text-white text-[9px] px-2 py-0.5 rounded font-black shadow-md uppercase tracking-wider">
              {t('sponsored', 'Sponsored')}
            </span>
          )}
          <span className={`text-[9px] px-2 py-0.5 rounded font-bold text-white shadow-md uppercase tracking-wider w-fit ${product.condition === 'New' ? 'bg-green-500' : 'bg-gray-500'}`}>
            {product.condition === 'New' ? t('new', 'New') : t('used', 'Used')}
          </span>
          {product.old_price > product.price && (
            <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-black shadow-md uppercase w-fit">
              -{Math.round(((product.old_price - product.price) / product.old_price) * 100)}%
            </span>
          )}
        </div>
      )}

      {images.length > 1 && (
        <>
          <button 
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover/carousel:opacity-100 disabled:opacity-0 transition-opacity z-10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button 
            onClick={handleNext}
            disabled={currentIndex === images.length - 1}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover/carousel:opacity-100 disabled:opacity-0 transition-opacity z-10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 pointer-events-none">
            {images.map((_: any, i: number) => (
              <div 
                key={i} 
                className={`w-1 h-1 rounded-full transition-all ${i === currentIndex ? 'bg-white scale-150' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const ProductCard = memo(({ product, viewMode = 'grid', isSponsored = false }: { product: any; viewMode?: 'grid' | 'list'; isSponsored?: boolean }) => {
  const { addToCart } = useCart();
  const { t } = useTranslation();

  if (!product) return null;

  const [liked, setLiked] = React.useState(product.is_liked || false);
  const currentUsername = localStorage.getItem('username');
  const isOwnProduct = Boolean(currentUsername && product.seller_username?.toLowerCase() === currentUsername.toLowerCase());

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await api.post(`/api/products/${product.slug}/like/`);
      setLiked(res.data.liked);
      toast.success(res.data.liked ? 'Liked!' : 'Unliked!', { 
        icon: res.data.liked ? '❤️' : '🤍',
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
    } catch { toast.error('Login to like'); }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    toast.success('Added to cart', {
      icon: '🛒',
      style: { borderRadius: '10px', background: '#333', color: '#fff' }
    });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/product/${product.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  if (viewMode === 'list') {
    return (
      <div className={`group relative card overflow-hidden flex flex-row items-center p-2 gap-4 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-card-hover active:scale-95 transition-all duration-300 ${isSponsored ? 'shadow-[0_0_15px_rgba(250,204,21,0.4)] dark:shadow-[0_0_15px_rgba(250,204,21,0.2)] ring-2 ring-yellow-400/60 dark:ring-yellow-500/40' : ''}`}>
        <Link to={`/product/${product.slug}`} className="flex flex-row items-center gap-4 flex-1 min-w-0">
          {/* Horizontal Image Carousel */}
          <ProductImageCarousel product={product} viewMode={viewMode} isSponsored={isSponsored} />

          {/* Content */}
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-1.5 mb-1 text-[9px] text-gray-400">
               {isSponsored && (
                 <span className="text-white bg-brand-600 px-1.5 py-0.5 rounded text-[8px] uppercase font-black tracking-widest shrink-0 shadow-md">{t('sponsored', 'Sponsored')}</span>
               )}
               <span className="text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider shrink-0">{product.category_name}</span>
               <span className="text-gray-300 dark:text-gray-600 shrink-0">•</span>
               <div className="flex items-center gap-1 shrink-0">
                 <span className="text-[10px] text-gray-500 truncate max-w-[80px]">{product.seller_username}</span>
                 <VerifiedBadge tier={product.seller_tier} isVerified={product.seller_verified} className="w-3 h-3" />
               </div>
               {product.location_name && (
                 <>
                   <span className="text-gray-300 dark:text-gray-600 shrink-0">•</span>
                   <span className="flex items-center gap-0.5 truncate max-w-[60px] shrink-0"><MapPin size={8} /> {product.location_name}</span>
                 </>
               )}
               {product.created_at && (
                 <>
                   <span className="text-gray-300 dark:text-gray-600 shrink-0">•</span>
                   <span className="flex items-center gap-0.5 whitespace-nowrap shrink-0"><Clock size={8} /> {timeAgo(product.created_at)}</span>
                 </>
               )}
               {product.is_verified && (
                 <div className="flex items-center gap-1 text-[9px] text-brand-600 dark:text-brand-400 font-black bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded-full border border-brand-100 dark:border-brand-800 ml-auto shrink-0" title={t('verified_seller', 'Verified Seller')}>
                   <Shield size={10} className="fill-current" />
                   <span className="uppercase tracking-widest text-[8px]">{t('verified', 'Verified')}</span>
                 </div>
               )}
            </div>
            <h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-white line-clamp-1 mb-1">{product.name}</h3>
            
            <div className="flex items-end justify-between">
              <div className="flex flex-col">
                 {product.sale_price && parseFloat(product.sale_price) < parseFloat(product.price) && (
                   <span className="text-[10px] text-gray-400 line-through">TSh {parseInt(product.price).toLocaleString()}</span>
                 )}
                 <span className="font-black text-gray-900 dark:text-white text-base md:text-lg">
                   TSh {parseInt(product.sale_price && parseFloat(product.sale_price) < parseFloat(product.price) ? product.sale_price : product.price).toLocaleString()}
                 </span>
              </div>
              <div className="flex gap-1 items-center mb-1">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={10} className={s <= product.avg_rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-gray-700'} />
                ))}
                {product.avg_rating > 0 && <span className="text-[10px] text-gray-400 ml-1">({product.avg_rating})</span>}
              </div>
            </div>
          </div>
        </Link>

        {/* Floating Actions for List */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
            <button onClick={handleLike} className="p-1.5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-red-500 transition-colors">
              <Heart size={14} className={liked ? 'fill-red-500 text-red-500' : ''} />
            </button>
            <button onClick={handleShare} className="p-1.5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-brand-500 transition-colors">
              <Share2 size={14} />
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative card overflow-hidden flex flex-col h-full min-h-[320px] bg-white dark:bg-[#0A0A0A] border-2 ${isSponsored ? 'shadow-[0_0_15px_rgba(250,204,21,0.4)] dark:shadow-[0_0_15px_rgba(250,204,21,0.2)] border-yellow-400/60 dark:border-yellow-500/40' : 'border-surface-border dark:border-surface-dark-border'} hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-card-hover active:scale-95 transition-all duration-300`}>
      <Link to={`/product/${product.slug}`} className="flex flex-col h-full">
        {/* Image Carousel — fixed height */}
        <ProductImageCarousel product={product} viewMode={viewMode} isSponsored={isSponsored} />

        {/* Card body */}
        <div className="p-3.5 flex flex-col flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider whitespace-nowrap shrink-0">{product.category_name}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {product.is_verified && (
                 <div className="flex items-center gap-1 text-[8px] text-brand-600 dark:text-brand-400 font-black bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded-full border border-brand-100 dark:border-brand-800 whitespace-nowrap shrink-0" title={t('verified_seller', 'Verified Seller')}>
                   <Shield size={10} className="fill-current" />
                   <span className="uppercase tracking-widest text-[8px]">{t('verified', 'Verified')}</span>
                 </div>
              )}
              {product.has_inspection && (
                 <div className="flex items-center gap-1 text-[8px] text-emerald-600 dark:emerald-400 font-black bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 whitespace-nowrap shrink-0" title={t('professionally_inspected', 'Professionally Inspected')}>
                   <Shield size={10} />
                   <span className="uppercase tracking-widest text-[8px]">{t('inspected_label', 'Inspected ✓')}</span>
                 </div>
              )}
            </div>
          </div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1 mt-0.5 mb-3 flex-1 transition-colors">{product.name}</h3>
          
          <div className="flex items-baseline gap-2 mt-auto">
            {product.sale_price && parseFloat(product.sale_price) < parseFloat(product.price) && (
              <span className="text-xs text-gray-400 line-through font-medium">TSh {parseInt(product.price).toLocaleString()}</span>
            )}
            <span className="font-black text-gray-900 dark:text-white text-base">
              TSh {parseInt(product.sale_price && parseFloat(product.sale_price) < parseFloat(product.price) ? product.sale_price : product.price).toLocaleString()}
            </span>
          </div>

          {/* Seller Info */}
          <div className="text-[10px] text-gray-400 dark:text-gray-500 border-t border-surface-border/40 dark:border-surface-dark-border/40 pt-2.5 mt-2.5 flex items-center justify-between font-medium">
            <div className="flex items-center gap-1.5 min-w-0 text-[9px]">
              <div className="flex items-center gap-1 shrink-0">
                <span className="truncate font-medium text-gray-600 dark:text-gray-300">{product.seller_username || 'Seller'}</span>
                <VerifiedBadge tier={product.seller_tier} isVerified={product.seller_verified} className="w-3.5 h-3.5 shrink-0" />
              </div>
              {product.location_name && (
                <>
                  <span className="text-gray-400/60 dark:text-gray-600 shrink-0">•</span>
                  <span className="flex items-center gap-0.5 truncate max-w-[50px] shrink-0"><MapPin size={8} /> {product.location_name}</span>
                </>
              )}
              {product.created_at && (
                <>
                  <span className="text-gray-400/60 dark:text-gray-600 shrink-0">•</span>
                  <span className="flex items-center gap-0.5 whitespace-nowrap shrink-0"><Clock size={8} /> {timeAgo(product.created_at)}</span>
                </>
              )}
            </div>
            <div className="flex gap-0.5 items-center shrink-0 ml-1">
              <Star size={10} className={product.avg_rating > 0 ? "fill-yellow-400 text-yellow-400" : "text-gray-300 dark:text-gray-600"} />
              <span className="text-[10px] text-gray-500 font-medium">{product.avg_rating > 0 ? product.avg_rating : '0.0'}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Top overlay: Like + Share + Add */}
      <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 translate-x-0 lg:translate-x-2 lg:group-hover:translate-x-0 transition-all duration-300 ease-out z-10">
        <button onClick={handleLike} className={`w-8 h-8 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-md flex items-center justify-center shadow-lg transition-colors ${liked ? 'bg-red-50 dark:bg-red-900/30 text-red-500' : 'hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500'}`} title="Like">
          <Heart size={14} className={liked ? 'fill-current' : ''} />
        </button>
        {!isOwnProduct && (
          <button onClick={handleAddToCart} className="w-8 h-8 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-md flex items-center justify-center shadow-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 text-gray-500 hover:text-brand-500 transition-colors" title={t('add_to_cart')}>
            <ShoppingCart size={16} />
          </button>
        )}
        <button onClick={handleShare} className="w-8 h-8 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-md flex items-center justify-center shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors" title="Share">
          <Share2 size={14} />
        </button>
      </div>
    </div>
  );
});

export default ProductCard;
