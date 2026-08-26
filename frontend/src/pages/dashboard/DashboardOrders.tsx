import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Package, ShoppingCart, ChevronDown, ChevronUp, Eye, ShieldCheck, ShieldAlert, Truck, Clock, MessageSquare, XCircle, MapPin, X, Receipt } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useOrderTracking, TrackingUpdate } from '../../hooks/useOrderTracking';
import { ORDER_STATUS_CONFIG as ORDER_STATUS_CFG, getSellerNextStatus } from '../../constants/orderStatus';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../../components/ui/Dialogs';
import { Spinner } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';

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
    const params = filterStatus ? `&status=${filterStatus}` : '&exclude_statuses=REQUESTED_INVOICE,INVOICE_GENERATED';
    api.get(`/api/orders/incoming/?page=${p}${params}`)
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
  }, [filterStatus]);

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

  const filterTabs = ['', 'AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'PENDING_DELIVERY_VERIFICATION', 'PAID', 'SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'SHIPPED_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE', 'AWAITING_DELIVERY_PAYMENT', 'ASSIGNED_TRANSPORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'DELIVERED', 'FAILED_DELIVERY', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Incoming Orders</h2>
        <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded shadow-sm uppercase tracking-widest text-gray-500">Live View</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto mb-4 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm [&::-webkit-scrollbar]:hidden w-full">
        {filterTabs.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`shrink-0 px-3 py-1.5 text-[10px] sm:text-xs rounded-lg font-bold transition uppercase tracking-wider ${filterStatus === s ? 'bg-brand-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            {s ? (ORDER_STATUS_CFG[s]?.label || s) : 'All Orders'}
          </button>
        ))}
      </div>

      {/* Status Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
              { id: 'PENDING_VERIFICATION', label: 'Payments to Verify', icon: ShieldAlert, color: 'text-orange-500', bg: ' ' },
              { id: 'PAID', label: 'Ready to Process', icon: Package, color: 'text-green-500', bg: ' ' },
              { id: 'PROCESSING', label: 'In Processing', icon: Clock, color: 'text-brand-500', bg: ' ' },
              { id: 'SHIPPED', label: 'Active Shipments', icon: Truck, color: 'text-brand-500', bg: ' ' },
          ].map((stat) => {
              const count = stat.id === 'PENDING_VERIFICATION' 
                ? orders.filter(o => o.status === 'PENDING_VERIFICATION' || o.status === 'PENDING_DELIVERY_VERIFICATION').length
                : orders.filter(o => o.status === stat.id).length;
              return (
                  <button key={stat.id} onClick={() => setFilterStatus(stat.id)} 
                    className={`card p-4 flex flex-col items-center text-center transition-all ${filterStatus === stat.id ? 'ring-2 ring-brand-500 scale-105' : 'hover:scale-[1.02]'}`}>
                      <stat.icon size={20} className={stat.color} />
                      <span className="text-[20px] font-black text-gray-900 dark:text-white mt-1">{count}</span>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{stat.label}</span>
                  </button>
              );
          })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={t('no_incoming_orders', 'No incoming orders found')}
          action={filterStatus ? {
            label: t('clear_filter', 'Clear Filter'),
            onClick: () => setFilterStatus(''),
          } : undefined}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => {
            const isExpanded = expandedId === order.id;


            const nextStatus = getSellerNextStatus(
              order.status,
              order.fulfillment_type || 'PLATFORM_DELIVERY',
              order.has_vehicles
            );
            const isMainPayment = order.status === 'PENDING_VERIFICATION';
            const isDeliveryPayment = order.status === 'PENDING_DELIVERY_VERIFICATION';
            const hasPendingPayment = isMainPayment || isDeliveryPayment;

            return (
              <div key={order.id} className={`bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'shadow-xl ring-1 ring-brand-500/20' : 'shadow-sm hover:shadow-md border-gray-100 dark:border-gray-700'}`}>
                {/* Header */}
                <button onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50/20 transition group">
                  
                  {/* Product Thumbnail */}
                  <div className="relative w-16 h-16 shrink-0">
                    <div className="w-full h-full rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden shadow-inner flex items-center justify-center">
                        {order.items?.[0]?.product_image ? (
                            <img src={order.items[0].product_image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                            <Package size={24} className="text-gray-300" />
                        )}
                    </div>
                    {order.items?.length > 1 && (
                        <div className="absolute -bottom-1 -right-1 bg-brand-500 text-white text-[10px] font-black w-5 h-5 rounded-lg flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800">
                            +{order.items.length - 1}
                        </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {order.delivery_info?.is_pos && (
                          <span className="text-[10px] font-black text-purple-500 dark:text-purple-500   border border-purple-500 dark:border-purple-500 px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1 shadow-xs">
                            <Receipt size={11} /> POS
                          </span>
                        )}
                        {order.is_bulk_order && (
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700/50 px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1 shadow-xs">
                            Bulk Order
                          </span>
                        )}
                        <span className="text-[10px] font-black text-brand-500   px-2 py-0.5 rounded uppercase tracking-widest">Order #{order.id}</span>
                        <span className="text-[10px] font-bold text-gray-400 capitalize">{fmtOrderDate(order.order_date)}</span>
                    </div>
                    <h4 className="text-base font-black text-gray-900 dark:text-white truncate">
                        {order.items?.length > 0 ? order.items[0].product_name : 'Multiple Items'}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {order.delivery_info?.is_pos ? (
                        <>Customer: <span className="font-bold text-purple-500 dark:text-purple-500">{order.delivery_info?.customer_name || 'Walk-in Customer'}</span></>
                      ) : (
                        <>Customer: <span className="font-bold text-gray-700 dark:text-gray-300">@{order.buyer}</span></>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={order.status} size="sm" className="mb-1" />
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Total: TSh {(order.seller_subtotal || parseFloat(order.total_amount) || 0).toLocaleString()}</p>
                          {order.promo_code_code && (
                            <p className="text-[10px] text-green-500 font-medium">
                              Promo: {order.promo_code_code} ({order.promo_code_details?.discount_type === 'percentage' ? `${parseInt(order.promo_code_details.value)}%` : `TSh ${parseInt(order.promo_code_details.value).toLocaleString()}`} off) -TSh {parseInt(order.discount_amount || 0).toLocaleString()}
                            </p>
                          )}
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <Link 
                            to={`/${order.buyer}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-gray-400 hover:text-brand-500   rounded-lg transition"
                            title="Contact Customer"
                        >
                            <MessageSquare size={18} />
                        </Link>
                        {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </div>
                  </div>
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-50 dark:border-gray-700 bg-gray-50/20 dark:bg-gray-900/5 pulse-in">
                    
                    

                    {/* Payment Verification Block */}
                    {hasPendingPayment && order.payments?.length > 0 && (
                      <div className="px-6 py-6   border-b border-brand-500 dark:border-brand-500/20">
                          <div className="flex items-center gap-2 mb-4">
                              <ShieldCheck className="text-brand-500" size={20} />
                              <h4 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-wider">Payment Verification Needed</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                  {order.payments.filter((p:any) => p.status === 'PENDING_VERIFICATION').map((p:any) => (
                                      <div key={p.id} className="card p-4 space-y-3 bg-white/70 dark:bg-gray-800/70 border-brand-500">
                                          <div className="flex justify-between text-xs">
                                              <span className="text-gray-500 font-bold uppercase">Transaction ID</span>
                                              <span className="font-black text-brand-500 dark:text-brand-500 select-all">{p.transaction_id || 'N/A'}</span>
                                          </div>
                                          <div className="flex justify-between text-xs">
                                              <span className="text-gray-500 font-bold uppercase">Amount</span>
                                              <span className="font-bold text-gray-900 dark:text-white">TSh {(p.amount || 0).toLocaleString()}</span>
                                          </div>
                                          
                                          {p.proof_image && (
                                              <div 
                                                  onClick={() => setZoomImage(p.proof_image)}
                                                  className="group relative rounded-xl overflow-hidden cursor-zoom-in border border-gray-100 dark:border-gray-700"
                                              >
                                                  <img src={p.proof_image} alt="Proof" className="w-full h-40 object-cover transition duration-300 group-hover:scale-105" />
                                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                      <button type="button" className="btn-primary py-1 px-3 text-xs flex items-center gap-1">
                                                          <Eye size={14} /> Full View
                                                      </button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                              
                              <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-2xl border border-brand-500/50 dark:border-brand-500/20 flex flex-col justify-center gap-3">
                                  <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                     {isDeliveryPayment 
                                        ? "Review the delivery fee transaction above. Once confirmed, assign the order to transport."
                                        : "Review the transaction ID and receipt above. Once confirmed, mark as PAID to allow the order to proceed to processing."}
                                  </p>
                                  <div className="flex gap-2 mt-2">
                                      <button 
                                          onClick={() => handleAdvance(order.id, isDeliveryPayment ? 'ASSIGNED_TRANSPORT' : 'PAID', 'Payment successfully verified by system/admin.')}
                                          disabled={advancing === order.id}
                                          className="btn-primary py-2 px-4 flex-1 text-xs"
                                      >
                                          {advancing === order.id ? 'Processing...' : (isDeliveryPayment ? 'Verify & Assign Transport' : 'Verify & Mark as PAID')}
                                      </button>
                                      <button 
                                          onClick={() => handleAdvance(order.id, 'AWAITING_PAYMENT', 'Payment rejected. Incorrect transaction ID or proof.')}
                                          className="flex-1 btn-ghost py-2.5 border-red-500 text-red-500  text-[11px] font-bold uppercase tracking-widest"
                                      >
                                          Reject
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                    )}

                    {/* Order Content */}
                    <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-800">
                        {/* Left: Items (Cols 3 or 5 for POS) */}
                        <div className={`p-6 ${order.delivery_info?.is_pos ? 'w-full' : 'w-full lg:w-[60%]'}`}>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Package Contents</p>
                            <div className="space-y-1">
                                {order.items?.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-4 py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0 group">
                                    {item.product_image && (
                                    <img src={item.product_image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-800" onError={(e: any) => e.target.style.display = 'none'} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                          {item.product_name}
                                          {item.variant_name && <span className="ml-2 text-[10px] uppercase font-bold text-brand-500 bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded tracking-wider">{item.variant_name}</span>}
                                      </p>
                                      <p className="text-xs text-gray-500 font-medium mt-0.5">Qty: {item.quantity} × TSh {(item.price || 0).toLocaleString()}</p>
                                    </div>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">TSh {(item.subtotal || 0).toLocaleString()}</p>
                                </div>
                                ))}
                            </div>

                            {/* Receipt Math Section */}
                            <div className="mt-6 pt-4 border-t border-dashed border-gray-200 dark:border-gray-700 space-y-2">
                                <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                                  <span>Subtotal</span>
                                  <span>TSh {(parseFloat(order.total_amount || 0) - parseFloat(order.shipping_fee || 0)).toLocaleString()}</span>
                                </div>
                                
                                {order.promo_code_code && (
                                  <div className="flex justify-between text-xs font-bold text-green-500">
                                    <span>Discount ({order.promo_code_code})</span>
                                    <span>-TSh {parseInt(order.discount_amount || 0).toLocaleString()}</span>
                                  </div>
                                )}
                                
                                <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                                  <span>Delivery Fee</span>
                                  <span>
                                    {Number(order.shipping_fee) > 0 
                                      ? `TSh ${Number(order.shipping_fee).toLocaleString()}` 
                                      : ['COMPLETED', 'DELIVERED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'SHIPPED', 'ASSIGNED_TRANSPORT'].includes(order.status)
                                        ? 'FREE'
                                        : 'TBD'}
                                  </span>
                                </div>
                                
                                <div className="flex justify-between text-lg font-black text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-gray-800 mt-2">
                                  <span>Total</span>
                                  <span>TSh {parseInt(order.total_amount).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Timeline & Actions */}
                        {!order.delivery_info?.is_pos && (
                          <div className="w-full lg:w-[40%] p-6 bg-gray-50/50 dark:bg-gray-800/10 flex flex-col justify-between">
                            
                            {/* Enhanced Vertical Timeline */}
                            <div className="flex-1 flex flex-col min-h-[160px] lg:min-h-0 relative">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 shrink-0">Order History</h4>
                              <div className="max-h-[160px] lg:max-h-none lg:absolute lg:top-8 lg:bottom-0 lg:left-0 lg:right-0 overflow-y-auto pr-2 -mr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                                <div className="space-y-4 pt-1 relative pl-4 border-l-2 border-brand-500/20 dark:border-brand-500/30">
                                    {[...(order.timeline || [])].reverse().map((ev: any, i: number) => {
                                        const isLatest = i === 0;
                                        return (
                                          <div key={i} className="relative">
                                              <div className={`absolute -left-[21.5px] w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 shadow-sm ${isLatest ? 'bg-brand-500 ring-4 ring-brand-500/20' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                              <div className="ml-3">
                                                  <p className={`text-xs font-black uppercase tracking-tighter ${isLatest ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{ORDER_STATUS_CFG[ev.status]?.label || ev.status}</p>
                                                  <p className="text-[10px] text-gray-400 mt-0.5 font-bold uppercase">{fmtOrderDate(ev.created_at)}</p>
                                              </div>
                                          </div>
                                        );
                                    })}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons (Docked to bottom right) */}
                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 shrink-0">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    {['AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'PAID', 'SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'PROCESSING'].includes(order.status) && (
                                        <button 
                                            onClick={() => handleCancel(order.id)}
                                            disabled={advancing === order.id}
                                            className="px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-500 hover:text-red-500 text-xs font-black uppercase tracking-widest transition-all shrink-0 flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={16} />
                                            Cancel
                                        </button>
                                    )}

                                    {order.fulfillment_type === 'SELLER_PICKUP' && order.status === 'PACKAGING' && (
                                        <button
                                            onClick={() => handleAdvance(order.id, 'COMPLETED', 'Handed over directly to customer with verification code.')}
                                            disabled={advancing === order.id}
                                            className="px-4 py-3 rounded-xl border-2 border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/30 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest transition-all shrink-0 flex items-center justify-center gap-2"
                                            title="If the customer is present now, enter their code to complete order"
                                        >
                                            <ShieldCheck size={16} />
                                            Enter Code & Handover
                                        </button>
                                    )}

                                    {nextStatus ? (
                                        <button
                                            onClick={() => {
                                                let promptNotes = "";
                                                if (nextStatus === 'SHIPPED') {
                                                  promptNotes = prompt('Enter tracking number or courier info:') || "";
                                                } else if (nextStatus === 'SHIPPED_TO_WAREHOUSE') {
                                                  setShipModalOpen(order.id);
                                                  return;
                                                }
                                                handleAdvance(order.id, nextStatus, promptNotes || `Moved to ${nextStatus} by seller.`);
                                            }}
                                            disabled={advancing === order.id}
                                            className="flex-1 px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-brand-400 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                                        >
                                            {advancing === order.id ? (
                                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                            ) : (
                                                <>
                                                  {nextStatus === 'SELLER_CONFIRMED' && 'Confirm Order'}
                                                  {nextStatus === 'PREPARING' && 'Start Preparing'}
                                                  {nextStatus === 'PACKAGING' && (order.fulfillment_type === 'SELLER_PICKUP' ? 'Start Packaging' : 'Package Order')}
                                                  {nextStatus === 'READY_FOR_PICKUP' && (order.fulfillment_type === 'SELLER_PICKUP' ? 'Packaging Done (Notify Buyer)' : 'Ready for Pickup')}
                                                  {nextStatus === 'SHIPPED_TO_WAREHOUSE' && 'Ship to Warehouse'}
                                                  {nextStatus === 'PROCESSING' && 'Process Order'}
                                                  {nextStatus === 'SHIPPED' && 'Mark Shipped'}
                                                  {nextStatus === 'DELIVERED' && (order.fulfillment_type === 'SELLER_PICKUP' ? 'Enter Code & Handover' : 'Confirm Delivery')}
                                                  {nextStatus === 'COMPLETED' && 'Finalize'}
                                                  {!['SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'READY_FOR_PICKUP', 'SHIPPED_TO_WAREHOUSE', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(nextStatus) && `Advance`}
                                                  <ShieldCheck size={16} />
                                                </>
                                            )}
                                        </button>
                                    ) : order.status === 'AWAITING_PAYMENT' ? (
                                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-center">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                Awaiting Payment
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                                
                                {order.status === 'SHIPPED_TO_WAREHOUSE' && (
                                  <div className="mt-4 flex items-center justify-between gap-4 p-4 rounded-xl border border-brand-500/30 bg-brand-50/50 dark:bg-brand-500/5">
                                    <div className="flex-1">
                                      <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mb-0.5">Drop-off Tag</p>
                                      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                        Show this QR Code at the warehouse.
                                      </p>
                                    </div>
                                    <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 shrink-0">
                                      <QRCodeSVG value={order.id.toString()} size={60} bgColor="transparent" fgColor="#000" />
                                    </div>
                                  </div>
                                )}

                                {order.fulfillment_type === 'SELLER_PICKUP' && (
                                  <div className="mt-4 text-xs p-3.5 bg-brand-50 dark:bg-brand-950/40 rounded-xl border border-brand-200 dark:border-brand-800/40 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-brand-900 dark:text-brand-100">
                                      <MapPin size={16} className="text-brand-500 shrink-0" />
                                      <span>
                                        {order.status === 'PACKAGING' 
                                          ? 'Store Pickup: Once packaged, click "Packaging Done" to notify the buyer to collect, or enter code if buyer is present.'
                                          : order.status === 'READY_FOR_PICKUP'
                                          ? 'Store Pickup: Customer has been notified. When they arrive, click "Enter Code & Handover" and enter their 6-digit code.'
                                          : 'Store Pickup Order (Handover directly at your shop).'}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {!['DIRECT_DELIVERY', 'SELLER_PICKUP'].includes(order.fulfillment_type) && ['RECEIVED_AT_WAREHOUSE', 'ASSIGNED_TRANSPORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP'].includes(order.status) && (
                                    <div className="mt-4 text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                                        <Truck size={14} className="text-brand-500 shrink-0" />
                                        <span>Logistics handling delivery.</span>
                                    </div>
                                )}
                                
                                <div className="mt-4 flex items-center justify-center gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <Clock size={12} />
                                        <p className="text-[9px] font-black uppercase tracking-[0.1em]">
                                            Last Activity: {fmtOrderDate(order.order_date)}
                                        </p>
                                    </div>
                                    <Link to={`/${order.buyer}`} className="text-[9px] font-black text-brand-500 uppercase tracking-[0.1em] hover:underline flex items-center gap-1">
                                        <MessageSquare size={12} />
                                        Contact Buyer
                                    </Link>
                                </div>
                            </div>
                          </div>
                        )}
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
              <p className="text-center py-8 text-sm text-gray-400 dark:text-gray-500 font-medium">
                End of list
              </p>
            )}
            
            <div ref={sentinelRef} className="h-4" />
        </div>
      )}

      {/* Ship to Warehouse Modal */}
      {shipModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="text-brand-500" />
                Select Destination Warehouse
              </h3>
              <button onClick={() => setShipModalOpen(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Destination Warehouse</label>
                <select
                  required
                  className="input w-full"
                  value={shipWarehouseCode}
                  onChange={(e) => setShipWarehouseCode(e.target.value)}
                >
                  <option value="" disabled>-- Select Warehouse --</option>
                  {warehouses.map(w => (
                    <option key={w.code} value={w.code}>{w.name} ({w.region})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">This order will automatically appear in this warehouse's intake queue.</p>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Courier / Delivery Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Sent via Bodaboda, Plate MC 123"
                  className="input w-full"
                  value={shipNotes}
                  onChange={(e) => setShipNotes(e.target.value)}
                />
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShipModalOpen(null)} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition">
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!shipWarehouseCode) {
                    toast.error("Please select a destination warehouse.");
                    return;
                  }
                  handleAdvance(shipModalOpen, 'SHIPPED_TO_WAREHOUSE', shipNotes || 'Dispatched to Warehouse Operations', shipWarehouseCode);
                }}
                disabled={!shipWarehouseCode || advancing === shipModalOpen}
                className="btn-primary px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {advancing === shipModalOpen ? 'Processing...' : 'Confirm Shipment'}
                <Truck size={16} />
              </button>
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
            className="relative max-w-4xl max-h-[90vh] bg-neutral-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl animate-scale-in cursor-default flex flex-col items-center justify-center"
          >
            <button 
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur-md border border-white/20 transition-all active:scale-95 z-10"
              title="Close View"
            >
              <X size={20} />
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
