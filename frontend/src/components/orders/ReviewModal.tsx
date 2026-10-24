import React, { useState, useEffect } from 'react';
import { X, Star, CheckCircle2 } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import SafeImage from '../SafeImage';

interface ReviewModalProps {
  orderId?: number;
  product: any;
  onClose: () => void;
  onSuccess?: () => void;
}

const RATING_DESCRIPTORS: Record<number, { label: string }> = {
  1: { label: 'Poor — Disappointed' },
  2: { label: 'Fair — Needs improvement' },
  3: { label: 'Good — Meets expectations' },
  4: { label: 'Very Good — Highly satisfied' },
  5: { label: 'Outstanding — Highly recommended!' },
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
        className="w-full max-w-lg bg-white dark:bg-[#161616] rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-slide-up border-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors border-0 outline-none cursor-pointer"
          aria-label="Close review modal"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-5">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Share Your Experience
          </h3>
        </div>

        {/* Product Snapshot Card */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-surface-muted dark:bg-[#202020] border-0 mb-5">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-[#282828] shrink-0 border-0">
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
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-neutral-400">
              {sellerName && <span>Sold by @{sellerName}</span>}
              {price && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-gray-700 dark:text-neutral-300">
                    TSh {parseInt(price).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleReviewSubmit} className="space-y-5">
          {/* Star Rating Section */}
          <div className="flex flex-col items-center justify-center py-4 px-4 rounded-xl bg-surface-muted dark:bg-[#202020] border-0">
            <span className="text-[11px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2.5">
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
                    className="p-1 text-gray-300 dark:text-neutral-700 transition-all duration-150 transform hover:scale-125 focus:outline-none border-0 cursor-pointer"
                    aria-label={`${s} Stars`}
                  >
                    <Star
                      size={32}
                      className={`transition-colors ${
                        isActive
                          ? 'text-amber-400 fill-amber-400'
                          : 'hover:text-amber-400/40'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Rating Descriptor */}
            <div className="h-5 flex items-center justify-center">
              {ratingInfo ? (
                <span className="text-xs font-semibold text-amber-500 dark:text-amber-400 transition-all animate-fade-in">
                  {ratingInfo.label}
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-neutral-500 font-medium">Tap a star to rate</span>
              )}
            </div>
          </div>

          {/* Quick Highlight Tags */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
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
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border-0 outline-none cursor-pointer ${
                      isSelected
                        ? 'bg-gray-800 text-white dark:bg-[#383838] dark:text-white font-semibold'
                        : 'bg-surface-muted dark:bg-[#202020] text-gray-600 dark:text-neutral-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#282828]'
                    }`}
                  >
                    {isSelected && <CheckCircle2 size={12} className="inline mr-1 -mt-0.5 text-white" />}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Written Feedback Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                Detailed Review
              </label>
              <span className="text-[10px] text-gray-400 dark:text-neutral-500">{comment.length}/500</span>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Tell others about the item condition, fitment, packaging, or delivery experience..."
              className="w-full p-3 rounded-xl bg-surface-muted dark:bg-[#202020] text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-neutral-500 border-0 border-none outline-none focus:outline-none focus:ring-0 resize-none transition-colors"
            />
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submittingReview || rating === 0}
              className="w-full py-3.5 px-4 bg-gray-900 hover:bg-gray-800 text-amber-500 hover:text-amber-400 dark:bg-[#323232] dark:hover:bg-[#3A3A3A] dark:active:bg-[#404040] dark:text-amber-400 dark:hover:text-amber-300 font-extrabold text-sm rounded-xl transition-all duration-150 flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-[#1C1C1C] dark:disabled:text-neutral-600 disabled:cursor-not-allowed border-0 border-none outline-none cursor-pointer"
            >
              {submittingReview ? (
                <div className="animate-spin h-5 w-5 border-2 border-amber-400 border-t-transparent rounded-full" />
              ) : (
                <span>Submit Review</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
