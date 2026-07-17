import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Package, ChevronDown, ChevronUp, CheckCircle2, CreditCard, Upload, MessageSquare, Smartphone, Truck, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useOrderTracking, TrackingUpdate } from '../hooks/useOrderTracking';

import { ORDER_STATUS_CONFIG as STATUS_CONFIG, TRACKING_STEPS } from '../constants/orderStatus';
import ReviewModal from '../components/orders/ReviewModal';
import DisputeModal from '../components/orders/DisputeModal';
import { useDialog } from '../components/ui/Dialogs';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useTranslation } from 'react-i18next';

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const OrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showConfirm, showPrompt } = useDialog();
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

  // Seller & System Lipa Numbers State
  const [sellerLipa, setSellerLipa] = useState<Record<number, any[]>>({});
  const [systemLipa, setSystemLipa] = useState<any[]>([]);

  // Shipments & Pickup Codes State
  const [shipmentsMap, setShipmentsMap] = useState<Record<number, any>>({});
  const [pickupCodesMap, setPickupCodesMap] = useState<Record<number, string>>({});

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

  const [systemLipaLoaded, setSystemLipaLoaded] = useState(false);

  const fetchSystemLipa = async () => {
      if (systemLipaLoaded) return;
      try {
          const res = await api.get(`/api/lipa-numbers/?system=true&purpose=logistics`);
          setSystemLipa(res.data.results || res.data);
      } catch {}
      setSystemLipaLoaded(true);
  };

  const fetchShipment = async (order: any) => {
    if (shipmentsMap[order.id]) return;
    try {
      const res = await api.get(`/api/logistics/shipments/?order=${order.id}`);
      const data = res.data.results || res.data;
      if (Array.isArray(data) && data.length > 0) {
        setShipmentsMap(prev => ({ ...prev, [order.id]: data[0] }));
      }
    } catch {}
  };

  const fetchPickupCode = async (orderId: number) => {
    if (pickupCodesMap[orderId]) return;
    try {
      const res = await api.get(`/api/orders/${orderId}/pickup-code/`);
      setPickupCodesMap(prev => ({ ...prev, [orderId]: res.data.code }));
    } catch {}
  };

  const handleOrderExpand = (order: any) => {
    const isCurrentlyExpanded = expandedId === order.id;
    setExpandedId(isCurrentlyExpanded ? null : order.id);
    if (!isCurrentlyExpanded) {
      fetchSellerLipa(order);
      fetchShipment(order);
      if (['ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'READY_FOR_VEHICLE_HANDOVER'].includes(order.status)) {
        fetchPickupCode(order.id);
      }
      if (order.status === 'AWAITING_DELIVERY_PAYMENT') {
        fetchSystemLipa();
      }
    }
  };

  useEffect(() => {
    if (highlightId && orders.length > 0) {
      const id = parseInt(highlightId);
      setExpandedId(id);
      const order = orders.find(o => o.id === id);
      if (order) {
        fetchSellerLipa(order);
        fetchShipment(order);
        if (['ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'READY_FOR_VEHICLE_HANDOVER'].includes(order.status)) {
          fetchPickupCode(order.id);
        }
        if (order.status === 'AWAITING_DELIVERY_PAYMENT') {
          fetchSystemLipa();
        }
      }
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
        const incomingRaw = Array.isArray(data) ? data : [];
        const incoming = incomingRaw.filter(o => o.status !== 'CART' && o.status !== 'CHECKOUT');
        
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
      api.get(`/api/orders/${update.order_id}/`)
        .then(res => {
          const updatedOrder = res.data;
          if (updatedOrder) {
            setOrders(prev => prev.map(o => o.id === update.order_id ? updatedOrder : o));
            if (update.status === 'COMPLETED' && update.old_status !== 'COMPLETED') {
              if (updatedOrder.items && updatedOrder.items.length > 0) {
                setReviewOrderId(updatedOrder.id);
                setReviewProduct(updatedOrder.items[0]);
              }
            }
          }
        })
        .catch(() => {
          // Fallback to local state update
          setOrders(prev => {
            let targetOrder = prev.find(o => o.id === update.order_id);
            if (targetOrder && update.status === 'COMPLETED' && targetOrder.status !== 'COMPLETED') {
              if (targetOrder.items && targetOrder.items.length > 0) {
                setReviewOrderId(targetOrder.id);
                setReviewProduct(targetOrder.items[0]);
              }
            }
            return prev.map(o => {
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
            });
          });
        });
    },
    true
  );

  const handleProofSubmit = async (orderId: number) => {
    if (!proofFile || !transactionId) return toast.error('Please provide both a transaction ID and a receipt screenshot');
    
    setSubmittingProof(orderId);
    const order = orders.find(o => o.id === orderId);
    const newStatus = order?.status === 'AWAITING_DELIVERY_PAYMENT' ? 'PENDING_DELIVERY_VERIFICATION' : 'PENDING_VERIFICATION';
    
    const formData = new FormData();
    formData.append('status', newStatus);
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
    const reason = await showPrompt('Why are you cancelling this order?', 'Enter cancellation reason...');
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
    const confirmed = await showConfirm('Have you received all items in this order? This will finalize the order.', 'Confirm Delivery');
    if (!confirmed) return;
    
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
    return (
      <div className="flex justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="container-page max-w-4xl">
      <PageHeader
        title={t('outgoing_orders')}
        subtitle={t('track_manage_purchases', 'Track and manage your purchases')}
      />

      {activeStatuses.length > 1 && (
        <div className="flex overflow-x-auto no-scrollbar gap-2 mb-6 select-none">
          <button
            onClick={() => setFilterStatus('')}
            className={`pill text-xs ${!filterStatus ? 'pill-active' : 'pill-inactive'}`}
          >
            {t('all', 'All')} ({orders.length})
          </button>
          {activeStatuses.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`pill text-xs ${filterStatus === s ? 'pill-active' : 'pill-inactive'}`}
            >
              {t(`status.${s}`, STATUS_CONFIG[s]?.label || s) as string}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={orders.length === 0 ? t('no_orders_placed_title', "You haven't placed any orders yet.") : t('no_orders_status_title', "No orders with this status.")}
          action={{
            label: t('start_shopping', 'Start Shopping'),
            onClick: () => navigate('/'),
          }}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((order: any) => {
            const isExpanded = expandedId === order.id;
            const isActuallyWarehouse = ['SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'SHIPPED_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE', 'ASSIGNED_TRANSPORT', 'READY_FOR_PICKUP'].includes(order.status) || order.timeline_events?.some((ev: any) => ['SHIPPED_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE'].includes(ev.status));

            const trackingSteps = (order.has_vehicles && !isActuallyWarehouse)
              ? ['PAID', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED']
              : TRACKING_STEPS;
            
            const getEffectiveTrackingStatus = (st: string) => {
              if (trackingSteps.includes(st)) return st;
              
              if (order.has_vehicles && !isActuallyWarehouse) {
                 if (st === 'AWAITING_PAYMENT' || st === 'PENDING_VERIFICATION' || st === 'CART' || st === 'CHECKOUT') return trackingSteps[0]; // fallback
                 if (['SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'SHIPPED_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE', 'ASSIGNED_TRANSPORT'].includes(st)) return 'PROCESSING';
                 if (st === 'ARRIVED_AT_REGIONAL_WAREHOUSE' || st === 'READY_FOR_VEHICLE_HANDOVER' || st === 'READY_FOR_PICKUP') return 'SHIPPED';
                 return trackingSteps[0];
              }

              if (st === 'AWAITING_PAYMENT' || st === 'PENDING_VERIFICATION') return 'CHECKOUT';
              if (st === 'ASSIGNED_TRANSPORT') return 'RECEIVED_AT_WAREHOUSE';
              if (st === 'AWAITING_DELIVERY_PAYMENT' || st === 'PENDING_DELIVERY_VERIFICATION') return 'RECEIVED_AT_WAREHOUSE';
              if (st === 'READY_FOR_VEHICLE_HANDOVER') return 'ARRIVED_AT_REGIONAL_WAREHOUSE';
              return trackingSteps[0];
            };
            const currentStepIdx = trackingSteps.indexOf(getEffectiveTrackingStatus(order.status));

            return (
              <div id={`order-${order.id}`} key={order.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in hover:shadow-md transition-shadow">
                {/* Header */}
                <div role="button" tabIndex={0} onClick={() => handleOrderExpand(order)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOrderExpand(order);
                    }
                  }}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition group cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white">
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
                      {order.items?.length === 0 ? (
                        <span className="inline-block px-2 py-0.5 text-[9px] font-black rounded-full bg-red-100 text-red-600 mt-1">
                          Invalid Order
                        </span>
                      ) : (
                        <StatusBadge status={order.status} size="sm" className="mt-1" />
                      )}
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
                </div>

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

                    {/* Delivery Fee Payment section */}
                    {order.status === 'AWAITING_DELIVERY_PAYMENT' && (
                      <div className="px-6 py-8 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 border-b border-brand-700/50 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                        <div className="relative z-10 flex flex-col md:flex-row items-start gap-8">
                          <div className="flex-1 text-white">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-2.5 bg-brand-500/30 rounded-xl backdrop-blur-sm border border-brand-400/30">
                                <Truck className="text-brand-300" size={24} />
                              </div>
                              <h4 className="font-black text-xl tracking-tight">Delivery Payment Required</h4>
                            </div>
                            <p className="text-sm font-medium text-brand-100/90 leading-relaxed max-w-md mb-6">
                              Your items have been processed at our regional warehouse! The final, optimized delivery fee is <span className="font-black text-white text-lg bg-brand-950/40 px-2 py-0.5 rounded-md ml-1 inline-block">TSh {parseInt(order.shipping_fee || '0').toLocaleString()}</span>. 
                              Please pay this fee to our official platform accounts below to instantly dispatch your package to its final destination.
                            </p>
                            
                            <div className="mb-4">
                                <p className="text-[10px] font-bold text-brand-300/80 mb-2 uppercase tracking-widest">
                                    Official Logistics Payment Numbers:
                                </p>
                                {systemLipa.length === 0 ? (
                                    <p className="text-sm text-yellow-300/80 font-medium">
                                      {systemLipaLoaded
                                        ? 'No logistics payment numbers configured yet. Contact support for payment instructions.'
                                        : 'Loading payment numbers...'}
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-3">
                                        {systemLipa.map((lipa: any) => (
                                            <div key={lipa.id} className="flex-1 min-w-[240px] flex items-center gap-3 bg-brand-950/40 backdrop-blur-md border border-brand-400/20 rounded-xl p-3 shadow-xl">
                                                <div className={`rounded-lg bg-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-white/5 ${lipa.network_logo ? 'w-16 h-10' : 'w-10 h-10'}`}>
                                                    {lipa.network_logo ? (
                                                        <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain p-1" />
                                                    ) : (
                                                        <Smartphone size={20} className="text-brand-300" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-brand-300/70 uppercase">{lipa.network_name}</p>
                                                    <p className="font-mono font-black text-white text-sm tracking-wider">{lipa.number}</p>
                                                    <p className="text-[11px] text-brand-200/80">{lipa.name}</p>
                                                </div>
                                                <button onClick={() => {navigator.clipboard.writeText(lipa.number); toast.success('Copied!');}}
                                                    className="ml-auto text-[10px] py-1.5 px-3 bg-brand-500/20 hover:bg-brand-500/40 text-brand-100 font-bold uppercase tracking-wider rounded-lg transition border border-brand-400/30">Copy</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                          </div>
                          
                          <div className="w-full md:w-[340px] shrink-0 bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-2xl border border-brand-500/20">
                            <h5 className="font-bold text-gray-900 dark:text-white text-sm mb-4 flex items-center gap-2">
                                <Shield size={16} className="text-brand-500" /> Verify Payment
                            </h5>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Transaction ID / Reference</label>
                                <input 
                                  type="text" 
                                  value={transactionId} 
                                  onChange={(e) => setTransactionId(e.target.value)}
                                  placeholder="e.g. 8K91QW2R"
                                  className="input text-sm h-10 bg-gray-50 dark:bg-gray-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Receipt Screenshot (Required)</label>
                                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-brand-200 dark:border-brand-800/50 rounded-xl cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/10 transition group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload size={20} className="text-brand-400 group-hover:text-brand-600 transition mb-1" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-4">
                                          {proofFile ? <span className="text-brand-600 font-bold">{proofFile.name}</span> : 'Click to upload screenshot'}
                                        </p>
                                    </div>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                                </label>
                              </div>
                              <button 
                                disabled={submittingProof === order.id || !transactionId || !proofFile}
                                onClick={async () => {
                                  if (!proofFile || !transactionId) return toast.error('Please provide transaction ID and receipt');
                                  setSubmittingProof(order.id);
                                  const formData = new FormData();
                                  formData.append('status', 'ASSIGNED_TRANSPORT');
                                  formData.append('notes', 'Submitted delivery fee payment proof.');
                                  formData.append('transaction_id', transactionId);
                                  formData.append('proof_image', proofFile);
                                  
                                  try {
                                    await api.post(`/api/orders/${order.id}/advance/`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
                                    toast.success('Delivery fee paid successfully! Dispatching order...');
                                    setProofFile(null); setTransactionId('');
                                    fetchOrders(1, true);
                                  } catch (err: any) {
                                    toast.error(err.response?.data?.error || 'Failed to pay delivery fee');
                                  } finally {
                                    setSubmittingProof(null);
                                  }
                                }}
                                className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider rounded-xl transition shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
                              >
                                {submittingProof === order.id ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 size={18} />}
                                Confirm Payment
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Live Tracking Button */}
                    {(() => {
                      const shipment = shipmentsMap[order.id] || (order.shipments && order.shipments.length > 0 ? order.shipments[0] : null);
                      if (!shipment) return null;
                      return (
                        <div className="px-6 py-4 bg-amber-500/5 dark:bg-amber-500/10 border-b border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div>
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Live Delivery Tracking</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {shipment.driver_username ? `Driver Assigned: @${shipment.driver_username}. ` : 'No driver assigned yet. '}
                              This order has a vehicle transport shipment.
                            </p>
                          </div>
                          {['ASSIGNED_TRANSPORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'SHIPPED'].includes(order.status) && (
                            <Link 
                              to={`/shipments/${shipment.id}/track`}
                              className="btn-primary py-2 px-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                            >
                              <Truck size={14} />
                              Live Tracking Map
                            </Link>
                          )}
                        </div>
                      );
                    })()}

                    {/* Progress Tracker */}
                    {currentStepIdx >= 0 && (
                      <div className="px-6 py-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1">Journey of Your Package</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Follow your item every step of the way.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto overflow-y-hidden no-scrollbar pb-6">
                          <div className="flex items-start justify-between relative px-4 min-w-max gap-12">
                            {/* Track Wrapper */}
                            <div className="absolute top-[22px] left-[60px] right-[60px] h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(currentStepIdx / (trackingSteps.length - 1)) * 100}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" 
                              />
                            </div>
                            {trackingSteps.map((step, i) => {
                              const done = i < currentStepIdx;
                              const active = i === currentStepIdx;
                              const StepIcon = STATUS_CONFIG[step]?.icon || Package;
                              
                              return (
                                <div key={step} className="relative z-10 flex flex-col items-center w-28 group">
                                  {active && (
                                    <motion.div 
                                      animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                                      transition={{ repeat: Infinity, duration: 2 }}
                                      className={`absolute top-0 w-12 h-12 rounded-full blur-md ${STATUS_CONFIG[step]?.solidBg || 'bg-brand-500'}`}
                                    />
                                  )}
                                  <motion.div 
                                    whileHover={{ scale: 1.1 }}
                                    className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-500 shadow-sm ${
                                      done ? `${STATUS_CONFIG[step]?.solidBg || 'bg-brand-600'} text-white shadow-${(STATUS_CONFIG[step]?.color || 'text-brand-500').split('-')[1]}-500/30` : 
                                      active ? `bg-white dark:bg-gray-800 border-2 border-${(STATUS_CONFIG[step]?.color || 'text-brand-500').split('-')[1]}-500 ${STATUS_CONFIG[step]?.color || 'text-brand-600'} shadow-lg shadow-${(STATUS_CONFIG[step]?.color || 'text-brand-500').split('-')[1]}-500/20` : 
                                      'bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400'
                                    }`}
                                  >
                                    <StepIcon size={20} strokeWidth={active ? 2.5 : 2} />
                                    {done && (
                                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-900 rounded-full p-0.5">
                                            <CheckCircle2 size={12} className={STATUS_CONFIG[step]?.color || 'text-brand-600'} />
                                        </div>
                                    )}
                                  </motion.div>
                                  <div className="mt-4 text-center">
                                    <span className={`block text-[11px] font-black uppercase tracking-wider mb-1 transition-colors ${
                                      active ? STATUS_CONFIG[step]?.color || 'text-brand-600' : 
                                      done ? 'text-gray-900 dark:text-gray-200' : 
                                      'text-gray-400 dark:text-gray-500'
                                    }`}>
                                      {STATUS_CONFIG[step]?.label || step}
                                    </span>
                                    <span className={`block text-[10px] font-medium leading-tight px-1 ${active ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
                                        {active ? 'Happening now' : done ? 'Completed' : 'Upcoming'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delivery Code */}
                    {order.delivery_code && ['ARRIVED_AT_REGIONAL_WAREHOUSE', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status) && (
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

                    {/* Warehouse Pickup Code */}
                    {['ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'READY_FOR_VEHICLE_HANDOVER', 'DELIVERED', 'COMPLETED'].includes(order.status) && order.shipping_method === 'PICKUP' && (
                      <div className="px-6 py-5 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20 animate-pulse-subtle">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-black text-amber-900 dark:text-amber-100 uppercase tracking-wider mb-1">Your Warehouse Pickup Code</p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium max-w-sm font-semibold">
                              This order is ready for pickup at the warehouse. Please provide this code to the warehouse agent to collect your items.
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="bg-white dark:bg-gray-800 border-2 border-amber-200 dark:border-amber-800 rounded-xl px-6 py-3 shadow-md text-center">
                              <span className="font-mono font-black text-2xl tracking-[0.2em] text-amber-600 dark:text-amber-400">
                                {pickupCodesMap[order.id] || "Loading..."}
                              </span>
                            </div>
                            <div className="p-2 bg-white dark:bg-neutral-800 rounded-2xl shadow-lg shrink-0">
                              <QRCodeSVG value={order.id.toString()} size={80} bgColor="transparent" fgColor="currentColor" className="text-gray-900 dark:text-white" />
                            </div>
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
                                <span className="text-sm font-bold text-gray-900 dark:text-white block truncate">
                                  {item.product_name}
                                  {item.variant_name && <span className="ml-2 text-[10px] uppercase font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded tracking-wider align-middle">{item.variant_name}</span>}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Unit Price: TSh {parseInt(item.price).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-50 dark:border-gray-700">
                                <span className="font-bold text-gray-900 dark:text-white">TSh {parseInt(item.subtotal).toLocaleString()}</span>
                                {order.status === 'COMPLETED' && !item.has_review && (
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
                            {order.timeline_events?.slice().reverse().map((ev: any, i: number) => (
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
                                   "Thank you for choosing SokoniMax! Your satisfaction is our top priority."
                                </p>
                                
                                <div className="flex gap-2 mt-3 w-full">
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
                                    {order.status === 'COMPLETED' && order.items?.some((i: any) => !i.has_review) && (
                                        <button 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            const unreviewedItem = order.items?.find((i: any) => !i.has_review);
                                            if (unreviewedItem) {
                                              setReviewOrderId(order.id);
                                              setReviewProduct(unreviewedItem);
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
              <Spinner size="sm" />
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
            onSuccess={() => fetchOrders(1, true)}
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
