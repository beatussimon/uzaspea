import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Package, ChevronDown, ChevronUp, CheckCircle2, CreditCard, Upload, MessageSquare, Smartphone } from 'lucide-react';
import { useOrderTracking, TrackingUpdate } from '../hooks/useOrderTracking';

import { ORDER_STATUS_CONFIG as STATUS_CONFIG, TRACKING_STEPS } from '../constants/orderStatus';
import ReviewModal from '../components/orders/ReviewModal';
import DisputeModal from '../components/orders/DisputeModal';const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  
  // Payment Proof State
  const [submittingProof, setSubmittingProof] = useState<number | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [transactionId, setTransactionId] = useState('');

  // Review State
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
  const [reviewProduct, setReviewProduct] = useState<any>(null);

  // Dispute State
  const [openDisputeId, setOpenDisputeId] = useState<number | null>(null);

  // Seller Lipa Numbers State
  const [sellerLipa, setSellerLipa] = useState<Record<number, any[]>>({});

  const location = useLocation();
  const highlightId = new URLSearchParams(location.search).get('highlight');

  const fetchSellerLipa = async (order: any) => {
      if (order.status !== 'AWAITING_PAYMENT') return;
      const sellerUsername = order.items?.[0]?.seller_username;
      if (!sellerUsername || sellerLipa[order.id]) return;
      try {
          const res = await api.get(`/api/lipa-numbers/?seller=${sellerUsername}`);
          setSellerLipa(prev => ({ ...prev, [order.id]: res.data.results || res.data }));
      } catch {}
  };

  useEffect(() => {
    if (highlightId && orders.length > 0) {
      const id = parseInt(highlightId);
      setExpandedId(id);
      const order = orders.find(o => o.id === id);
      if (order) fetchSellerLipa(order);
      setTimeout(() => {
          document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400);
    }
  }, [highlightId, orders.length]);

  const fetchOrders = (p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    api.get(`/api/orders/?page=${p}${filterStatus ? `&status=${filterStatus}` : ''}`)
      .then((res) => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        
        if (reset) {
          setOrders(incoming);
        } else {
          setOrders((prev) => {
            const existingIds = new Set(prev.map(o => o.id));
            const uniqueIncoming = incoming.filter(o => !existingIds.has(o.id));
            return [...prev, ...uniqueIncoming];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load orders');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    fetchOrders(1, true);
  }, [filterStatus]);

  // Infinite Scroll Observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchOrders(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, filterStatus]);

  useOrderTracking(
    'buyer', 
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
    if (!proofFile || !transactionId) return toast.error('Please provide both a transaction ID and a receipt screenshot');
    
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
      fetchOrders(1, true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit proof');
    } finally {
      setSubmittingProof(null);
    }
  };

  const handleCancel = async (orderId: number) => {
    const reason = prompt('Why are you cancelling this order?');
    if (reason === null) return;
    
    try {
      await api.post(`/api/orders/${orderId}/cancel/`, { notes: reason || 'Cancelled by buyer.' });
      toast.success('Order cancelled successfully');
      fetchOrders(1, true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  const handleReceived = async (orderId: number) => {
    if (!confirm('Have you received all items in this order? This will finalize the order.')) return;
    
    try {
      await api.post(`/api/orders/${orderId}/advance/`, { status: 'COMPLETED', notes: 'Marked as received by buyer.' });
      toast.success('Order finalized! Thank you for shopping.');
      fetchOrders(1, true);
      
      const order = orders.find(o => o.id === orderId);
      if (order && order.items && order.items.length > 0) {
        setReviewOrderId(orderId);
        setReviewProduct(order.items[0]);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to complete order');
    }
  };



  const filtered = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;
  const activeStatuses = [...new Set(orders.map(o => o.status))];

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" /></div>;
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
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${!filterStatus ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              All ({orders.length})
            </button>
            {activeStatuses.map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${filterStatus === s ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
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
            const isExpanded = expandedId === order.id;
            const currentStepIdx = TRACKING_STEPS.indexOf(order.status);

            return (
              <div id={`order-${order.id}`} key={order.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in hover:shadow-md transition-shadow">
                {/* Header */}
                <button onClick={() => {
                  setExpandedId(isExpanded ? null : order.id);
                  if (!isExpanded) fetchSellerLipa(order);
                }}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition group">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative w-14 h-14 shrink-0">
                      <div className="w-full h-full rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden flex items-center justify-center">
                        {order.items?.[0]?.product_image ? (
                          <img src={order.items[0].product_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={20} className="text-gray-400" />
                        )}
                      </div>
                      {order.items?.length > 1 && (
                        <div className="absolute -bottom-1 -right-1 bg-brand-600 text-white text-[10px] font-black w-5 h-5 rounded-lg flex items-center justify-center border-2 border-white dark:border-gray-800">
                          +{order.items.length - 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded">Order #{order.id}</span>
                        <span className="text-[10px] font-bold text-gray-400">{fmtDate(order.order_date)}</span>
                      </div>
                      <h4 className="text-sm font-black text-gray-900 dark:text-white truncate uppercase">
                        {order.items?.length > 0 ? order.items[0].product_name : 'Incomplete Order (No Items Found)'}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 font-medium">Store:</span>
                        <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                          {order.items?.length > 0 ? `@${order.items[0].seller_username}` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="font-black text-gray-900 dark:text-white text-lg tracking-tight">TSh {parseInt(order.total_amount || 0).toLocaleString()}</p>
                      <span className={`inline-block px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-widest ${order.items?.length === 0 ? 'bg-red-100 text-red-600' : cfg.bg + ' ' + cfg.color} mt-1`}>
                        {order.items?.length === 0 ? 'Invalid Order' : cfg.label}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <Link 
                            to={`/profile/${order.items?.[0]?.seller_username}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition"
                            title="Contact Store"
                        >
                            <MessageSquare size={18} />
                        </Link>
                        {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                    </div>
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
                            <div className="mb-4">
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                                    Pay to these numbers:
                                </p>
                                {(sellerLipa[order.id] || []).length === 0 ? (
                                    <p className="text-sm text-yellow-600">The seller has not added payment numbers yet. Contact them directly.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-3">
                                        {(sellerLipa[order.id] || []).map((lipa: any) => (
                                            <div key={lipa.id} className="flex-1 min-w-[240px] flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                                                <div className={`rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 ${lipa.network_logo ? 'w-24 h-12' : 'w-12 h-12'}`}>
                                                    {lipa.network_logo ? (
                                                        <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <Smartphone size={24} className="text-green-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold text-gray-400 uppercase">{lipa.network_name}</p>
                                                    <p className="font-mono font-black text-gray-900 dark:text-white text-sm">{lipa.number}</p>
                                                    <p className="text-xs text-gray-500">{lipa.name}</p>
                                                </div>
                                                <button onClick={() => {navigator.clipboard.writeText(lipa.number); toast.success('Copied!');}}
                                                    className="ml-auto btn-ghost text-xs py-1 px-2 border border-gray-300 dark:border-gray-600 rounded">Copy</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Receipt Image (Required)</label>
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

                    {/* Delivery Code */}
                    {order.delivery_code && ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status) && (
                      <div className="px-6 py-5 bg-brand-50/50 dark:bg-brand-900/10 border-b border-brand-100 dark:border-brand-900/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-black text-brand-900 dark:text-brand-100 uppercase tracking-wider mb-1">Your Delivery Code</p>
                            <p className="text-xs text-brand-700 dark:text-brand-300 font-medium max-w-sm">
                              Please provide this 6-digit code to the deliverer or seller when you receive your items to finalize the delivery.
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 border-2 border-brand-200 dark:border-brand-800 rounded-xl px-6 py-3 shadow-inner text-center sm:text-left">
                            <span className="font-mono font-black text-2xl tracking-[0.2em] text-brand-600 dark:text-brand-400">
                              {order.delivery_code}
                            </span>
                          </div>
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
                                <div className="absolute -left-[21.5px] w-3 h-3 rounded-full bg-brand-500 border-2 border-white dark:border-gray-800 shadow-sm" />
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
                                        {/* FIX L-14: subtotal = total minus shipping */}
                                        <span className="text-gray-900 dark:text-white font-medium">TSh {(parseInt(order.total_amount || 0) - parseInt(order.shipping_fee || 0)).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Delivery Fee</span>
                                        <span className={order.shipping_fee > 0 ? "text-gray-900 dark:text-white font-medium" : "text-green-600 font-medium"}>
                                            {order.shipping_fee > 0 ? `TSh ${parseInt(order.shipping_fee).toLocaleString()}` : "FREE"}
                                        </span>
                                    </div>
                                    <hr className="border-gray-200 dark:border-gray-700" />
                                    <div className="flex justify-between text-base">
                                        <span className="font-bold text-gray-900 dark:text-white">Total Amount</span>
                                        <span className="font-black text-brand-600 dark:text-brand-400">TSh {parseInt(order.total_amount).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-4 p-3 bg-brand-50 dark:bg-brand-900/10 rounded-lg border border-brand-100 dark:border-brand-900/20 text-center relative group/footer flex flex-col items-center justify-center">
                                <p className="text-xs text-brand-800 dark:text-brand-300 font-medium italic">
                                   "Thank you for choosing UZASPEA! Your satisfaction is our top priority."
                                </p>
                                
                                <div className="flex gap-2 mt-3 w-full opacity-0 group-hover/footer:opacity-100 transition-opacity">
                                    {['AWAITING_PAYMENT', 'PENDING_VERIFICATION'].includes(order.status) && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleCancel(order.id); }}
                                          className="btn-secondary flex-1 py-1 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            Cancel Order
                                        </button>
                                    )}
                                    {order.status === 'DELIVERED' && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleReceived(order.id); }}
                                          className="btn-primary flex-1 py-1 text-[10px] bg-green-600 hover:bg-green-700"
                                        >
                                            Confirm Receipt
                                        </button>
                                    )}
                                    {order.status === 'COMPLETED' && (
                                        <button 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (order.items && order.items.length > 0) {
                                              setReviewOrderId(order.id);
                                              setReviewProduct(order.items[0]);
                                            }
                                          }}
                                          className="btn-primary flex-1 py-1 text-[10px] bg-yellow-500 hover:bg-yellow-600 border-none text-white shadow-sm"
                                        >
                                            Leave a Review
                                        </button>
                                    )}
                                    {order.status === 'DELIVERED' && !order.dispute && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); setOpenDisputeId(order.id); }}
                                          className="btn-secondary flex-1 py-1 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                        >
                                            Open Dispute
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {loadingMore && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            </div>
          )}

          {!hasMore && filtered.length > 0 && (
            <p className="text-center py-8 text-sm text-gray-400 dark:text-gray-500 font-medium">
              You've reached the end of your orders
            </p>
          )}
          
          <div ref={sentinelRef} className="h-4" />
        </div>
      )}

      {/* Review Modal */}
      {reviewOrderId && reviewProduct && (
        <ReviewModal 
            orderId={reviewOrderId} 
            product={reviewProduct} 
            onClose={() => { setReviewOrderId(null); setReviewProduct(null); }} 
        />
      )}

      {/* Dispute Modal */}
      {openDisputeId && (
        <DisputeModal 
            orderId={openDisputeId} 
            onClose={() => setOpenDisputeId(null)} 
            onSuccess={() => fetchOrders(1, true)} 
        />
      )}
    </div>
  );
};

export default OrdersPage;
