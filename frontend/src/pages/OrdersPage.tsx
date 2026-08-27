import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Package, ChevronDown, ChevronUp, CheckCircle2, CreditCard, Upload, MessageSquare, Smartphone, Truck, Shield, Receipt, Star, ExternalLink } from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';
import { useOrderTracking, TrackingUpdate } from '../hooks/useOrderTracking';

import { ORDER_STATUS_CONFIG as STATUS_CONFIG } from '../constants/orderStatus';
import ReviewModal from '../components/orders/ReviewModal';
import DisputeModal from '../components/orders/DisputeModal';
import ReceiptModal from '../components/orders/ReceiptModal';
import InvoiceReviewModal from '../components/cart/InvoiceReviewModal';
import PrintableInvoiceModal from '../components/orders/PrintableInvoiceModal';
import { useDialog } from '../components/ui/Dialogs';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const OrdersPage: React.FC = () => {
  const { user } = useAuth();
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

  // Receipt State
  const [reviewModalOrder, setReviewModalOrder] = useState<any | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const [printInvoiceOrder, setPrintInvoiceOrder] = useState<any | null>(null);

  // Bargain State


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

  const fetchOrders = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    api.get(`/api/orders/?page=${p}`)
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
  }, []);

  useEffect(() => {
    fetchOrders(1, true);
  }, [fetchOrders]);

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
  }, [hasMore, loadingMore, loading, fetchOrders]);

  useOrderTracking(
    'buyer', 
    (update: TrackingUpdate) => {
      api.get(`/api/orders/${update.order_id}/`)
        .then(res => {
          const updatedOrder = res.data;
          if (updatedOrder) {
            setOrders(prev => {
              return prev.map(o => o.id === update.order_id ? updatedOrder : o);
            });
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
            if (update.status === 'COMPLETED') {
                return prev.map(o => o.id === update.order_id ? { ...o, status: 'COMPLETED' } : o);
            }
            return prev.map(o => {
              if (o.id === update.order_id) {
                  const timelineEvent = {
                       status: update.status,
                       notes: update.notes,
                       created_at: update.timestamp
                  };
                  const updatedTimeline = [timelineEvent, ...(o.timeline_events || [])];
                  return { ...o, status: update.status, timeline_events: updatedTimeline };
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



  const filtered = useMemo(() => {
    if (!filterStatus) return orders;
    if (filterStatus === 'REQUESTED_INVOICE') {
      return orders.filter(o => o.status === 'REQUESTED_INVOICE' || o.status === 'BUYER_COUNTERED');
    }
    if (filterStatus === 'INVOICE_GENERATED') {
      return orders.filter(o => o.status === 'INVOICE_GENERATED');
    }
    return orders.filter(o => o.status === filterStatus);
  }, [orders, filterStatus]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: orders.length,
      REQUESTED_INVOICE: orders.filter(o => o.status === 'REQUESTED_INVOICE' || o.status === 'BUYER_COUNTERED').length,
      INVOICE_GENERATED: orders.filter(o => o.status === 'INVOICE_GENERATED').length,
    };
    orders.forEach(o => {
      if (o.status && o.status !== 'REQUESTED_INVOICE' && o.status !== 'BUYER_COUNTERED' && o.status !== 'INVOICE_GENERATED') {
        counts[o.status] = (counts[o.status] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  const activeStatuses = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.status && o.status !== 'REQUESTED_INVOICE' && o.status !== 'BUYER_COUNTERED' && o.status !== 'INVOICE_GENERATED') {
        set.add(o.status);
      }
    });
    return Array.from(set);
  }, [orders]);

  return (
    <div className="container-page max-w-4xl">
      <PageHeader
        title={t('outgoing_orders')}
        subtitle={t('track_manage_purchases', 'Track and manage your purchases')}
      />

      {loading ? (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-1">
          {[14, 28, 24, 20, 26].map((w, i) => (
            <div
              key={i}
              className="h-7 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0"
              style={{ width: `${w * 4}px` }}
            />
          ))}
        </div>
      ) : orders.length > 0 ? (
        <div data-horizontal-scroll="true" className="flex overflow-x-auto no-scrollbar gap-2 mb-6 select-none pb-1">
          <button
            onClick={() => setFilterStatus('')}
            className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${!filterStatus ? 'pill-active shadow-xs' : 'pill-inactive'}`}
          >
            <span>{t('all', 'All')}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              !filterStatus ? 'bg-white/20 text-inherit' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {orders.length}
            </span>
          </button>
          {(statusCounts.REQUESTED_INVOICE > 0 || filterStatus === 'REQUESTED_INVOICE') && (
            <button
              onClick={() => setFilterStatus('REQUESTED_INVOICE')}
              className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${
                filterStatus === 'REQUESTED_INVOICE'
                  ? 'pill-active border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 shadow-xs'
                  : 'pill-inactive'
              }`}
            >
              <Receipt size={14} className="inline mr-0.5" />
              <span>Requested Quotes</span>
              {statusCounts.REQUESTED_INVOICE > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  filterStatus === 'REQUESTED_INVOICE' ? 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {statusCounts.REQUESTED_INVOICE}
                </span>
              )}
            </button>
          )}
          {(statusCounts.INVOICE_GENERATED > 0 || filterStatus === 'INVOICE_GENERATED') && (
            <button
              onClick={() => setFilterStatus('INVOICE_GENERATED')}
              className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${
                filterStatus === 'INVOICE_GENERATED'
                  ? 'pill-active border-green-500 text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-300 shadow-xs'
                  : 'pill-inactive'
              }`}
            >
              <CheckCircle2 size={14} className="inline mr-0.5" />
              <span>Invoices Ready</span>
              {statusCounts.INVOICE_GENERATED > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  filterStatus === 'INVOICE_GENERATED' ? 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {statusCounts.INVOICE_GENERATED}
                </span>
              )}
            </button>
          )}
          {activeStatuses.map(s => {
            const count = statusCounts[s] || 0;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${filterStatus === s ? 'pill-active shadow-xs' : 'pill-inactive'}`}
              >
                <span>{t(`status.${s}`, STATUS_CONFIG[s]?.label || s) as string}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    filterStatus === s ? 'bg-white/20 text-inherit' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gray-200 dark:bg-gray-700 shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3" />
                  <div className="h-3.5 bg-gray-100 dark:bg-gray-700/60 rounded-md w-1/2" />
                </div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={orders.length === 0 ? t('no_orders_placed_title', "You haven't placed any orders yet.") : t('no_orders_status_title', "No orders with this status.")}
          action={{
            label: orders.length === 0 ? t('start_shopping', 'Start Shopping') : t('view_all_orders', 'View All Orders'),
            onClick: () => {
              if (orders.length === 0) {
                navigate('/');
              } else {
                setFilterStatus('');
              }
            },
          }}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((order: any) => {
            const isExpanded = expandedId === order.id;




            



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
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded">Order #{order.id}</span>
                        {order.is_bulk_order && (
                          <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700/50">
                            Bulk Order
                          </span>
                        )}
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
                            to={`/${order.items?.[0]?.seller_username}`}
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
                    
                    
                    {/* Invoice Review & Bargain */}
                    {order.status === 'INVOICE_GENERATED' && (
                      <div className="px-6 py-6 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
                        <div className="flex items-start gap-4">
                          <Receipt className="text-blue-600 shrink-0 mt-1" size={24} />
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Invoice Ready for Review</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                              The seller has reviewed your request and generated an invoice. 
                              Total: <span className="font-black text-gray-900 dark:text-white">TSh {parseInt(order.total_amount || 0).toLocaleString()}</span>.
                              You can accept the invoice or propose different prices.
                            </p>
                            
                            <div className="flex flex-wrap gap-3">
                              {/* Review & Negotiate Invoice */}
                              <button 
                                onClick={() => setReviewModalOrder(order)}
                                className="btn-primary py-2.5 px-6 text-sm font-bold flex items-center gap-2"
                              >
                                <Receipt size={16} />
                                Review & Accept Invoice
                              </button>
                              
                              {/* Bargain Price */}
                              <button
                                onClick={() => setReviewModalOrder(order)}
                                className="px-6 py-2.5 rounded-xl border-2 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm font-bold transition-all flex items-center gap-2"
                              >
                                <MessageSquare size={16} />
                                Negotiate Price
                              </button>
                              
                              {/* Print Invoice */}
                              <button
                                onClick={() => setPrintInvoiceOrder(order)}
                                className="px-6 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold transition-all flex items-center gap-2"
                              >
                                <Receipt size={16} />
                                Print Invoice
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Buyer Counter Offer Pending */}
                    {order.status === 'BUYER_COUNTERED' && (
                      <div className="px-6 py-6 bg-purple-50/50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-900/20">
                        <div className="flex items-start gap-4">
                          <MessageSquare className="text-purple-500 shrink-0 mt-1" size={24} />
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Counter Offer Sent</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              Your counter-offer has been sent to the seller. They will review your proposed prices and respond with a final invoice.
                            </p>
                            {order.negotiation_data?.note && (
                              <div className="bg-purple-100/50 dark:bg-purple-900/20 rounded-xl p-3 text-sm text-purple-700 dark:text-purple-300 italic border border-purple-200 dark:border-purple-800">
                                "{order.negotiation_data.note}"
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

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



                    <div className="p-4 sm:p-5 lg:p-6 flex flex-col lg:flex-row items-stretch">
                      
                      {/* Left Side: Codes & Items */}
                      <div className="flex-1 min-w-0 flex flex-col mb-6 lg:mb-0 lg:pr-6">


                        
                        {/* Soft Banner for Codes */}
                        {(order.delivery_code || pickupCodesMap[order.id]) && (
                          (order.fulfillment_type === 'SELLER_PICKUP' && ['PACKAGING', 'READY_FOR_PICKUP', 'DELIVERED', 'COMPLETED'].includes(order.status)) ||
                          (['ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'READY_FOR_VEHICLE_HANDOVER', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status))
                        ) && (
                          <div className="bg-brand-50/50 dark:bg-brand-900/10 rounded-xl border border-brand-100 dark:border-brand-900/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold text-brand-900 dark:text-brand-100 uppercase tracking-wider mb-0.5">
                                  {order.fulfillment_type === 'SELLER_PICKUP' ? 'Store Pickup Code' : (order.shipping_method === 'PICKUP' ? 'Warehouse Code' : 'Delivery Code')}
                                </p>
                                <p className="text-[11px] text-brand-700/80 dark:text-brand-300/80">
                                  {order.fulfillment_type === 'SELLER_PICKUP' 
                                    ? 'Show this 6-digit code to the seller to pick up your package.' 
                                    : 'Show this to the agent to collect your items.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-mono font-black text-2xl tracking-[0.2em] text-brand-600 dark:text-brand-400 bg-white/50 dark:bg-black/20 px-4 py-1.5 rounded-lg shadow-sm">
                                {order.fulfillment_type === 'SELLER_PICKUP' ? (order.delivery_code || '...') : (order.shipping_method === 'PICKUP' ? (pickupCodesMap[order.id] || order.delivery_code || '...') : (order.delivery_code || '...'))}
                              </span>
                              {(order.shipping_method === 'PICKUP' || order.fulfillment_type === 'SELLER_PICKUP') && (
                                 <QRCodeSVG value={(order.delivery_code || order.id).toString()} size={40} bgColor="transparent" fgColor="currentColor" className="text-brand-900 dark:text-brand-100 shrink-0" />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Order Items (Clean List) */}
                        <div className="mt-2">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 pl-1">Order Items</h4>
                            <div className="flex flex-col">
                              {order.items?.map((item: any, idx: number) => {
                                const isLast = idx === order.items.length - 1;
                                return (
                                <div key={item.id} className={`py-2 flex gap-4 ${isLast ? '' : 'border-b border-gray-200 dark:border-gray-700'}`}>
                                  <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400 font-bold shrink-0">{item.quantity}×</div>
                                  <div className="min-w-0 flex-1 pt-0.5">
                                      <Link to={`/product/${item.product_slug || item.slug || item.product}`} onClick={(e) => e.stopPropagation()} className="group flex items-center gap-1.5 w-fit max-w-full">
                                        <h5 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                          {item.product_name || item.name}
                                        </h5>
                                        <ExternalLink size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                      </Link>
                                      {item.variant_name && (
                                        <span className="inline-block px-1.5 py-0.5 mt-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 rounded uppercase tracking-wider">
                                          {item.variant_name}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-2 mt-1.5">
                                        {item.has_review && item.review ? (
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <div className="flex items-center gap-0.5 shrink-0">
                                              {[...Array(5)].map((_, i) => (
                                                <Star key={i} size={10} className={i < item.review.rating ? "text-amber-400 fill-amber-400" : "text-gray-300 dark:text-gray-600"} />
                                              ))}
                                            </div>
                                            {item.review.comment && <span className="text-[11px] text-gray-500 dark:text-gray-400 italic truncate max-w-[100px] sm:max-w-[150px]">"{item.review.comment}"</span>}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-gray-500 dark:text-gray-400 block">
                                              {item.catalog_price && Number(item.catalog_price) > Number(item.price) && (
                                                <span className="line-through text-gray-400 text-2xs mr-1">
                                                  TSh {parseInt(item.catalog_price).toLocaleString()}
                                                </span>
                                              )}
                                              {Number(item.price) > 0 ? `TSh ${parseInt(item.price).toLocaleString()} each` : 'TBD'}
                                          </span>
                                        )}
                                      </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                                        {Number(item.subtotal) > 0 ? `TSh ${parseInt(item.subtotal).toLocaleString()}` : 'TBD'}
                                      </span>
                                      {['COMPLETED', 'DELIVERED'].includes(order.status) && !item.has_review && (
                                        item.seller_username === user?.username ? (
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 py-1 bg-gray-50 dark:bg-gray-800/50 rounded flex items-center gap-1">
                                            Your Product
                                          </span>
                                        ) : (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); setReviewOrderId(order.id); setReviewProduct(item); }}
                                            className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 px-2 py-1 rounded transition flex items-center gap-1"
                                          >
                                            <Star size={12} className="text-brand-500" /> Review
                                          </button>
                                        )
                                      )}
                                  </div>
                                </div>
                              )})}
                            </div>
                            
                            {/* Receipt Summary Footer */}
                            <div className="mt-1 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex justify-end">
                                <div className="w-full sm:w-72 space-y-2">
                                  <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Subtotal</span>
                                      <span className="text-gray-900 dark:text-white font-medium">TSh {(parseInt(order.total_amount || 0) - parseInt(order.shipping_fee || 0)).toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between text-sm items-center">
                                      <span className="text-gray-500">Delivery</span>
                                      {Number(order.shipping_fee) > 0 ? (
                                          <span className="text-gray-900 dark:text-white font-medium">
                                              TSh {parseInt(order.shipping_fee).toLocaleString()}
                                          </span>
                                      ) : ['COMPLETED', 'DELIVERED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'SHIPPED', 'ASSIGNED_TRANSPORT'].includes(order.status) ? (
                                          <span className="text-green-600 font-medium">FREE</span>
                                      ) : (
                                          <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">TBD</span>
                                      )}
                                  </div>
                                  <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-baseline">
                                      <span className="text-sm font-bold text-gray-900 dark:text-white">Total</span>
                                      <span className="text-lg font-black text-gray-900 dark:text-white">TSh {parseInt(order.total_amount).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                        </div>
                      </div>

                      {/* Right Side: Timeline & Actions */}
                      <div className="w-full lg:w-72 shrink-0 flex flex-col pt-6 lg:pt-0 border-t border-gray-200 dark:border-gray-700 lg:border-t-0 lg:border-l lg:pl-6">
                        
                        {/* Enhanced Vertical Timeline */}
                        <div className="flex-1 flex flex-col min-h-[160px] lg:min-h-0 relative">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 shrink-0">Timeline</h4>
                          <div className="max-h-[160px] lg:max-h-none lg:absolute lg:top-8 lg:bottom-0 lg:left-0 lg:right-0 overflow-y-auto pr-2 -mr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                            <div className="space-y-4 relative pl-3.5 border-l-2 border-gray-200 dark:border-gray-700 ml-1.5 py-1">
                              {order.timeline_events?.slice().reverse().map((ev: any, i: number) => {
                                const isLatest = i === 0;
                                return (
                                <div key={i} className="relative">
                                  <div className={`absolute -left-[19.5px] w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${isLatest ? 'bg-brand-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-300 dark:bg-gray-700'}`} />
                                  <div className={`ml-4 ${isLatest ? 'opacity-100' : 'opacity-60 hover:opacity-100 transition-opacity'}`}>
                                      <p className={`text-xs font-bold ${isLatest ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{STATUS_CONFIG[ev.status]?.label || ev.status}</p>
                                      {isLatest && ev.notes && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{ev.notes}</p>}
                                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{fmtDate(ev.created_at)}</p>
                                  </div>
                                </div>
                            )})}
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions (Bottom Right) */}
                        <div className="pt-4 mt-auto flex justify-end gap-2 shrink-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setReceiptOrder(order); }}
                              className="btn-secondary py-1.5 px-3 text-xs bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                            >
                                <Receipt size={12} className="inline mr-1" /> Receipt
                            </button>
                            {['AWAITING_PAYMENT', 'PENDING_VERIFICATION'].includes(order.status) && (
                                <button onClick={(e) => { e.stopPropagation(); handleCancel(order.id); }} className="btn-secondary py-1.5 px-3 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100 dark:border-red-900/20">Cancel</button>
                            )}
                            {order.status === 'DELIVERED' && (
                                <button onClick={(e) => { e.stopPropagation(); handleReceived(order.id); }} className="btn-primary py-1.5 px-3 text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100">Confirm</button>
                            )}
                            {order.status === 'DELIVERED' && !order.dispute && (
                                <button onClick={(e) => { e.stopPropagation(); setOpenDisputeId(order.id); }} className="btn-secondary py-1.5 px-3 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100 dark:border-red-900/20">Dispute</button>
                            )}
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

      {/* Receipt Modal */}
      {receiptOrder && (
        <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}

      {/* Invoice Review Modal */}
      {reviewModalOrder && (
        <InvoiceReviewModal
          isOpen={!!reviewModalOrder}
          onClose={() => setReviewModalOrder(null)}
          order={reviewModalOrder}
          onOrderUpdated={() => fetchOrders(1, true)}
        />
      )}

      {/* Printable Invoice Modal */}
      {printInvoiceOrder && (
        <PrintableInvoiceModal
          order={printInvoiceOrder}
          onClose={() => setPrintInvoiceOrder(null)}
        />
      )}
    </div>
  );
};

export default OrdersPage;
