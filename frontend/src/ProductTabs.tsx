import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
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
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-medium'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
          onClick={() => setActiveTab('reviews')}
        >
          Verified Reviews ({reviews.length})
        </button>
        <button
          className={`py-2 px-4 transition-colors ${
            activeTab === 'comments'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-medium'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
          onClick={() => setActiveTab('comments')}
        >
          Community Comments ({comments.length})
        </button>
      </div>

      <div className="py-4">
        {activeTab === 'reviews' && (
          <div className="animate-fade-in">
            <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Verified Purchases Only</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Reviews are locked until order status is COMPLETED.
            </p>

            {loadingReviews ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-gray-400 py-8 text-center">No reviews yet. Be the first to review after purchase!</p>
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
            <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Ask a Question</h3>

            {/* Comment Form */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-2 mb-6">
              <textarea
                className="w-full bg-transparent outline-none dark:text-white resize-none"
                placeholder="Write a comment..."
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button
                onClick={handlePostComment}
                disabled={submitting || !commentText.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded mt-2 text-sm transition"
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </div>

            {loadingComments ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-gray-400 py-4 text-center">No comments yet. Start the conversation!</p>
            ) : (
              <div className="space-y-4">
                {parentComments.map((comment) => (
                  <div key={comment.id} className="space-y-2">
                    <div className={`p-4 rounded-lg border ${comment.username === sellerUsername ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{comment.username}</span>
                          {comment.username === sellerUsername && (
                            <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Owner</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{comment.body}</p>
                      <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition">
                        {replyingTo === comment.id ? 'Cancel Reply' : 'Reply'}
                      </button>
                    </div>

                    {/* Replies */}
                    {getReplies(comment.id).length > 0 && (
                      <div className="ml-8 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                        {getReplies(comment.id).map((reply) => (
                          <div key={reply.id} className={`p-3 rounded-lg border ${reply.username === sellerUsername ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-white text-sm">{reply.username}</span>
                                {reply.username === sellerUsername && (
                                  <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Owner</span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400">{formatDate(reply.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{reply.body}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {replyingTo === comment.id && (
                      <div className="ml-8 pl-4 flex gap-2">
                        <input
                          type="text"
                          className="flex-1 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:text-white outline-none focus:border-blue-500"
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
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
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-1.5 rounded-lg text-sm transition"
                        >
                          {submitting ? '...' : 'Reply'}
                        </button>
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
