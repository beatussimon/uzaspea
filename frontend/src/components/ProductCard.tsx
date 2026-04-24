import React, { memo } from 'react';
import { Star, Heart, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import SafeImage from './SafeImage';
import toast from 'react-hot-toast';
import VerifiedBadge from './VerifiedBadge';

const ProductCard = memo(({ product }: { product: any }) => {
  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.post(`/api/products/${product.slug}/like/`);
      toast.success('Liked!');
    } catch { toast.error('Login to like'); }
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

  return (
    <Link to={`/product/${product.slug}`} className="group card overflow-hidden flex flex-col h-full bg-white dark:bg-gray-800 border border-surface-border dark:border-surface-dark-border">
      {/* Image — 4:3 ratio for compact density */}
      <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <SafeImage
          src={product.images?.[0]?.image || ''}
          alt={product.name}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300 will-change-transform"
        />
        {/* Top overlay: Like + Share */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={handleLike} className="w-7 h-7 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30 transition" title="Like">
            <Heart size={13} className="text-gray-500 hover:text-red-500" />
          </button>
          <button onClick={handleShare} className="w-7 h-7 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-brand-50 dark:hover:bg-brand-900/30 transition" title="Share">
            <Share2 size={13} className="text-gray-500 hover:text-brand-500" />
          </button>
        </div>
        {/* Condition badge */}
        <span className={`absolute top-2 left-2 text-2xs px-1.5 py-0.5 rounded font-medium text-white shadow-sm ${product.condition === 'New' ? 'bg-green-500' : 'bg-gray-500'}`}>
          {product.condition || 'New'}
        </span>
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">{product.name}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2 mt-0.5 mb-2 flex-1">{product.description}</p>

        <span className="font-bold text-brand-600 dark:text-brand-400 text-sm">
          TSh {parseInt(product.price).toLocaleString()}
        </span>

        {/* Seller + Category */}
        <div className="text-xs text-gray-400 dark:text-gray-500 border-t border-surface-border/60 dark:border-surface-dark-border/60 pt-2 mt-2 space-y-0.5 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="truncate">{product.seller_username || 'Seller'}</span>
            <VerifiedBadge tier={product.seller_tier} isVerified={product.seller_verified} className="w-4 h-4" />
          </div>
          <div className="truncate">{product.category_name || 'Category'}</div>
        </div>

        {/* Stars */}
        <div className="flex gap-0.5 mt-1.5 items-center">
          {product.avg_rating > 0 ? (
            [1,2,3,4,5].map((s) => (
              <Star key={s} size={11} className={s <= product.avg_rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-gray-600'} />
            ))
          ) : (
            <span className="text-2xs text-gray-400">No reviews</span>
          )}
        </div>
      </div>
    </Link>
  );
});

export default ProductCard;
