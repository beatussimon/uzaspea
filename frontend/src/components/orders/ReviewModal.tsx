import React, { useState } from 'react';
import { XCircle, Star } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

interface ReviewModalProps {
  orderId: number;
  product: any;
  onClose: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ orderId, product, onClose }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    
    setSubmittingReview(true);
    try {
      await api.post('/api/reviews/', {
        product: product.product,
        order: orderId,
        rating,
        comment
      });
      toast.success('Review submitted successfully!');
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || err.response?.data?.[0] || 'Failed to submit review';
      toast.error(msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="card w-full max-w-md p-6 animate-slide-up shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-600" />
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
            </button>
            
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Leave a Review</h3>
                <p className="text-sm text-gray-500 mt-1">Reviewing: <span className="font-bold text-gray-700 dark:text-gray-300">{product?.product_name}</span></p>
            </div>
            
            <form onSubmit={handleReviewSubmit} className="space-y-6">
                <div className="flex flex-col items-center gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Rate this Item</label>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <button key={s} type="button" onClick={() => setRating(s)} className="transition-transform hover:scale-110 active:scale-95">
                                <Star 
                                  size={32} 
                                  fill={s <= rating ? "#f59e0b" : "none"} 
                                  className={s <= rating ? "text-yellow-500" : "text-gray-300"} 
                                />
                            </button>
                        ))}
                    </div>
                    <span className="text-sm font-bold text-yellow-600">
                        {rating === 5 ? 'Excellent!' : rating === 1 ? 'Poor' : 'Good'}
                    </span>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Your Experience</label>
                    <textarea 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        required
                        rows={4}
                        placeholder="Tell us what you liked (or didn't liked) about this product..."
                        className="input text-sm resize-none"
                    />
                </div>
                
                <button 
                    type="submit" 
                    disabled={submittingReview}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base font-bold shadow-lg shadow-brand-600/20"
                >
                    {submittingReview ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Star size={20} />}
                    Post Review
                </button>
            </form>
        </div>
    </div>
  );
};

export default ReviewModal;
