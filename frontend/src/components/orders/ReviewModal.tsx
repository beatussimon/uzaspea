import React, { useState, useEffect } from 'react';
import { X, Star, Sparkles, CheckCircle2 } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import SafeImage from '../SafeImage';

interface ReviewModalProps {
  orderId?: number;
  product: any;
  onClose: () => void;
  onSuccess?: () => void;
}

const RATING_DESCRIPTORS: Record<number, { label: string; color: string }> = {
  1: { label: 'Poor — Disappointed', color: 'text-red-500' },
  2: { label: 'Fair — Needs improvement', color: 'text-orange-500' },
  3: { label: 'Good — Meets expectations', color: 'text-amber-500' },
  4: { label: 'Very Good — Highly satisfied', color: 'text-emerald-500' },
  5: { label: 'Outstanding — Highly recommended!', color: 'text-amber-400 font-extrabold' },
};

const QUICK_TAGS = [
  'Accurate Description',
  'Fast Dispatch',
  'Great Quality',
  'Good Packaging',
  'Fair Price',
  'Recommended',
];

const ReviewModal: React.FC<ReviewModalProps> = ({ orderId, product, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      return next;
    });
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    const productId =
      typeof product.product === 'object'
        ? product.product?.id
        : product.product || product.id;

    if (!productId) {
      toast.error('Invalid product selected.');
      return;
    }

    if (rating === 0) {
      toast.error('Please select a rating (1-5 stars) before submitting.');
      return;
    }

    // Combine comment with selected tags naturally
    let finalComment = comment.trim();
    if (selectedTags.length > 0) {
      const tagsSummary = selectedTags.join(' • ');
      finalComment = finalComment ? `${finalComment}\n\nHighlights: ${tagsSummary}` : tagsSummary;
    }

    setSubmittingReview(true);
    try {
      await api.post('/api/reviews/', {
        product: productId,
        order: orderId,
        rating,
        comment: finalComment,
      });
      toast.success('Thank you! Your review has been submitted.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.[0] ||
        err.response?.data?.product?.[0] ||
        'Failed to submit review';
      toast.error(msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  const productName = product?.product_name || product?.name || 'Product';
  const productImage = product?.product_image || product?.image || product?.images?.[0]?.image || '';
  const sellerName = product?.seller_username || product?.seller || '';
  const price = product?.unit_price || product?.price || null;

  const displayRating = hoverRating || rating;
  const ratingInfo = RATING_DESCRIPTORS[displayRating];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-card p-6 shadow-2xl relative overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Top Accent Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
          aria-label="Close review modal"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-500 uppercase tracking-widest mb-1">
            <Sparkles size={14} />
            <span>Verified Customer Feedback</span>
          </div>
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Share Your Experience
          </h3>
        </div>

        {/* Product Snapshot Card */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-surface-muted dark:bg-[#121212] border border-surface-border/60 dark:border-surface-dark-border/60 mb-6">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 shrink-0 border border-gray-200 dark:border-neutral-700">
            {productImage ? (
              <SafeImage src={productImage} alt={productName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                Item
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {productName}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {sellerName && <span>Sold by @{sellerName}</span>}
              {price && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    TSh {parseInt(price).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleReviewSubmit} className="space-y-5">
          {/* Star Rating Section */}
          <div className="flex flex-col items-center justify-center py-3 px-4 rounded-xl bg-gray-50 dark:bg-[#0f0f0f] border border-gray-100 dark:border-neutral-800/80">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Overall Rating
            </span>

            {/* Stars */}
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((s) => {
                const isActive = displayRating >= s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-gray-300 dark:text-neutral-700 transition-all duration-150 transform hover:scale-125 focus:outline-none"
                    aria-label={`${s} Stars`}
                  >
                    <Star
                      size={32}
                      className={`transition-colors ${
                        isActive
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                          : 'hover:text-amber-200'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Rating Descriptor */}
            <div className="h-5 flex items-center justify-center">
              {ratingInfo ? (
                <span className={`text-xs font-bold transition-all animate-fade-in ${ratingInfo.color}`}>
                  {ratingInfo.label}
                </span>
              ) : (
                <span className="text-xs text-gray-400 font-medium">Tap a star to rate</span>
              )}
            </div>
          </div>

          {/* Quick Highlight Tags */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              What stood out? (Optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 dark:border-amber-500/40 shadow-sm'
                        : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400 border-surface-border dark:border-surface-dark-border hover:border-gray-400 dark:hover:border-neutral-600'
                    }`}
                  >
                    {isSelected && <CheckCircle2 size={12} className="inline mr-1 -mt-0.5 text-amber-500" />}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Written Feedback Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Detailed Review
              </label>
              <span className="text-[10px] text-gray-400">{comment.length}/500</span>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Tell others about the item condition, fitment, packaging, or delivery experience..."
              className="input text-sm resize-none"
            />
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submittingReview || rating === 0}
              className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-black font-extrabold text-sm rounded-btn shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingReview ? (
                <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
              ) : (
                <>
                  <Star size={16} className="fill-black" />
                  <span>Submit Review</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
