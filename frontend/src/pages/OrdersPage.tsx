import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Package, ChevronDown, ChevronUp, MapPin, Clock, CheckCircle2, Truck, XCircle, CreditCard, Upload, Star, MessageSquare } from 'lucide-react';
import { useOrderTracking, TrackingUpdate } from '../hooks/useOrderTracking';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  CART: { label: 'Cart', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700', icon: Package },
  CHECKOUT: { label: 'Checkout', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: Package },
  AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: CreditCard },
  PENDING_VERIFICATION: { label: 'Verifying Payment', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: Clock },
  PAID: { label: 'Paid', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  PROCESSING: { label: 'Processing', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: Package },
  SHIPPED: { label: 'Shipped', color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: MapPin },
  COMPLETED: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  EXPIRED: { label: 'Expired', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700', icon: XCircle },
};

const TRACKING_STEPS = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  
  // Payment Proof State
  const [submittingProof, setSubmittingProof] = useState<number | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [transactionId, setTransactionId] = useState('');

  // Review State
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
  const [reviewProduct, setReviewProduct] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchOrders = () => {
    api.get('/api/orders/')
      .then((res) => {
        const data = Array.isArray(res.data.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []);
        setOrders(data);
      })
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useOrderTracking(
    'seller', 
    (update: TrackingUpdate) => {
      setOrders(prev => prev.map(o => {
        if (o.id === update.order_id) {
            const timelineEvent = {
                 status: update.status,
                 notes: update.notes,
                 created_at: update.timestamp
            };
            const currentTimeline = o.timeline_events || [];
             return { ...o, status: update.status, timeline_events: [timelineEvent, ...currentTimeline] };
        }
        return o;
      }));
    },
    true
  );

  const handleProofSubmit = async (orderId: number) => {
    if (!proofFile && !transactionId) return toast.error('Please provide a transaction ID or upload a receipt');
    
    setSubmittingProof(orderId);
    const formData = new FormData();
    formData.append('status', 'PENDING_VERIFICATION');
    formData.append('transaction_id', transactionId);
    if (proofFile) formData.append('proof_image', proofFile);

    try {
      await api.post(`/api/orders/${orderId}/advance/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Payment proof submitted for verification');
      setProofFile(null);
      setTransactionId('');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit proof');
    } finally {
      setSubmittingProof(null);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewProduct) return;
    
    setSubmittingReview(true);
    try {
      await api.post('/api/reviews/', {
        product: reviewProduct.product,
        order: reviewOrderId,
        rating,
        comment
      });
      toast.success('Review submitted successfully!');
      setReviewOrderId(null);
      setReviewProduct(null);
      setComment('');
      setRating(5);
    } catch (err: any) {
      toast.error(err.response?.data?.[0] || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const filtered = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;
  const activeStatuses = [...new Set(orders.map(o => o.status))];

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="container-page py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Outgoing Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track and manage your purchases</p>
        </div>
        {activeStatuses.length > 1 && (
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterStatus('')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${!filterStatus ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              All ({orders.length})
            </button>
            {activeStatuses.map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {STATUS_CONFIG[s]?.label || s}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center shadow-sm">
          <Package size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 font-medium">{orders.length === 0 ? "You haven't placed any orders yet." : 'No orders with this status.'}</p>
          <Link to="/" className="btn-primary mt-4 inline-block">Start Shopping</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order: any) => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.CART;
            const Icon = cfg.icon;
            const isExpanded = expandedId === order.id;
            const currentStepIdx = TRACKING_STEPS.indexOf(order.status);

            return (
              <div key={order.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in hover:shadow-md transition-shadow">
                {/* Header */}
                <button onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cfg.bg} shadow-inner`}>
                      <Icon size={22} className={cfg.color} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Order #{order.id}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(order.order_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white">TSh {parseInt(order.total_amount).toLocaleString()}</p>
                      <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${cfg.bg} ${cfg.color} mt-1`}>
                        {cfg.label}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/10">
                    
                    {/* Offline Payment Instructions & Form */}
                    {order.status === 'AWAITING_PAYMENT' && (
                      <div className="px-6 py-6 bg-yellow-50/50 dark:bg-yellow-900/10 border-b border-yellow-100 dark:border-yellow-900/20">
                        <div className="flex items-start gap-4 mb-4">
                          <CreditCard className="text-yellow-600 shrink-0 mt-1" size={24} />
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Offline Payment Required</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              Please pay <strong>TSh {parseInt(order.total_amount).toLocaleString()}</strong> to any of the store's numbers (Lipa kwa M-Pesa/Tigo Pesa/Airtel Money) and upload your proof below.
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-4 max-w-lg">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Transaction ID / Reference</label>
                            <input 
                              type="text" 
                              value={transactionId} 
                              onChange={(e) => setTransactionId(e.target.value)}
                              placeholder="e.g. 5K97QW4R"
                              className="input text-sm h-10"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Receipt Image (Optional)</label>
                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload size={20} className="text-gray-400 mb-1" />
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {proofFile ? proofFile.name : 'Click to upload proof'}
                                    </p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                            </label>
                          </div>
                          <button 
                            disabled={submittingProof === order.id}
                            onClick={() => handleProofSubmit(order.id)}
                            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                          >
                            {submittingProof === order.id ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 size={18} />}
                            Submit Payment Proof
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Progress Tracker */}
                    {currentStepIdx >= 0 && (
                      <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6">Delivery Progress</p>
                        <div className="flex items-center justify-between relative px-2">
                          <div className="absolute top-4 left-6 right-6 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
                          <div className="absolute top-4 left-6 h-1 bg-green-500 transition-all duration-700 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                            style={{ width: `${(currentStepIdx / (TRACKING_STEPS.length - 1)) * 100}%`, maxWidth: 'calc(100% - 48px)' }} />
                          {TRACKING_STEPS.map((step, i) => {
                            const done = i <= currentStepIdx;
                            const active = i === currentStepIdx;
                            return (
                              <div key={step} className="relative z-10 flex flex-col items-center">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                                  done ? 'bg-green-500 border-green-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                                } ${active ? 'scale-110 ring-4 ring-green-100 dark:ring-green-900/30' : ''}`}>
                                  {done ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold">{i + 1}</span>}
                                </div>
                                <span className={`text-[10px] sm:text-xs mt-2.5 font-bold whitespace-nowrap uppercase tracking-tighter ${done ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                  {STATUS_CONFIG[step]?.label || step}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Items Section */}
                    <div className="px-6 py-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Order Details</p>
                        {order.status === 'COMPLETED' && (
                          <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">Finalized</span>
                        )}
                      </div>
                      <div className="space-y-4">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500 font-bold border border-gray-200 dark:border-gray-600">{item.quantity}×</div>
                              <div className="min-w-0">
                                <span className="text-sm font-bold text-gray-900 dark:text-white block truncate">{item.product_name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Unit Price: TSh {parseInt(item.price).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-50 dark:border-gray-700">
                                <span className="font-bold text-gray-900 dark:text-white">TSh {parseInt(item.subtotal).toLocaleString()}</span>
                                {order.status === 'COMPLETED' && (
                                  <button 
                                    onClick={() => { setReviewOrderId(order.id); setReviewProduct(item); }}
                                    className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition"
                                    title="Leave a Review"
                                  >
                                    <MessageSquare size={18} />
                                  </button>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timeline & Feedback */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700 border-t border-gray-100 dark:border-gray-700">
                        {/* Timeline */}
                        <div className="bg-gray-50/50 dark:bg-gray-800/50 px-6 py-5">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Activity Log</p>
                            <div className="space-y-4 relative pl-4 border-l-2 border-gray-200 dark:border-gray-700 py-1">
                            {order.timeline_events?.map((ev: any, i: number) => (
                                <div key={i} className="relative">
                                <div className="absolute -left-[21.5px] w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800 shadow-sm" />
                                <div className="ml-3">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{STATUS_CONFIG[ev.status]?.label || ev.status}</p>
                                    {ev.notes && <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">{ev.notes}</p>}
                                    <p className="text-[10px] text-gray-400 mt-1 font-medium">{fmtDate(ev.created_at)}</p>
                                </div>
                                </div>
                            ))}
                            </div>
                        </div>
                        
                        {/* Summary */}
                        <div className="bg-gray-50/50 dark:bg-gray-800/50 px-6 py-5 flex flex-col justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Payment Summary</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="text-gray-900 dark:text-white font-medium">TSh {parseInt(order.total_amount).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Delivery Fee</span>
                                        <span className="text-green-600 font-medium">FREE</span>
                                    </div>
                                    <hr className="border-gray-200 dark:border-gray-700" />
                                    <div className="flex justify-between text-base">
                                        <span className="font-bold text-gray-900 dark:text-white">Total Amount</span>
                                        <span className="font-black text-brand-600 dark:text-brand-400">TSh {parseInt(order.total_amount).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20 text-center">
                                <p className="text-xs text-blue-800 dark:text-blue-300 font-medium italic">
                                   "Thank you for choosing UZASPEA! Your satisfaction is our top priority."
                                </p>
                            </div>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewOrderId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="card w-full max-w-md p-6 animate-slide-up shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-600" />
                <button onClick={() => setReviewOrderId(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <XCircle size={24} />
                </button>
                
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Leave a Review</h3>
                    <p className="text-sm text-gray-500 mt-1">Reviewing: <span className="font-bold text-gray-700 dark:text-gray-300">{reviewProduct?.product_name}</span></p>
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
      )}
    </div>
  );
};

export default OrdersPage;
