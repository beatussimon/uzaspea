import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from './api';
import toast from 'react-hot-toast';

interface Review {
  id: number;
  username: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface Comment {
  id: number;
  username: string;
  body: string;
  created_at: string;
  likes_count: number;
  parent: number | null;
}

export const ProductTabs = ({ productId, sellerUsername }: { productId: number, sellerUsername?: string }) => {
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

  const parentComments = comments.filter(c => !c.parent);
  const getReplies = (parentId: number) => comments.filter(c => c.parent === parentId);

  useEffect(() => {
    if (activeTab === 'reviews') {
      setLoadingReviews(true);
      api.get(`/api/reviews/?product=${productId}`)
        .then((res) => setReviews(res.data.results || res.data))
        .catch(() => toast.error('Failed to load reviews'))
        .finally(() => setLoadingReviews(false));
    } else {
      setLoadingComments(true);
      api.get(`/api/comments/?product=${productId}`)
        .then((res) => setComments(res.data.results || res.data))
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="mt-8 border-t dark:border-gray-700 pt-6">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`py-2 px-4 transition-colors ${
            activeTab === 'reviews'
              ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400 font-medium'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
          onClick={() => setActiveTab('reviews')}
        >
          {t('reviews_tab')} {reviews.length}
        </button>
        <button
          className={`py-2 px-4 transition-colors ${
            activeTab === 'comments'
              ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400 font-medium'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
          onClick={() => setActiveTab('comments')}
        >
          {t('comments_tab')} {comments.length}
        </button>
      </div>

      <div className="py-4">
        {activeTab === 'reviews' && (
          <div className="animate-fade-in">
            <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{t('verified_buyers')}</h3>

            {loadingReviews ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-gray-400 py-8 text-center">{t('no_reviews_tab')}</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">{review.username}</span>
                      <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
                    </div>
                    <div className="flex text-yellow-400 mb-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          className={s <= review.rating ? 'fill-current' : 'text-gray-300 dark:text-gray-600'}
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="animate-fade-in">
            <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{t('ask_a_question')}</h3>

            {/* Comment Form */}
            <div className="mt-2 mb-8 flex flex-col items-end">
              <textarea
                className="w-full bg-transparent border-x-0 border-t-0 border-b border-gray-300 dark:border-gray-700 pb-2 text-sm focus:ring-0 focus:outline-none dark:text-white resize-none focus:border-brand-600 dark:focus:border-gray-900 dark:focus:border-white transition-colors shadow-none"
                placeholder={t('add_a_comment')}
                rows={1}
                onFocus={(e) => e.target.rows = 3}
                onBlur={(e) => { if (!commentText.trim()) e.target.rows = 1; }}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="mt-3 flex justify-end gap-2 w-full">
                {commentText.trim() && (
                  <button
                    onClick={() => setCommentText('')}
                    className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition"
                  >
                    {t('cancel')}
                  </button>
                )}
                <button
                  onClick={handlePostComment}
                  disabled={submitting || !commentText.trim()}
                  className="bg-brand-600 hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500 text-white font-bold px-4 py-2 rounded-full text-sm transition"
                >
                  {submitting ? t('posting') : t('comment_btn')}
                </button>
              </div>
            </div>

            {loadingComments ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-gray-400 py-4 text-center">{t('no_comments')}</p>
            ) : (
              <div className="space-y-6 mt-6">
                {parentComments.map((comment) => (
                  <div key={comment.id} className="space-y-2">
                    <div className="flex gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-lg uppercase ${comment.username === sellerUsername ? 'bg-brand-600 text-white' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'}`}>
                        {comment.username.charAt(0)}
                      </div>
                      <div className="flex-1 flex flex-col pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[13px] font-bold ${comment.username === sellerUsername ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 px-2 py-0.5 rounded-full text-[11px]' : 'text-gray-900 dark:text-white'}`}>
                            {comment.username === sellerUsername ? comment.username : `@${comment.username}`}
                          </span>
                          <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-[14px] text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                            {replyingTo === comment.id ? t('cancel') : t('reply')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {getReplies(comment.id).length > 0 && (
                      <div className="ml-12 space-y-4 pt-2">
                        {getReplies(comment.id).map((reply) => (
                          <div key={reply.id} className="flex gap-3">
                            <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-bold text-xs uppercase ${reply.username === sellerUsername ? 'bg-brand-600 text-white' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'}`}>
                              {reply.username.charAt(0)}
                            </div>
                            <div className="flex-1 flex flex-col">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[12px] font-bold ${reply.username === sellerUsername ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 px-2 py-0.5 rounded-full text-[10px]' : 'text-gray-900 dark:text-white'}`}>
                                  {reply.username === sellerUsername ? reply.username : `@${reply.username}`}
                                </span>
                                <span className="text-[11px] text-gray-500">{formatDate(reply.created_at)}</span>
                              </div>
                              <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{reply.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {replyingTo === comment.id && (
                      <div className="ml-12 mt-2 flex flex-col items-end">
                        <input
                          type="text"
                          className="w-full bg-transparent border-x-0 border-t-0 border-b border-gray-300 dark:border-gray-600 pb-1 text-sm dark:text-white focus:ring-0 focus:outline-none focus:border-brand-600 dark:focus:border-gray-900 dark:focus:border-white transition-colors shadow-none"
                          placeholder={t('add_a_reply')}
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition">{t('cancel')}</button>
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
                            className="bg-brand-600 hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500 text-white font-bold px-4 py-1.5 rounded-full text-sm transition"
                          >
                            {submitting ? '...' : t('reply')}
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
