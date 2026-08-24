import React, { useState, useEffect, useMemo } from 'react';
import { Star, MessageSquare, CheckCircle2, CornerDownRight, Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import toast from 'react-hot-toast';
import SafeImage from './SafeImage';
import { timeAgo } from '../utils/timeAgo';
import VerifiedBadge from './VerifiedBadge';

interface Review {
  id: number;
  username: string;
  user_full_name?: string | null;
  user_profile_picture?: string | null;
  user_verified?: boolean;
  user_tier?: string;
  is_verified_buyer?: boolean;
  rating: number;
  comment: string;
  created_at: string;
}

interface Comment {
  id: number;
  username: string;
  user_full_name?: string | null;
  user_profile_picture?: string | null;
  user_verified?: boolean;
  user_tier?: string;
  body: string;
  created_at: string;
  likes_count: number;
  parent: number | null;
}

interface ProductTabsProps {
  productId: number;
  sellerUsername?: string;
}

const UserAvatar = ({ 
  username, 
  profilePicture, 
  isSeller, 
  size = 'md' 
}: { 
  username: string; 
  profilePicture?: string | null; 
  isSeller?: boolean; 
  size?: 'md' | 'sm';
}) => {
  const sizeClasses = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  
  if (profilePicture) {
    return (
      <div className={`${sizeClasses} shrink-0 rounded-full overflow-hidden ring-2 ${isSeller ? 'ring-brand-500' : 'ring-neutral-200 dark:ring-neutral-800'}`}>
        <SafeImage 
          src={profilePicture} 
          alt={username} 
          className="w-full h-full object-cover" 
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses} shrink-0 rounded-full flex items-center justify-center font-bold uppercase transition-transform ${
      isSeller 
        ? 'bg-brand-500 text-white shadow-sm' 
        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 ring-1 ring-neutral-200 dark:ring-neutral-700'
    }`}>
      {username ? username.charAt(0) : 'U'}
    </div>
  );
};

export const ProductTabs: React.FC<ProductTabsProps> = ({ productId, sellerUsername }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'reviews' | 'comments'>('reviews');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const parentComments = useMemo(() => comments.filter(c => !c.parent), [comments]);
  const getReplies = (parentId: number) => comments.filter(c => c.parent === parentId);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return sum / reviews.length;
  }, [reviews]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      setLoadingReviews(true);
      api.get(`/api/reviews/?product=${productId}`)
        .then((res) => setReviews(res.data.results || res.data || []))
        .catch(() => toast.error('Failed to load reviews'))
        .finally(() => setLoadingReviews(false));
    } else {
      setLoadingComments(true);
      api.get(`/api/comments/?product=${productId}`)
        .then((res) => setComments(res.data.results || res.data || []))
        .catch(() => toast.error('Failed to load comments'))
        .finally(() => setLoadingComments(false));
    }
  }, [activeTab, productId]);

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/api/comments/', {
        product: productId,
        body: commentText,
      });
      setComments((prev) => [res.data, ...prev]);
      setCommentText('');
      toast.success('Comment posted!');
    } catch {
      toast.error('Login to post comments');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Standardized Tabs Navigation */}
      <div className="flex items-center gap-8 border-b border-neutral-200 dark:border-neutral-800 mb-6">
        <button
          className={`pb-3.5 text-sm font-bold tracking-tight transition-all relative flex items-center gap-2 ${
            activeTab === 'reviews'
              ? 'text-neutral-900 dark:text-white'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
          }`}
          onClick={() => setActiveTab('reviews')}
        >
          <span>{t('reviews_tab', 'Reviews')}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'reviews' 
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' 
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
          }`}>
            {reviews.length}
          </span>
          {activeTab === 'reviews' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
          )}
        </button>

        <button
          className={`pb-3.5 text-sm font-bold tracking-tight transition-all relative flex items-center gap-2 ${
            activeTab === 'comments'
              ? 'text-neutral-900 dark:text-white'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
          }`}
          onClick={() => setActiveTab('comments')}
        >
          <span>{t('comments_tab', 'Q&A & Comments')}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'comments' 
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' 
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
          }`}>
            {comments.length}
          </span>
          {activeTab === 'comments' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Content Area */}
      <div>
        {/* ================= REVIEWS TAB ================= */}
        {activeTab === 'reviews' && (
          <div className="animate-fade-in space-y-6">
            {/* Overall Rating Summary Bar */}
            {reviews.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row items-center sm:items-stretch gap-6">
                <div className="flex flex-col items-center justify-center sm:border-r sm:border-neutral-200 dark:sm:border-neutral-800 sm:pr-6 min-w-[130px]">
                  <span className="text-4xl font-black text-neutral-900 dark:text-white">
                    {averageRating.toFixed(1)}
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-400 my-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={15}
                        className={s <= Math.round(averageRating) ? 'fill-current text-amber-400' : 'text-neutral-300 dark:text-neutral-700'}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                    {reviews.length} {reviews.length === 1 ? 'verified review' : 'verified reviews'}
                  </span>
                </div>

                {/* Rating Distribution Breakdown */}
                <div className="flex-1 w-full space-y-1.5 justify-center flex flex-col">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => Number(r.rating) === star).length;
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-6 font-bold text-neutral-500">{star} ★</span>
                        <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-medium text-neutral-400 text-[11px]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reviews List */}
            {loadingReviews ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                  <Star size={22} className="stroke-[1.5]" />
                </div>
                <p className="font-bold text-sm text-neutral-900 dark:text-white mb-1">No reviews yet</p>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Only verified buyers who completed their order can leave product reviews.
                </p>
              </div>
            ) : (
              <div className="space-y-6 divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {reviews.map((review, index) => (
                  <div key={review.id} className={`flex gap-3.5 group ${index > 0 ? 'pt-6' : ''}`}>
                    <UserAvatar 
                      username={review.username} 
                      profilePicture={review.user_profile_picture} 
                      isSeller={review.username === sellerUsername} 
                    />
                    <div className="flex-1 min-w-0 pt-0.5">
                      {/* Author Header */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                          {review.user_full_name || `@${review.username}`}
                          {review.username === sellerUsername && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-400">
                              Seller
                            </span>
                          )}
                        </span>

                        {/* Verified Purchase Badge */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} className="stroke-[2.5]" />
                          Verified Purchase
                        </span>

                        <span className="text-xs text-neutral-400 dark:text-neutral-500 ml-auto">
                          {timeAgo(review.created_at)}
                        </span>
                      </div>

                      {/* Star Rating Indicator */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={13}
                              className={s <= review.rating ? 'fill-current text-amber-400' : 'text-neutral-200 dark:text-neutral-700'}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          {Number(review.rating).toFixed(1)}
                        </span>
                      </div>

                      {/* Review Comment Text */}
                      {review.comment && (
                        <p className="text-[14px] text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= COMMENTS TAB ================= */}
        {activeTab === 'comments' && (
          <div className="animate-fade-in space-y-6">
            {/* Comment Composer */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Ask a question or share feedback
              </h4>
              <textarea
                className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-white resize-none transition-all placeholder:text-neutral-400"
                placeholder={t('add_a_comment', 'Write a question or public comment for the seller and community...')}
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="mt-2.5 flex justify-end gap-2">
                {commentText.trim() && (
                  <button
                    onClick={() => setCommentText('')}
                    className="px-3.5 py-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition"
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                )}
                <button
                  onClick={handlePostComment}
                  disabled={submitting || !commentText.trim()}
                  className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded-full text-xs transition flex items-center gap-1.5 shadow-sm"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>{submitting ? t('posting', 'Posting...') : t('comment_btn', 'Post Comment')}</span>
                </button>
              </div>
            </div>

            {/* Comments Feed */}
            {loadingComments ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                  <MessageSquare size={22} className="stroke-[1.5]" />
                </div>
                <p className="font-bold text-sm text-neutral-900 dark:text-white mb-1">No questions or comments yet</p>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Have a question about this item? Ask the seller above and receive verified answers.
                </p>
              </div>
            ) : (
              <div className="space-y-6 divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {parentComments.map((comment, index) => (
                  <div key={comment.id} className={`space-y-3 ${index > 0 ? 'pt-6' : ''}`}>
                    <div className="flex gap-3.5 group">
                      <UserAvatar 
                        username={comment.username} 
                        profilePicture={comment.user_profile_picture} 
                        isSeller={comment.username === sellerUsername} 
                      />
                      <div className="flex-1 min-w-0 pt-0.5">
                        {/* Author Header */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                            {comment.user_full_name || `@${comment.username}`}
                            {comment.username === sellerUsername && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-400">
                                Seller
                              </span>
                            )}
                          </span>

                          {comment.user_verified && (
                            <VerifiedBadge tier={comment.user_tier} isVerified={true} className="w-3.5 h-3.5" />
                          )}

                          <span className="text-xs text-neutral-400 dark:text-neutral-500 ml-auto">
                            {timeAgo(comment.created_at)}
                          </span>
                        </div>

                        {/* Comment Body */}
                        <p className="text-[14px] text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                          {comment.body}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-4 mt-2">
                          <button 
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} 
                            className="text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition flex items-center gap-1"
                          >
                            <CornerDownRight size={12} />
                            {replyingTo === comment.id ? t('cancel', 'Cancel') : t('reply', 'Reply')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Threaded Replies */}
                    {getReplies(comment.id).length > 0 && (
                      <div className="ml-8 sm:ml-11 pl-3 border-l-2 border-neutral-100 dark:border-neutral-800/80 space-y-3.5 pt-1">
                        {getReplies(comment.id).map((reply) => (
                          <div key={reply.id} className="flex gap-2.5">
                            <UserAvatar 
                              username={reply.username} 
                              profilePicture={reply.user_profile_picture} 
                              isSeller={reply.username === sellerUsername} 
                              size="sm" 
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <span className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-1">
                                  {reply.user_full_name || `@${reply.username}`}
                                  {reply.username === sellerUsername && (
                                    <span className="px-1 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-400">
                                      Seller
                                    </span>
                                  )}
                                </span>
                                <span className="text-[11px] text-neutral-400 dark:text-neutral-500 ml-auto">
                                  {timeAgo(reply.created_at)}
                                </span>
                              </div>
                              <p className="text-[13px] text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                                {reply.body}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {replyingTo === comment.id && (
                      <div className="ml-8 sm:ml-11 pl-3 mt-2 flex flex-col items-end">
                        <input
                          type="text"
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-sm dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all placeholder:text-neutral-400"
                          placeholder={t('add_a_reply', 'Write a public reply...')}
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
                        <div className="flex gap-2 mt-2">
                          <button 
                            onClick={() => { setReplyingTo(null); setReplyText(''); }} 
                            className="px-3 py-1 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition"
                          >
                            {t('cancel', 'Cancel')}
                          </button>
                          <button
                            onClick={async () => {
                              if (!replyText.trim()) return;
                              setSubmitting(true);
                              try {
                                const res = await api.post('/api/comments/', {
                                  product: productId,
                                  body: replyText,
                                  parent: comment.id,
                                });
                                setComments((prev) => [...prev, res.data]);
                                setReplyText('');
                                setReplyingTo(null);
                                toast.success('Reply posted!');
                              } catch {
                                toast.error('Failed to post reply');
                              } finally {
                                setSubmitting(false);
                              }
                            }}
                            disabled={submitting || !replyText.trim()}
                            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold px-3.5 py-1 rounded-full text-xs transition"
                          >
                            {submitting ? '...' : t('reply', 'Reply')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductTabs;
