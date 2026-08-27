import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Package, ShoppingCart, ChevronDown, ChevronUp, Eye, ShieldCheck, ShieldAlert, Truck, Clock, MessageSquare, XCircle, MapPin, X, Receipt, Search } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useOrderTracking, TrackingUpdate } from '../../hooks/useOrderTracking';
import { ORDER_STATUS_CONFIG as ORDER_STATUS_CFG, getSellerNextStatus } from '../../constants/orderStatus';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../../components/ui/Dialogs';
import { Spinner } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';

// ============ Incoming Orders (Seller) ============
const fmtOrderDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const getStatusExplanation = (status: string, fulfillmentType?: string) => {
  const isDirect = fulfillmentType === 'DIRECT_DELIVERY';
  switch (status) {
    case 'PENDING_VERIFICATION':
      return "Payment verification in progress. SokoniMax administration is reviewing the buyer's payment reference/receipt.";
    case 'SHIPPED_TO_WAREHOUSE':
      return "Items are currently en route to the SokoniMax Warehouse. Awaiting intake scan by warehouse staff.";
    case 'RECEIVED_AT_WAREHOUSE':
      return "Items have been safely received at the warehouse. Awaiting logistics staff to assign a driver or courier.";
    case 'ASSIGNED_TRANSPORT':
      return "Logistics staff has assigned a driver for delivery. Awaiting dispatch to put the shipment in transit.";
    case 'IN_TRANSIT':
      return isDirect
        ? "You have shipped the item directly. Awaiting buyer confirmation of receipt."
        : "The line-haul truck is currently en route to the destination warehouse.";
    case 'SHIPPED':
      return isDirect
        ? "You have shipped this order directly to the buyer. Mark as Delivered once the buyer has received it."
        : "The order has been shipped and is in transit.";
    case 'OUT_FOR_DELIVERY':
      return "The local courier is currently delivering the order. You can monitor the progress on the tracking map.";
    case 'ARRIVED_AT_REGIONAL_WAREHOUSE':
      return "Order has arrived at the regional destination warehouse. Awaiting final pickup code activation.";
    case 'READY_FOR_PICKUP':
      return "The order is ready for buyer collection. Awaiting the buyer to present their pickup code at the warehouse.";
    case 'DELIVERED':
      return "Items have been successfully delivered to the customer. Awaiting customer confirmation to finalize transaction.";
    case 'COMPLETED':
      return "This transaction has been successfully completed. Funds are credited to your seller account ledger.";
    case 'CANCELLED':
      return "This order has been cancelled.";
    case 'DISPUTED':
      return "A customer dispute has been opened for this order. SokoniMax support will contact you shortly.";
    default:
      return null;
  }
};

const DashboardOrders: React.FC = () => {
  const { t } = useTranslation();
  const { showPrompt } = useDialog();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState<number | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [shipModalOpen, setShipModalOpen] = useState<number | null>(null);
  const [shipNotes, setShipNotes] = useState('');
  const [shipWarehouseCode, setShipWarehouseCode] = useState('');

  useEffect(() => {
    api.get('/api/warehouses/warehouses/').then(res => {
      const list = res.data.results || res.data || [];
      setWarehouses(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  const fetchOrders = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }
    api.get(`/api/orders/incoming/?page=${p}&exclude_statuses=REQUESTED_INVOICE,INVOICE_GENERATED`)
      .then(res => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setOrders(incoming);
        else {
          setOrders(prev => {
            const ids = new Set(prev.map(o => o.id));
            return [...prev, ...incoming.filter(o => !ids.has(o.id))];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load incoming orders');
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

  useOrderTracking('seller', (update: TrackingUpdate) => {
    // Re-fetch the specific updated order to get full details (like payments list)
    api.get(`/api/orders/incoming/?order_id=${update.order_id}`)
      .then(res => {
        const data = res.data.results || res.data;
        const updatedOrder = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (updatedOrder) {
          setOrders(prev => prev.map(o => o.id === update.order_id ? updatedOrder : o));
        }
      })
      .catch(() => {
        // Fallback to local state update if fetch fails
        setOrders(prev => prev.map(o => {
          if (o.id === update.order_id) {
            const newTimelineEvent = {
              status: update.status,
              notes: update.notes,
              created_at: update.timestamp
            };
            const currentTimeline = o.timeline || [];
            return { ...o, status: update.status, timeline: [newTimelineEvent, ...currentTimeline] };
          }
          return o;
        }));
      });
  });

  const handleAdvance = async (orderId: number, nextStatus: string, notes: string = "", warehouseCode?: string) => {
    let delivery_code;
    if (nextStatus === 'DELIVERED' || nextStatus === 'COMPLETED') {
      delivery_code = await showPrompt(
        t('enter_delivery_code_title', 'Pickup / Delivery Code Verification'),
        t('enter_delivery_code_placeholder', 'Enter the 6-digit pickup code provided by the buyer...')
      );
      if (!delivery_code) return; // Cancel if no code provided
    }
    setAdvancing(orderId);
    try {
      const payload: any = { status: nextStatus, notes, delivery_code };
      if (warehouseCode) payload.warehouse_code = warehouseCode;
      
      await api.post(`/api/orders/${orderId}/advance/`, payload);
      toast.success(`Order #${orderId} moved to ${ORDER_STATUS_CFG[nextStatus]?.label || nextStatus}`);
      fetchOrders(1, true);
      setShipModalOpen(null);
    } catch (err: any) { 
      toast.error(err.response?.data?.error || 'Failed to update order'); 
    } finally { setAdvancing(null); }
  };

  const handleCancel = async (orderId: number) => {
    const reason = await showPrompt(
      t('cancel_order_reason_title', 'Cancel Order'),
      t('cancel_order_reason_placeholder', 'Enter cancellation reason (sent to customer):')
    );
    if (reason === null) return;
    setAdvancing(orderId);
    try {
      await api.post(`/api/orders/${orderId}/cancel/`, { notes: reason || 'Cancelled by seller.' });
      toast.success(`Order #${orderId} cancelled.`);
      fetchOrders(1, true);
    } catch { toast.error('Failed to cancel order'); }
    finally { setAdvancing(null); }
  };

  const orderTabs = [
    { key: '', label: t('all_orders', 'All Orders'), count: orders.length },
    { key: 'PENDING_VERIFICATION', label: t('to_verify', 'To Verify'), count: orders.filter(o => o.status === 'PENDING_VERIFICATION' || o.status === 'PENDING_DELIVERY_VERIFICATION').length, isAction: orders.some(o => o.status === 'PENDING_VERIFICATION' || o.status === 'PENDING_DELIVERY_VERIFICATION') },
    { key: 'PAID', label: t('ready_to_process', 'Ready to Process'), count: orders.filter(o => o.status === 'PAID').length },
    { key: 'PROCESSING', label: t('in_processing', 'In Processing'), count: orders.filter(o => ['PREPARING', 'PACKAGING', 'PROCESSING', 'SELLER_CONFIRMED'].includes(o.status)).length },
    { key: 'SHIPPED', label: t('in_transit_shipped', 'In Transit / Shipped'), count: orders.filter(o => ['SHIPPED_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE', 'ASSIGNED_TRANSPORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'SHIPPED'].includes(o.status)).length },
    { key: 'DELIVERED', label: t('delivered_done', 'Delivered / Done'), count: orders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status)).length },
    { key: 'CANCELLED', label: t('cancelled_disputed', 'Cancelled'), count: orders.filter(o => ['CANCELLED', 'DISPUTED'].includes(o.status)).length },
  ];

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Status filter
      if (filterStatus) {
        if (filterStatus === 'PENDING_VERIFICATION') {
          if (order.status !== 'PENDING_VERIFICATION' && order.status !== 'PENDING_DELIVERY_VERIFICATION') return false;
        } else if (filterStatus === 'PROCESSING') {
          if (!['PREPARING', 'PACKAGING', 'PROCESSING', 'SELLER_CONFIRMED'].includes(order.status)) return false;
        } else if (filterStatus === 'SHIPPED') {
          if (!['SHIPPED_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE', 'ASSIGNED_TRANSPORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'SHIPPED'].includes(order.status)) return false;
        } else if (filterStatus === 'DELIVERED') {
          if (!['DELIVERED', 'COMPLETED'].includes(order.status)) return false;
        } else if (filterStatus === 'CANCELLED') {
          if (!['CANCELLED', 'DISPUTED'].includes(order.status)) return false;
        } else if (order.status !== filterStatus) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = String(order.id).includes(q);
        const buyerMatch = (order.buyer || order.buyer_username || order.delivery_info?.customer_name || '').toLowerCase().includes(q);
        const itemMatch = (order.items || []).some((i: any) => (i.product_name || '').toLowerCase().includes(q));
        if (!idMatch && !buyerMatch && !itemMatch) return false;
      }

      return true;
    });
  }, [orders, filterStatus, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('incoming_orders', 'Incoming Orders')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('orders_desc', 'Track incoming customer orders, verify payments, manage shipments, and fulfill orders in real-time.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 border border-surface-border dark:border-surface-dark-border px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('live_view', 'Live View')}
          </span>
        </div>
      </header>

      {/* Filter Pills & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Horizontal Scroll Pill Bar */}
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {orderTabs.map((tab) => {
            const isActive = filterStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? tab.isAction
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-3xs font-black ${
                      isActive
                        ? tab.isAction
                          ? 'bg-white text-brand-600'
                          : 'bg-white/20 dark:bg-black/20 text-inherit'
                        : tab.isAction
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Box */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_orders', 'Search Order #, Buyer, Product...')}
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={t('no_orders_found', 'No Orders Found')}
          description={
            filterStatus || searchQuery
              ? t('no_orders_matching', 'No orders matching your selected filters.')
              : t('no_incoming_orders_yet', 'You have no incoming orders yet.')
          }
          action={
            filterStatus || searchQuery
              ? {
                  label: t('clear_filters', 'Clear Filters'),
                  onClick: () => {
                    setFilterStatus('');
                    setSearchQuery('');
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order: any) => {
            const isExpanded = expandedId === order.id;
            const itemsList = order.items || [];
            const nextStatus = getSellerNextStatus(
              order.status,
              order.fulfillment_type || 'PLATFORM_DELIVERY',
              order.has_vehicles
            );
            const isMainPayment = order.status === 'PENDING_VERIFICATION';
            const isDeliveryPayment = order.status === 'PENDING_DELIVERY_VERIFICATION';
            const hasPendingPayment = isMainPayment || isDeliveryPayment;

            return (
              <div
                key={order.id}
                className="card overflow-hidden transition-all duration-200"
              >
                {/* Collapsible Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="p-4 cursor-pointer hover:bg-surface-muted/40 dark:hover:bg-[#161616]/40 transition flex flex-col md:flex-row gap-4 justify-between items-start md:items-center select-none"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Product Thumbnail */}
                    <div className="relative w-14 h-14 shrink-0">
                      <div className="w-full h-full rounded-xl bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border overflow-hidden flex items-center justify-center">
                        {itemsList[0]?.product_image ? (
                          <img
                            src={itemsList[0].product_image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package size={22} className="text-gray-400" />
                        )}
                      </div>
                      {itemsList.length > 1 && (
                        <div className="absolute -bottom-1 -right-1 bg-brand-500 text-white text-[10px] font-black w-4 h-4 rounded-md flex items-center justify-center shadow-sm border border-white dark:border-gray-900">
                          +{itemsList.length - 1}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                          Order #{order.id}
                        </span>
                        <span className="text-2xs text-gray-400">
                          {order.delivery_info?.is_pos
                            ? order.delivery_info?.customer_name || 'Walk-in Customer'
                            : `@${order.buyer || 'Customer'}`}
                        </span>

                        <StatusBadge status={order.status} size="sm" />

                        {order.delivery_info?.is_pos && (
                          <span className="px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-tight bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                            <Receipt size={10} /> POS
                          </span>
                        )}

                        {order.is_bulk_order && (
                          <span className="px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-tight bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {t('bulk_order', 'Bulk Order')}
                          </span>
                        )}

                        <span className="text-2xs font-extrabold text-gray-900 dark:text-white ml-auto md:ml-0">
                          Total: TSh {(order.seller_subtotal || parseFloat(order.total_amount) || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-2xs text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-gray-800 dark:text-gray-200">
                          {itemsList[0]?.product_name || 'Item'}
                          {itemsList.length > 1 ? ` (+${itemsList.length - 1} more)` : ''}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {fmtOrderDate(order.order_date)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Package size={12} /> {itemsList.length} {t('items', 'items')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Chevron */}
                  <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                    {nextStatus && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (nextStatus === 'SHIPPED') {
                            const promptNotes = prompt('Enter tracking number or courier info:') || '';
                            handleAdvance(order.id, nextStatus, promptNotes || `Moved to ${nextStatus} by seller.`);
                          } else if (nextStatus === 'SHIPPED_TO_WAREHOUSE') {
                            setShipModalOpen(order.id);
                          } else {
                            handleAdvance(order.id, nextStatus, `Moved to ${nextStatus} by seller.`);
                          }
                        }}
                        disabled={advancing === order.id}
                        className="font-bold flex items-center gap-1"
                      >
                        {advancing === order.id ? (
                          <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <>
                            <ShieldCheck size={14} />
                            {nextStatus === 'SELLER_CONFIRMED' && 'Confirm'}
                            {nextStatus === 'PREPARING' && 'Prepare'}
                            {nextStatus === 'PACKAGING' && 'Package'}
                            {nextStatus === 'READY_FOR_PICKUP' && 'Ready for Pickup'}
                            {nextStatus === 'SHIPPED_TO_WAREHOUSE' && 'Ship to Warehouse'}
                            {nextStatus === 'PROCESSING' && 'Process'}
                            {nextStatus === 'SHIPPED' && 'Mark Shipped'}
                            {nextStatus === 'DELIVERED' && 'Confirm Delivery'}
                            {nextStatus === 'COMPLETED' && 'Finalize'}
                            {!['SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'READY_FOR_PICKUP', 'SHIPPED_TO_WAREHOUSE', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(nextStatus) && 'Advance'}
                          </>
                        )}
                      </Button>
                    )}

                    {!order.delivery_info?.is_pos && (
                      <Link
                        to={`/${order.buyer}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-gray-400 hover:text-brand-500 transition rounded-lg hover:bg-surface-muted dark:hover:bg-[#161616]"
                        title={t('contact_customer', 'Contact Customer')}
                      >
                        <MessageSquare size={16} />
                      </Link>
                    )}

                    <div className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Body */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-surface-border dark:border-surface-dark-border space-y-4 text-xs bg-surface-muted/20 dark:bg-[#131313]/30">
                    {/* Payment Verification Callout */}
                    {hasPendingPayment && order.payments?.length > 0 && (
                      <div className="p-3.5 rounded-btn bg-brand-500/10 border border-brand-500/20 space-y-3 mt-3">
                        <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-bold text-xs uppercase tracking-wider">
                          <ShieldAlert size={16} />
                          <span>Payment Verification Needed</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            {order.payments
                              .filter((p: any) => p.status === 'PENDING_VERIFICATION')
                              .map((p: any) => (
                                <div key={p.id} className="p-3 rounded-lg bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border space-y-2">
                                  <div className="flex justify-between text-2xs font-bold text-gray-500">
                                    <span>TRANSACTION ID</span>
                                    <span className="font-mono text-gray-900 dark:text-white select-all">{p.transaction_id || 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between text-2xs font-bold text-gray-500">
                                    <span>AMOUNT PAID</span>
                                    <span className="font-extrabold text-gray-900 dark:text-white">TSh {(p.amount || 0).toLocaleString()}</span>
                                  </div>
                                  {p.proof_image && (
                                    <div
                                      onClick={() => setZoomImage(p.proof_image)}
                                      className="relative rounded-lg overflow-hidden cursor-zoom-in border border-surface-border dark:border-surface-dark-border group h-28"
                                    >
                                      <img src={p.proof_image} alt="Proof" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-2xs font-bold gap-1">
                                        <Eye size={12} /> View Receipt Proof
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>

                          <div className="flex flex-col justify-center gap-2 p-3 rounded-lg bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border">
                            <p className="text-2xs text-gray-500 dark:text-gray-400">
                              {isDeliveryPayment
                                ? 'Verify customer delivery payment receipt before handing to transport.'
                                : 'Verify customer payment proof before confirming and processing order items.'}
                            </p>
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleAdvance(order.id, isDeliveryPayment ? 'ASSIGNED_TRANSPORT' : 'PAID', 'Payment verified by seller.')}
                                disabled={advancing === order.id}
                                className="flex-1 font-bold"
                              >
                                {advancing === order.id ? 'Processing...' : (isDeliveryPayment ? 'Verify Delivery' : 'Verify & Mark Paid')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAdvance(order.id, 'AWAITING_PAYMENT', 'Payment proof rejected.')}
                                className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Items List Table */}
                    <div className="border border-surface-border dark:border-surface-dark-border rounded-btn overflow-hidden mt-3">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                          <tr>
                            <th className="p-2.5">Item Description</th>
                            <th className="p-2.5 text-center">Qty</th>
                            <th className="p-2.5 text-right">Unit Price</th>
                            <th className="p-2.5 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                          {itemsList.map((item: any) => (
                            <tr key={item.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30">
                              <td className="p-2.5 font-medium text-gray-900 dark:text-white">
                                {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                              </td>
                              <td className="p-2.5 text-center text-gray-500">{item.quantity}</td>
                              <td className="p-2.5 text-right text-gray-700 dark:text-gray-300">
                                TSh {(item.price || 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-bold text-gray-900 dark:text-white">
                                TSh {(item.subtotal || (item.price * item.quantity) || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Math & Order Timeline */}
                    <div className="flex flex-col md:flex-row justify-between gap-4 pt-2">
                      <div className="space-y-1 text-2xs text-gray-400">
                        <div>
                          <span>Subtotal: </span>
                          <strong className="text-gray-700 dark:text-gray-300">
                            TSh {(parseFloat(order.total_amount || 0) - parseFloat(order.shipping_fee || 0)).toLocaleString()}
                          </strong>
                        </div>
                        {order.promo_code_code && (
                          <div className="text-emerald-500 font-medium">
                            Promo ({order.promo_code_code}): -TSh {parseInt(order.discount_amount || 0).toLocaleString()}
                          </div>
                        )}
                        {order.shipping_fee > 0 && (
                          <div>
                            <span>Shipping Fee: </span>
                            <strong className="text-gray-700 dark:text-gray-300">TSh {Number(order.shipping_fee).toLocaleString()}</strong>
                          </div>
                        )}
                        <div className="pt-1 text-xs">
                          <span className="text-gray-500">Grand Total: </span>
                          <strong className="text-gray-900 dark:text-white font-extrabold">
                            TSh {parseInt(order.total_amount || 0).toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center gap-2 self-end md:self-center">
                        {order.status === 'SHIPPED_TO_WAREHOUSE' && (
                          <div className="flex items-center gap-2 p-2 rounded-btn bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border">
                            <QRCodeSVG value={order.id.toString()} size={36} bgColor="transparent" fgColor="currentColor" className="text-gray-900 dark:text-white" />
                            <div className="text-3xs text-gray-400">
                              <p className="font-bold text-gray-800 dark:text-gray-200">Warehouse Drop-off Tag</p>
                              <p>Show code upon intake</p>
                            </div>
                          </div>
                        )}

                        {['AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'PAID', 'SELLER_CONFIRMED', 'PREPARING', 'PACKAGING'].includes(order.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(order.id)}
                            disabled={advancing === order.id}
                            className="text-red-500 border-red-500/30 hover:bg-red-500/10 text-xs"
                          >
                            <XCircle size={13} className="mr-1" />
                            Cancel Order
                          </Button>
                        )}
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

          {!hasMore && orders.length > 0 && (
            <p className="text-center py-6 text-2xs text-gray-400 font-medium">
              End of orders
            </p>
          )}

          <div ref={sentinelRef} className="h-4" />
        </div>
      )}

      {/* Ship to Warehouse Modal */}
      {shipModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#121212] rounded-card w-full max-w-md overflow-hidden shadow-2xl border border-surface-border dark:border-surface-dark-border">
            <div className="p-5 border-b border-surface-border dark:border-surface-dark-border flex justify-between items-center bg-surface-muted dark:bg-[#161616]">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="text-brand-500" size={18} />
                Select Destination Warehouse
              </h3>
              <button onClick={() => setShipModalOpen(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700 dark:text-gray-300">Destination Warehouse</label>
                <select
                  required
                  className="input w-full py-2 text-xs"
                  value={shipWarehouseCode}
                  onChange={(e) => setShipWarehouseCode(e.target.value)}
                >
                  <option value="" disabled>-- Select Warehouse --</option>
                  {warehouses.map(w => (
                    <option key={w.code} value={w.code}>{w.name} ({w.region})</option>
                  ))}
                </select>
                <p className="text-3xs text-gray-400">This order will automatically route to this intake warehouse.</p>
              </div>
              
              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700 dark:text-gray-300">Courier / Delivery Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Sent via Bodaboda, Plate MC 123"
                  className="input w-full py-2 text-xs"
                  value={shipNotes}
                  onChange={(e) => setShipNotes(e.target.value)}
                />
              </div>
            </div>
            
            <div className="p-4 bg-surface-muted dark:bg-[#161616] border-t border-surface-border dark:border-surface-dark-border flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShipModalOpen(null)}>
                Cancel
              </Button>
              <Button 
                size="sm"
                onClick={() => {
                  if (!shipWarehouseCode) {
                    toast.error("Please select a destination warehouse.");
                    return;
                  }
                  handleAdvance(shipModalOpen, 'SHIPPED_TO_WAREHOUSE', shipNotes || 'Dispatched to Warehouse Operations', shipWarehouseCode);
                }}
                disabled={!shipWarehouseCode || advancing === shipModalOpen}
                className="flex items-center gap-1.5 font-bold"
              >
                {advancing === shipModalOpen ? 'Processing...' : 'Confirm Shipment'}
                <Truck size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Proof of Payment Zoom Modal */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-3xl max-h-[90vh] bg-neutral-900 rounded-card overflow-hidden border border-white/10 shadow-2xl animate-scale-in cursor-default flex flex-col items-center justify-center"
          >
            <button 
              onClick={() => setZoomImage(null)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur-md border border-white/20 transition-all z-10"
              title="Close"
            >
              <X size={16} />
            </button>
            <img 
              src={zoomImage} 
              alt="Zoomed Payment Proof" 
              className="max-w-full max-h-[85vh] object-contain rounded" 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOrders;
