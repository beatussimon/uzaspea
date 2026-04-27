import React, { memo } from 'react';
import { Star, Heart, Share2, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import SafeImage from './SafeImage';
import toast from 'react-hot-toast';
import VerifiedBadge from './VerifiedBadge';
import { useCart } from '../context/CartContext';

const ProductCard = memo(({ product, viewMode = 'grid' }: { product: any; viewMode?: 'grid' | 'list' }) => {
  const { addToCart } = useCart();

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.post(`/api/products/${product.slug}/like/`);
      toast.success('Liked!', { 
        icon: '❤️',
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
      <Link to={`/product/${product.slug}`} className="group relative card overflow-hidden flex flex-row items-center p-2 gap-4 hover:border-brand-300 dark:hover:border-brand-500 transition-all">
        {/* Horizontal Image */}
        <div className="relative w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
          <SafeImage
            src={product.images?.[0]?.image || ''}
            alt={product.name}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
          <span className={`absolute top-1 left-1 text-[8px] px-1 py-0.5 rounded font-bold text-white shadow-sm uppercase ${product.condition === 'New' ? 'bg-green-500' : 'bg-gray-500'}`}>
            {product.condition || 'New'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-1.5 mb-1">
             <span className="text-gray-400 text-[10px] uppercase font-semibold tracking-wider">{product.category_name}</span>
             <span className="text-gray-300 dark:text-gray-600">•</span>
             <div className="flex items-center gap-1">
               <span className="text-[10px] text-gray-500 truncate max-w-[80px]">{product.seller_username}</span>
               <VerifiedBadge tier={product.seller_tier} isVerified={product.seller_verified} className="w-3 h-3" />
             </div>
          </div>
          <h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-white line-clamp-1 mb-1">{product.name}</h3>
          <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-1 mb-2 hidden md:block">{product.description}</p>
          
          <div className="flex items-end justify-between">
            <div className="flex flex-col">
               {product.old_price > product.price && (
                 <span className="text-[10px] text-gray-400 line-through">TSh {parseInt(product.old_price).toLocaleString()}</span>
               )}
               <span className="font-black text-brand-600 dark:text-brand-400 text-base md:text-lg">
                 TSh {parseInt(product.price).toLocaleString()}
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

        {/* Floating Actions for List */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
            <button onClick={handleLike} className="p-1.5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-red-500 transition-colors">
              <Heart size={14} />
            </button>
            <button onClick={handleShare} className="p-1.5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-brand-500 transition-colors">
              <Share2 size={14} />
            </button>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/product/${product.slug}`} className="group card overflow-hidden flex flex-col h-full bg-white dark:bg-gray-800 border border-surface-border dark:border-surface-dark-border hover:border-brand-400 dark:hover:border-brand-600 active:scale-[0.98] transition-all duration-200">
      {/* Image — 4:3 ratio */}
      <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <SafeImage
          src={product.images?.[0]?.image || ''}
          alt={product.name}
          className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700 will-change-transform"
        />
        {/* Top overlay: Like + Share + Add */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 translate-x-[10px] group-hover:translate-x-0 transition-all duration-300">
          <button onClick={handleLike} className="w-8 h-8 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur flex items-center justify-center shadow-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 transition-all" title="Like">
            <Heart size={14} />
          </button>
          <button onClick={handleAddToCart} className="w-8 h-8 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur flex items-center justify-center shadow-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 text-gray-500 hover:text-brand-500 transition-all" title="Add to Cart">
            <ShoppingCart size={14} />
          </button>
          <button onClick={handleShare} className="w-8 h-8 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur flex items-center justify-center shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all" title="Share">
            <Share2 size={14} />
          </button>
        </div>
        {/* Condition badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold text-white shadow-md uppercase tracking-wider ${product.condition === 'New' ? 'bg-green-500/90' : 'bg-gray-500/90'}`}>
            {product.condition || 'New'}
          </span>
          {product.old_price > product.price && (
            <span className="bg-red-500/90 text-white text-[9px] px-1.5 py-0.5 rounded font-black shadow-md uppercase">
              -{Math.round(((product.old_price - product.price) / product.old_price) * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-3.5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-tighter">{product.category_name}</span>
          <div className="flex gap-0.5 items-center">
            <Star size={10} className="fill-yellow-400 text-yellow-400" />
            <span className="text-[10px] text-gray-500 font-medium">{product.avg_rating || '5.0'}</span>
          </div>
        </div>
        <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{product.name}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-1 mt-0.5 mb-3 flex-1">{product.description}</p>

        <div className="flex items-baseline gap-2 mt-auto">
          {product.old_price > product.price && (
            <span className="text-xs text-gray-400 line-through font-medium">TSh {parseInt(product.old_price).toLocaleString()}</span>
          )}
          <span className="font-black text-brand-600 dark:text-brand-400 text-base">
            TSh {parseInt(product.price).toLocaleString()}
          </span>
        </div>

        {/* Seller Info */}
        <div className="text-[10px] text-gray-400 dark:text-gray-500 border-t border-surface-border/40 dark:border-surface-dark-border/40 pt-2.5 mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            <span className="truncate font-medium">{product.seller_username || 'Seller'}</span>
            <VerifiedBadge tier={product.seller_tier} isVerified={product.seller_verified} className="w-3.5 h-3.5 shrink-0" />
          </div>
          <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[8px] font-bold">PRO</span>
        </div>
      </div>
    </Link>
  );
});

export default ProductCard;
