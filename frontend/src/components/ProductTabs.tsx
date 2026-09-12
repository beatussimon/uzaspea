import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Star, MessageSquare, CheckCircle2, CornerDownRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import toast from 'react-hot-toast';
import SafeImage from './SafeImage';
import { timeAgo } from '../utils/timeAgo';
import VerifiedBadge from './VerifiedBadge';
import { useAuth } from '../context/AuthContext';

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
  isDesktop?: boolean;
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'reviews' | 'comments'>('reviews');

  // Reviews state & pagination
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsCount, setReviewsCount] = useState<number>(0);
  const [reviewsPage, setReviewsPage] = useState<number>(1);
  const [hasMoreReviews, setHasMoreReviews] = useState<boolean>(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const reviewsSentinelRef = useRef<HTMLDivElement>(null);

  // Comments state & pagination
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [commentsPage, setCommentsPage] = useState<number>(1);
  const [hasMoreComments, setHasMoreComments] = useState<boolean>(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const commentsSentinelRef = useRef<HTMLDivElement>(null);

  const [commentText, setCommentText] = useState('');
  const [isCommentFocused, setIsCommentFocused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Collapsible replies & incremental loading
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [visibleRepliesCount, setVisibleRepliesCount] = useState<Record<number, number>>({});

  const toggleReplies = (commentId: number) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const parentComments = useMemo(() => comments.filter(c => !c.parent), [comments]);
  const getReplies = (parentId: number) => 
    comments
      .filter((c) => c.parent === parentId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return sum / reviews.length;
  }, [reviews]);

  // Initial load for both reviews and comments
  useEffect(() => {
    let isMounted = true;
    setLoadingReviews(true);
    setLoadingComments(true);
    setReviewsPage(1);
    setCommentsPage(1);

    // Initial reviews page 1
    api.get(`/api/reviews/?product=${productId}&page=1`)
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.results || (Array.isArray(res.data) ? res.data : []);
        setReviews(list);
        setReviewsCount(typeof res.data?.count === 'number' ? res.data.count : list.length);
        setHasMoreReviews(Boolean(res.data?.next));
      })
      .catch(() => {
        if (isMounted) toast.error(t('failed_to_load_reviews', 'Failed to load reviews'));
      })
      .finally(() => {
        if (isMounted) setLoadingReviews(false);
      });

    // Initial comments page 1
    api.get(`/api/comments/?product=${productId}&page=1`)
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.results || (Array.isArray(res.data) ? res.data : []);
        setComments(list);
        setCommentsCount(typeof res.data?.count === 'number' ? res.data.count : list.length);
        setHasMoreComments(Boolean(res.data?.next));
      })
      .catch(() => {
        if (isMounted) toast.error(t('failed_to_load_comments', 'Failed to load comments'));
      })
      .finally(() => {
        if (isMounted) setLoadingComments(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productId, t]);

  // Infinite Scroll: Load More Reviews
  const loadMoreReviews = async () => {
    if (!hasMoreReviews || loadingReviews || loadingMoreReviews) return;
    setLoadingMoreReviews(true);
    try {
      const nextPage = reviewsPage + 1;
      const res = await api.get(`/api/reviews/?product=${productId}&page=${nextPage}`);
      const rawList = res.data?.results || (Array.isArray(res.data) ? res.data : []);
      if (rawList.length > 0) {
        setReviews((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const uniqueNew = rawList.filter((r: Review) => !existingIds.has(r.id));
          return [...prev, ...uniqueNew];
        });
        setReviewsPage(nextPage);
        setHasMoreReviews(Boolean(res.data?.next));
      } else {
        setHasMoreReviews(false);
      }
    } catch (err) {
      console.error('Failed to load more reviews:', err);
      setHasMoreReviews(false);
    } finally {
      setLoadingMoreReviews(false);
    }
  };

  // Infinite Scroll: Load More Comments
  const loadMoreComments = async () => {
    if (!hasMoreComments || loadingComments || loadingMoreComments) return;
    setLoadingMoreComments(true);
    try {
      const nextPage = commentsPage + 1;
      const res = await api.get(`/api/comments/?product=${productId}&page=${nextPage}`);
      const rawList = res.data?.results || (Array.isArray(res.data) ? res.data : []);
      if (rawList.length > 0) {
        setComments((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const uniqueNew = rawList.filter((c: Comment) => !existingIds.has(c.id));
          return [...prev, ...uniqueNew];
        });
        setCommentsPage(nextPage);
        setHasMoreComments(Boolean(res.data?.next));
      } else {
        setHasMoreComments(false);
      }
    } catch (err) {
      console.error('Failed to load more comments:', err);
      setHasMoreComments(false);
    } finally {
      setLoadingMoreComments(false);
    }
  };

  // IntersectionObserver for Reviews tab
  useEffect(() => {
    if (activeTab !== 'reviews' || !hasMoreReviews || loadingReviews || loadingMoreReviews) return;
    const sentinel = reviewsSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreReviews();
        }
      },
      { root: null, rootMargin: '300px', threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, hasMoreReviews, loadingReviews, loadingMoreReviews, reviewsPage, productId]);

  // IntersectionObserver for Comments tab
  useEffect(() => {
    if (activeTab !== 'comments' || !hasMoreComments || loadingComments || loadingMoreComments) return;
    const sentinel = commentsSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreComments();
        }
      },
      { root: null, rootMargin: '300px', threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, hasMoreComments, loadingComments, loadingMoreComments, commentsPage, productId]);

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/api/comments/', {
        product: productId,
        body: commentText,
      });
      setComments((prev) => [res.data, ...prev]);
      setCommentsCount((prev) => prev + 1);
      setCommentText('');
      setIsCommentFocused(false);
      toast.success(t('comment_posted', 'Comment posted!'));
    } catch {
      toast.error(t('login_to_post_comment', 'Login to post comments'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostReply = async (parentId: number) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/api/comments/', {
        product: productId,
        body: replyText,
        parent: parentId,
      });
      setComments((prev) => [...prev, res.data]);
      setReplyText('');
      setReplyingTo(null);
      // Auto-expand replies for this comment and show chevron
      setExpandedReplies((prev) => new Set(prev).add(parentId));
      setVisibleRepliesCount((prev) => {
        const current = prev[parentId] || 3;
        const newTotal = getReplies(parentId).length + 1;
        return { ...prev, [parentId]: Math.max(current, newTotal) };
      });
      toast.success(t('reply_posted', 'Reply posted!'));
    } catch {
      toast.error(t('failed_to_post_reply', 'Failed to post reply'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Standardized Tabs Navigation - Sticky */}
      <div className="lg:sticky lg:top-0 z-20 bg-white dark:bg-[#18191a] lg:px-6 lg:pt-6 pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-6 flex items-center gap-8">
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
            {reviewsCount}
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
            {commentsCount}
          </span>
          {activeTab === 'comments' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="lg:px-6 lg:pb-6">
        {/* ================= REVIEWS TAB ================= */}
        {activeTab === 'reviews' && (
          <div className="animate-fade-in space-y-6">
            {/* Overall Rating Summary Bar */}
            {reviews.length > 0 && (
              <div className="py-2 flex flex-col sm:flex-row items-center sm:items-stretch gap-6">
                <div className="flex flex-col items-center justify-center sm:pr-6 min-w-[130px]">
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
                    {reviews.length} {reviews.length === 1 ? t('verified_review', 'verified review') : t('verified_reviews', 'verified reviews')}
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
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                  <Star size={22} className="stroke-[1.5]" />
                </div>
                <p className="font-bold text-sm text-neutral-900 dark:text-white mb-1">{t('no_reviews_yet', 'No reviews yet')}</p>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  {t('reviews_buyers_only', 'Only verified buyers who completed their order can leave product reviews.')}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="flex gap-3.5 group">
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
                              {t('seller', 'Seller')}
                            </span>
                          )}
                        </span>

                        {/* Verified Purchase Badge */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} className="stroke-[2.5]" />
                          {t('verified_purchase', 'Verified Purchase')}
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

                {/* Sentinel & Loader for Infinite Reviews */}
                {hasMoreReviews && (
                  <div ref={reviewsSentinelRef} className="w-full py-6 flex justify-center items-center">
                    {loadingMoreReviews && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                        <span>{t('loading_more_reviews', 'Loading more reviews...')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= COMMENTS TAB ================= */}
        {activeTab === 'comments' && (
          <div className="animate-fade-in space-y-6">
            {/* YouTube-style Comment Composer */}
            <div className="flex gap-3.5 items-center pb-2">
              <UserAvatar 
                username={user?.username || 'U'} 
                profilePicture={user?.profile_picture} 
                size="md" 
              />
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onFocus={() => setIsCommentFocused(true)}
                  placeholder={t('add_a_comment', 'Add a comment...')}
                  className="w-full bg-transparent border-0 border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-900 dark:focus:border-white text-sm py-1.5 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none outline-none ring-0 shadow-none focus:shadow-none dark:text-white placeholder:text-neutral-500 rounded-none transition-colors"
                  style={{ outline: 'none', boxShadow: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                />
                {(isCommentFocused || commentText.trim()) && (
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCommentText('');
                        setIsCommentFocused(false);
                      }}
                      className="px-4 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition"
                    >
                      {t('cancel', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handlePostComment}
                      disabled={submitting || !commentText.trim()}
                      className="px-4 py-1.5 text-xs font-bold rounded-full transition flex items-center gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-neutral-900 dark:disabled:hover:bg-white disabled:cursor-not-allowed"
                    >
                      {submitting && <Loader2 size={12} className="animate-spin" />}
                      <span>{submitting ? t('commenting', 'Commenting...') : t('comment', 'Comment')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Comments Feed */}
            {loadingComments ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                  <MessageSquare size={22} className="stroke-[1.5]" />
                </div>
                <p className="font-bold text-sm text-neutral-900 dark:text-white mb-1">{t('no_comments_yet', 'No questions or comments yet')}</p>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  {t('ask_seller_notice', 'Have a question about this item? Ask the seller above and receive verified answers.')}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {parentComments.map((comment) => {
                  const commentReplies = getReplies(comment.id);
                  const isExpanded = expandedReplies.has(comment.id);
                  const currentLimit = visibleRepliesCount[comment.id] || 3;
                  const visibleReplies = commentReplies.slice(0, currentLimit);
                  const hasMoreReplies = commentReplies.length > currentLimit;

                  return (
                    <div key={comment.id} className="space-y-3">
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
                                  {t('seller', 'Seller')}
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
                              onClick={() => {
                                if (replyingTo === comment.id) {
                                  setReplyingTo(null);
                                  setReplyText('');
                                } else {
                                  setReplyingTo(comment.id);
                                  setReplyText('');
                                }
                              }} 
                              className="text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition flex items-center gap-1.5 py-0.5"
                            >
                              <CornerDownRight size={12} />
                              {replyingTo === comment.id ? t('cancel', 'Cancel') : t('reply', 'Reply')}
                            </button>
                          </div>

                          {/* Reply Input */}
                          {replyingTo === comment.id && (
                            <div className="mt-3 flex gap-2.5 items-center">
                              <UserAvatar 
                                username={user?.username || 'U'} 
                                profilePicture={user?.profile_picture} 
                                size="sm" 
                              />
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  className="w-full bg-transparent border-0 border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-900 dark:focus:border-white text-xs py-1.5 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none outline-none ring-0 shadow-none focus:shadow-none dark:text-white placeholder:text-neutral-500 rounded-none transition-colors"
                                  style={{ outline: 'none', boxShadow: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                                  placeholder={t('add_a_reply', 'Add a reply...')}
                                  autoFocus
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handlePostReply(comment.id);
                                    }
                                  }}
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                  <button 
                                    type="button"
                                    onClick={() => { setReplyingTo(null); setReplyText(''); }} 
                                    className="px-3 py-1 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition"
                                  >
                                    {t('cancel', 'Cancel')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePostReply(comment.id)}
                                    disabled={submitting || !replyText.trim()}
                                    className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-neutral-900 dark:disabled:hover:bg-white disabled:cursor-not-allowed font-bold px-3.5 py-1 rounded-full text-xs transition flex items-center gap-1"
                                  >
                                    {submitting && <Loader2 size={11} className="animate-spin" />}
                                    <span>{submitting ? '...' : t('reply', 'Reply')}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* YouTube-Style Collapsible Replies Expander Button */}
                          {commentReplies.length > 0 && (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => toggleReplies(comment.id)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 px-2.5 py-1 rounded-full transition"
                              >
                                <span>
                                  {commentReplies.length} {commentReplies.length === 1 ? t('reply', 'reply') : t('replies', 'replies')}
                                </span>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>
                          )}

                          {/* Threaded Replies (Hidden by default, revealed when isExpanded is true) */}
                          {isExpanded && commentReplies.length > 0 && (
                            <div className="ml-6 sm:ml-9 space-y-3 pt-2">
                              {visibleReplies.map((reply) => (
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
                                            {t('seller', 'Seller')}
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

                              {/* Incremental "Show more replies" if more than visible limit */}
                              {hasMoreReplies && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVisibleRepliesCount((prev) => ({
                                      ...prev,
                                      [comment.id]: (prev[comment.id] || 3) + 5,
                                    }));
                                  }}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white py-1 px-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                                >
                                  <CornerDownRight size={12} />
                                  <span>{t('show_more_replies', 'Show more replies')}</span>
                                  <span className="text-[11px] text-neutral-400">
                                    ({commentReplies.length - currentLimit})
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Sentinel & Loader for Infinite Comments */}
                {hasMoreComments && (
                  <div ref={commentsSentinelRef} className="w-full py-6 flex justify-center items-center">
                    {loadingMoreComments && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                        <span>{t('loading_more_comments', 'Loading more comments...')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductTabs;
