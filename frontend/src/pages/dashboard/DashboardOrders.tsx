import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Package, ShoppingCart, ChevronDown, ChevronUp, Eye, ShieldCheck, ShieldAlert, Truck, Clock, MessageSquare, XCircle, MapPin } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useOrderTracking, TrackingUpdate } from '../../hooks/useOrderTracking';
import { ORDER_STATUS_CONFIG as ORDER_STATUS_CFG, SELLER_ADVANCE_MAP } from '../../constants/orderStatus';

// ============ Incoming Orders (Seller) ============
const fmtOrderDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const getStatusExplanation = (status: string) => {
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
      return "The line-haul truck is currently en route to the destination warehouse.";
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
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState<number | null>(null);
  
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
    const params = filterStatus ? `&status=${filterStatus}` : '';
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
    if (nextStatus === 'DELIVERED') {
      delivery_code = prompt('Enter the 6-digit delivery code provided by the buyer:');
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
    const reason = prompt('Enter cancellation reason (sent to customer):');
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
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Incoming Orders</h2>
        <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded shadow-sm uppercase tracking-widest text-gray-500">Live View</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 flex-wrap mb-4 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        {filterTabs.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-[10px] sm:text-xs rounded-lg font-bold transition uppercase tracking-wider ${filterStatus === s ? 'bg-brand-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            {s ? (ORDER_STATUS_CFG[s]?.label || s) : 'All Orders'}
          </button>
        ))}
      </div>

      {/* Status Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
              { id: 'PENDING_VERIFICATION', label: 'Payments to Verify', icon: ShieldAlert, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/10' },
              { id: 'PAID', label: 'Ready to Process', icon: Package, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
              { id: 'PROCESSING', label: 'In Processing', icon: Clock, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/10' },
              { id: 'SHIPPED', label: 'Active Shipments', icon: Truck, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/10' },
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
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <ShoppingCart size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 font-medium">No incoming orders found</p>
          {filterStatus && <button onClick={() => setFilterStatus('')} className="text-brand-600 text-sm font-bold mt-2 hover:underline">Clear Filter</button>}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => {
            const cfg = ORDER_STATUS_CFG[order.status] || ORDER_STATUS_CFG.CART;
            const isExpanded = expandedId === order.id;
            const getNextVehicleStatus = (st: string) => {
               if (st === 'PAID') return 'PROCESSING';
               if (st === 'PROCESSING' || ['SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'SHIPPED_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE', 'ASSIGNED_TRANSPORT'].includes(st)) return 'SHIPPED';
               return undefined;
            };

            const nextStatus = order.has_vehicles
              ? getNextVehicleStatus(order.status)
              : SELLER_ADVANCE_MAP[order.status];
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
                        <div className="absolute -bottom-1 -right-1 bg-brand-600 text-white text-[10px] font-black w-5 h-5 rounded-lg flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800">
                            +{order.items.length - 1}
                        </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded uppercase tracking-widest">Order #{order.id}</span>
                        <span className="text-[10px] font-bold text-gray-400 capitalize">{fmtOrderDate(order.order_date)}</span>
                    </div>
                    <h4 className="text-base font-black text-gray-900 dark:text-white truncate">
                        {order.items?.length > 0 ? order.items[0].product_name : 'Multiple Items'}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Customer: <span className="font-bold text-gray-700 dark:text-gray-300">@{order.buyer}</span></p>
                  </div>
                  
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex flex-col items-end gap-2">
                        <span className={`inline-block px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-[0.15em] shadow-sm ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                        </span>
                        <p className="font-black text-gray-900 dark:text-white text-lg tracking-tighter">TSh {(order.seller_subtotal || 0).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <Link 
                            to={`/profile/${order.buyer}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition"
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
                      <div className="px-6 py-6 bg-brand-50/50 dark:bg-brand-900/10 border-b border-brand-100 dark:border-brand-900/20">
                          <div className="flex items-center gap-2 mb-4">
                              <ShieldCheck className="text-brand-600" size={20} />
                              <h4 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-wider">Payment Verification Needed</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                  {order.payments.filter((p:any) => p.status === 'PENDING_VERIFICATION').map((p:any) => (
                                      <div key={p.id} className="card p-4 space-y-3 bg-white/70 dark:bg-gray-800/70 border-brand-200">
                                          <div className="flex justify-between text-xs">
                                              <span className="text-gray-500 font-bold uppercase">Transaction ID</span>
                                              <span className="font-black text-brand-700 dark:text-brand-400 select-all">{p.transaction_id || 'N/A'}</span>
                                          </div>
                                          <div className="flex justify-between text-xs">
                                              <span className="text-gray-500 font-bold uppercase">Amount</span>
                                              <span className="font-bold text-gray-900 dark:text-white">TSh {(p.amount || 0).toLocaleString()}</span>
                                          </div>
                                          
                                          {p.proof_image && (
                                              <div className="group relative rounded-xl overflow-hidden cursor-zoom-in">
                                                  <img src={p.proof_image} alt="Proof" className="w-full h-40 object-cover transition duration-300 group-hover:scale-110" />
                                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                      <Link to={p.proof_image} target="_blank" className="btn-primary py-1 px-3 text-xs flex items-center gap-1">
                                                          <Eye size={14} /> Full View
                                                      </Link>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                              
                              <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-2xl border border-brand-100/50 dark:border-brand-900/20 flex flex-col justify-center gap-3">
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
                                          className="flex-1 btn-ghost py-2.5 border-red-100 text-red-500 hover:bg-red-50 text-[11px] font-bold uppercase tracking-widest"
                                      >
                                          Reject
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                    )}

                    {/* Order Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-700">
                        {/* Left: Items (Cols 3) */}
                        <div className="lg:col-span-3 p-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Package Contents</p>
                            <div className="space-y-3">
                                {order.items?.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-50 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                                    {item.product_image && (
                                    <img src={item.product_image} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-100 dark:border-gray-600 shadow-inner" onError={(e: any) => e.target.style.display = 'none'} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">{item.product_name}</p>
                                    <p className="text-xs text-gray-500 font-bold mt-0.5">Qty: {item.quantity} × TSh {(item.price || 0).toLocaleString()}</p>
                                    </div>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">TSh {(item.subtotal || 0).toLocaleString()}</p>
                                </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Timeline & Actions (Cols 2) */}
                        <div className="lg:col-span-2 p-6 bg-gray-50/50 dark:bg-gray-800/10 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Order History</p>
                                <div className="space-y-4 pt-1 relative pl-4 border-l-2 border-brand-100 dark:border-brand-900/30">
                                    {[...(order.timeline || [])].reverse().slice(0, 3).map((ev: any, i: number) => (
                                        <div key={i} className="relative">
                                            <div className="absolute -left-[21.5px] w-2.5 h-2.5 rounded-full bg-brand-400 border-2 border-white dark:border-gray-800 shadow-sm" />
                                            <div className="ml-3">
                                                <p className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-tighter">{ORDER_STATUS_CFG[ev.status]?.label || ev.status}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5 font-bold uppercase">{fmtOrderDate(ev.created_at)}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {order.timeline?.length > 3 && <p className="text-[10px] text-brand-500 font-bold px-2">+ {order.timeline.length - 3} more events</p>}
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex flex-col sm:flex-row gap-3">
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
                                            className="flex-[3] btn-primary py-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-sm font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 flex items-center justify-center gap-3 group ring-offset-2 focus:ring-2 focus:ring-brand-500"
                                        >
                                            {advancing === order.id ? (
                                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                            ) : (
                                                <>
                                                  {nextStatus === 'SELLER_CONFIRMED' && 'Confirm Order'}
                                                  {nextStatus === 'PREPARING' && 'Start Preparing'}
                                                  {nextStatus === 'PACKAGING' && 'Package Order'}
                                                  {nextStatus === 'SHIPPED_TO_WAREHOUSE' && 'Ship to SokoniMax Warehouse'}
                                                  {nextStatus === 'PROCESSING' && 'Accept & Process Order'}
                                                  {nextStatus === 'SHIPPED' && 'Mark as Shipped'}
                                                  {nextStatus === 'DELIVERED' && 'Confirm Delivery'}
                                                  {nextStatus === 'COMPLETED' && 'Finalize Transaction'}
                                                  {!['SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'SHIPPED_TO_WAREHOUSE', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(nextStatus) && `Advance to ${nextStatus}`}
                                                  <ShieldCheck size={20} className="transition-transform group-hover:scale-125" />
                                                </>
                                            )}
                                        </button>
                                    ) : order.status === 'AWAITING_PAYMENT' ? (
                                        <div className="flex-[3] bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50 p-4 rounded-xl text-center flex items-center justify-center flex-col gap-2">
                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 leading-relaxed">
                                                Awaiting customer payment before processing can begin.
                                            </p>
                                            {order.buyer_contact?.name && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Buyer Contact: {order.buyer_contact.name} ({order.buyer_contact.phone})
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-[3] bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50 p-4 rounded-xl text-center flex items-center justify-center">
                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 leading-relaxed">
                                                {getStatusExplanation(order.status) || "No actions required at this stage."}
                                            </p>
                                        </div>
                                    )}
                                    
                                    {['AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'PAID', 'SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'PROCESSING'].includes(order.status) && (
                                        <button 
                                            onClick={() => handleCancel(order.id)}
                                            disabled={advancing === order.id}
                                            className="flex-1 btn-secondary py-4 text-red-600 hover:text-red-700 hover:bg-red-50 text-sm font-black uppercase tracking-widest border-2 border-red-100 hover:border-red-200 transition-all flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={18} />
                                            Cancel
                                        </button>
                                    )}
                                </div>
                                
                                {order.status === 'SHIPPED_TO_WAREHOUSE' && (
                                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-6 bg-brand-50/50 dark:bg-brand-900/10 p-4 rounded-xl border border-brand-100 dark:border-brand-900/20">
                                    <div className="flex-1">
                                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest mb-1">Origin Drop-off Tag</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Present this QR Code to the warehouse staff upon arrival. 
                                      </p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border-2 border-brand-500/30 shrink-0">
                                      <QRCodeSVG value={order.id.toString()} size={80} bgColor="transparent" fgColor="currentColor" className="text-gray-900 dark:text-white" />
                                    </div>
                                  </div>
                                )}

                                {['RECEIVED_AT_WAREHOUSE', 'ASSIGNED_TRANSPORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP'].includes(order.status) && (
                                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 p-3 bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100/50 dark:border-brand-900/30 rounded-xl">
                                        <Truck size={14} className="text-brand-500 shrink-0" />
                                        <span>SokoniMax logistics is handling this delivery — no action required from you.</span>
                                    </div>
                                )}
                                <div className="mt-4 flex items-center justify-center gap-4">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Clock size={12} />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">
                                            Last Activity: {fmtOrderDate(order.order_date)}
                                        </p>
                                    </div>
                                    <Link to={`/profile/${order.buyer}`} className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:underline flex items-center gap-1">
                                        <MessageSquare size={12} />
                                        Contact Buyer
                                    </Link>
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

    </div>
  );
};

export default DashboardOrders;
