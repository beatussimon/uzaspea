import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Package, ShoppingCart, ChevronDown, Eye, ShieldCheck, Truck, Clock, XCircle, MapPin, X, Receipt, Search, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useOrderTracking, TrackingUpdate } from '../../hooks/useOrderTracking';
import { ORDER_STATUS_CONFIG as ORDER_STATUS_CFG, getSellerNextStatus } from '../../constants/orderStatus';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { LocationSelector } from '../../components/dashboard/LocationSelector';
import { useDialog } from '../../components/ui/Dialogs';
import { Spinner } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { OrderActionToolbar } from '../../components/ui/OrderActionToolbar';
import { CardListSkeleton } from '../../components/Skeleton';
import { ReceiptModal } from '../../components/orders/ReceiptModal';
import { cn } from '../../lib/utils';

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
  const { activeLocation, assignedLocations } = useAuth();
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
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<any>(null);
  
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  useEffect(() => {
    if (!highlightId) return;
    const id = parseInt(highlightId, 10);
    if (isNaN(id)) return;

    const existing = orders.find(o => o.id === id);
    if (existing) {
      setExpandedId(id);
      setTimeout(() => {
        document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    } else if (!loading) {
      api.get(`/api/orders/${id}/`)
        .then(res => {
          if (res.data && res.data.id) {
            setOrders(prev => {
              if (prev.some(o => o.id === id)) return prev;
              return [res.data, ...prev];
            });
            setExpandedId(id);
            setTimeout(() => {
              document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 350);
          }
        })
        .catch(() => {});
    }
  }, [highlightId, orders, loading]);
  
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [shipModalOpen, setShipModalOpen] = useState<number | null>(null);
  const [shipNotes, setShipNotes] = useState('');
  const [shipWarehouseCode, setShipWarehouseCode] = useState('');
  const [shipRegion, setShipRegion] = useState('');

  const shippingOrder = useMemo(() => orders.find(o => o.id === shipModalOpen), [orders, shipModalOpen]);

  useEffect(() => {
    api.get('/api/warehouses/warehouses/').then(res => {
      const list = res.data.results || res.data || [];
      setWarehouses(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  // Helper to clean up region names for comparison (strips words like 'region', 'mkoa', whitespace, special chars)
  const normalizeRegion = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/\b(region|mkoa|city|hub|warehouse)\b/gi, '')
      .replace(/[^a-z0-9]/g, '');

  // When modal opens, auto-detect the seller's intake region where they physically drop off the parcel.
  // NEVER use buyer destination region (e.g. Kagera); sellers only drop off in their own region (e.g. Dar es Salaam).
  useEffect(() => {
    if (!shipModalOpen || !shippingOrder) {
      setShipNotes('');
      setShipWarehouseCode('');
      setShipRegion('');
      return;
    }

    const branch = (assignedLocations || []).find((l: any) => l.id === shippingOrder.fulfillment_location);
    const origin =
      shippingOrder.seller_region ||
      shippingOrder.fulfillment_location_city ||
      branch?.city ||
      activeLocation?.city ||
      'Dar es Salaam';
    setShipRegion(origin);
  }, [shipModalOpen, shippingOrder, assignedLocations, activeLocation]);

  const regionWarehouses = useMemo(() => {
    if (!shipRegion) return [];
    const norm = normalizeRegion(shipRegion);
    if (!norm) return warehouses;
    return warehouses.filter(w => {
      const r = normalizeRegion(w.region_name || '');
      const d = normalizeRegion(w.district || '');
      // Match by region_name or district ONLY. Never match by street address because addresses in other cities may contain street names like "Old Dar es Salaam Road".
      if (r === norm || (r.length >= 3 && norm.length >= 3 && (r.includes(norm) || norm.includes(r)))) {
        return true;
      }
      if (d === norm || (d.length >= 4 && norm.length >= 4 && (d.includes(norm) || norm.includes(d)))) {
        return true;
      }
      return false;
    });
  }, [warehouses, shipRegion]);

  useEffect(() => {
    if (shipModalOpen && regionWarehouses.length > 0) {
      setShipWarehouseCode(current => {
        // If current is already a valid option within this region, preserve the seller's selection!
        if (current && regionWarehouses.some(w => w.code === current)) {
          return current;
        }
        const existingCode = shippingOrder?.delivery_info?.origin_warehouse_code || shippingOrder?.delivery_info?.warehouse_code;
        const match = regionWarehouses.find(w => w.code === existingCode);
        return match ? match.code : regionWarehouses[0].code;
      });
    }
  }, [shipModalOpen, regionWarehouses, shippingOrder]);

  const selectedWh = useMemo(() => {
    return warehouses.find(w => w.code === shipWarehouseCode);
  }, [warehouses, shipWarehouseCode]);

  const fetchOrders = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }
    let url = `/api/orders/incoming/?page=${p}&exclude_statuses=REQUESTED_INVOICE,INVOICE_GENERATED`;
    if (activeLocation?.id) {
      url += `&location_id=${activeLocation.id}`;
    }
    api.get(url)
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
  }, [activeLocation]);

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
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to update order'); 
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
    <div className="space-y-6 w-full min-w-0 max-w-full">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2 sm:gap-3 min-w-0 w-full">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            {t('incoming_orders', 'Incoming Orders')}
          </h1>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LocationSelector />
            <span className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-btn text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="sm:hidden">Live</span>
              <span className="hidden sm:inline">{t('live_view', 'Live View')}</span>
            </span>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
          {t('orders_desc', 'Track incoming customer orders, verify payments, manage shipments, and fulfill orders in real-time.')}
        </p>
      </header>

      {/* Filter Pills & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 w-full min-w-0 max-w-full">
        {/* Horizontal Scroll Pill Bar */}
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 w-full min-w-0 max-w-full scrollbar-none">
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
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
        <div className="relative w-full sm:w-auto sm:min-w-[220px] shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_orders', 'Search Order #, Buyer, Product...')}
            className="w-full pl-8 pr-6 py-1.5 text-xs font-semibold rounded-full bg-surface-muted dark:bg-[#161616] text-gray-900 dark:text-white placeholder:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 border-0 outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-neutral-700 transition"
          />
        </div>
      </div>

      {/* Orders List */}
      {loading && orders.length === 0 ? (
        <CardListSkeleton count={3} />
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
        <div className={cn("space-y-3", loading && "opacity-75 transition-opacity")}>
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

            const unpaidStatuses = ['CART', 'CHECKOUT', 'REQUESTED_INVOICE', 'INVOICE_GENERATED', 'BUYER_COUNTERED', 'AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'CANCELLED'];
            const hasVerifiedPayment = Array.isArray(order.payments) && order.payments.some((p: any) => p.status === 'VERIFIED');
            const isPosOrder = Boolean(order.delivery_info?.is_pos || order.delivery_method === 'POS');
            const isOrderPaid = order.status !== 'CANCELLED' && (!unpaidStatuses.includes(order.status) || hasVerifiedPayment || isPosOrder);
            const footerRowCount = 2 + (order.promo_code_code ? 1 : 0) + (order.shipping_fee > 0 ? 1 : 0);

            return (
              <div
                key={order.id}
                id={`order-${order.id}`}
                className="card !border-none overflow-hidden transition-all duration-200 w-full min-w-0 max-w-full"
              >
                {/* Collapsible Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="relative p-3.5 sm:p-4 cursor-pointer hover:bg-surface-muted/40 dark:hover:bg-[#161616]/40 transition flex flex-col md:flex-row gap-3 sm:gap-4 justify-between items-start md:items-center select-none w-full min-w-0"
                >
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                    {/* Product Thumbnail */}
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0">
                      <div className="w-full h-full rounded-xl bg-surface-muted dark:bg-[#161616] overflow-hidden flex items-center justify-center">
                        {itemsList[0]?.product_image ? (
                          <img
                            src={itemsList[0].product_image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package size={20} className="text-gray-400" />
                        )}
                      </div>
                      {itemsList.length > 1 && (
                        <div className="absolute -bottom-1 -right-1 bg-brand-500 text-white text-[10px] font-black w-4 h-4 rounded-md flex items-center justify-center shadow-sm border border-white dark:border-gray-900">
                          +{itemsList.length - 1}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                          {/* Order ID & Buyer / POS Badge - Always on same line */}
                          <div className="flex items-center gap-1.5 min-w-0 shrink">
                            <span className="font-extrabold text-sm text-gray-900 dark:text-white shrink-0 whitespace-nowrap">
                              Order #{order.id}
                            </span>
                            {order.delivery_info?.is_pos ? (
                              <>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 inline-flex items-center gap-1 shrink-0">
                                  <Receipt size={10} /> POS
                                </span>
                                <span className="text-2xs text-gray-400 truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none hidden sm:inline">
                                  {order.delivery_info?.customer_name || 'Walk-in Customer'}
                                </span>
                              </>
                            ) : (
                              <span className="text-2xs text-gray-400 truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none">
                                @{order.buyer || 'Customer'}
                              </span>
                            )}
                          </div>

                          {order.fulfillment_location_name && (
                            <span className="inline-flex items-center gap-1 text-3xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 shrink-0">
                              <MapPin size={9} />
                              {order.fulfillment_location_name}
                            </span>
                          )}

                          {order.is_bulk_order && (
                            <span className="px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-tight bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 shrink-0">
                              {t('bulk_order', 'Bulk Order')}
                            </span>
                          )}
                        </div>

                        {/* Status Badge & Chevron - Mobile Only (Top Right) */}
                        <div className="flex items-center gap-1.5 shrink-0 md:hidden ml-auto">
                          <StatusBadge status={order.status} size="sm" />
                          <div className="text-gray-400 p-0.5">
                            <ChevronDown
                              size={16}
                              className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 text-2xs text-gray-400 flex-wrap min-w-0">
                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-full block">
                          {itemsList[0]?.product_name || 'Item'}
                          {itemsList.length > 1 ? ` (+${itemsList.length - 1} more)` : ''}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock size={12} /> {fmtOrderDate(order.order_date)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Package size={12} /> {itemsList.length} {t('items', 'items')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Chevron */}
                  <div
                    className={`flex items-center gap-2 md:w-auto shrink-0 justify-between md:justify-end ${
                      nextStatus || !order.delivery_info?.is_pos ? 'w-full mt-2 md:mt-0' : 'hidden md:flex'
                    }`}
                  >
                    {/* Desktop Status Badge */}
                    <div className="hidden md:flex items-center shrink-0">
                      <StatusBadge status={order.status} size="sm" />
                    </div>

                    {(nextStatus || !order.delivery_info?.is_pos) && (
                      <div className="flex items-center gap-2 flex-wrap flex-1 md:flex-initial">
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
                          <OrderActionToolbar
                            phone={order.delivery_info?.phone || order.buyer_contact?.phone || null}
                            phoneLabel="Call Buyer"
                            username={order.buyer_username || order.buyer || null}
                            messageLabel="Chat"
                            orderId={order.id}
                            location={
                              order.delivery_latitude && order.delivery_longitude
                                ? { lat: order.delivery_latitude, lng: order.delivery_longitude, address: order.delivery_info?.address }
                                : order.delivery_info?.address
                                ? { address: order.delivery_info.address }
                                : null
                            }
                            locationLabel="Directions"
                            size="sm"
                          />
                        )}
                      </div>
                    )}

                    <div className="hidden md:block p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition shrink-0">
                      <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Collapsible Body */}
                {isExpanded && (
                  <div className="p-4 pt-0 space-y-4 text-xs bg-surface-muted/20 dark:bg-[#131313]/30">
                    {/* Payment Verification Callout */}
                    {hasPendingPayment && order.payments?.length > 0 && (
                      <div className="py-2 space-y-3 mt-1">
                        <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-bold text-xs">
                          <span>Payment Verification Needed</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            {order.payments
                              .filter((p: any) => p.status === 'PENDING_VERIFICATION')
                              .map((p: any) => (
                                <div key={p.id} className="p-3.5 rounded-btn bg-surface-muted/50 dark:bg-[#161616]">
                                  {p.proof_image ? (
                                    <div className="flex items-center gap-3.5">
                                      {/* Proof Image on Left */}
                                      <div
                                        onClick={() => setZoomImage(p.proof_image)}
                                        className="relative rounded-btn overflow-hidden cursor-zoom-in group w-24 h-24 sm:w-28 sm:h-24 bg-black/40 shrink-0"
                                      >
                                        <img src={p.proof_image} alt="Proof" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-3xs font-bold gap-1 text-center p-1">
                                          <Eye size={12} /> View
                                        </div>
                                      </div>

                                      {/* Payment Info on Right */}
                                      <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex justify-between items-center text-2xs">
                                          <span className="font-bold text-gray-500">TRANSACTION ID</span>
                                          <span className="font-mono text-xs font-bold text-gray-900 dark:text-white select-all break-all">{p.transaction_id || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-2xs">
                                          <span className="font-bold text-gray-500">AMOUNT PAID</span>
                                          <span className="font-extrabold text-sm text-gray-900 dark:text-white">TSh {(p.amount || 0).toLocaleString()}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-2xs font-bold text-gray-500">
                                        <span>TRANSACTION ID</span>
                                        <span className="font-mono text-gray-900 dark:text-white select-all">{p.transaction_id || 'N/A'}</span>
                                      </div>
                                      <div className="flex justify-between text-2xs font-bold text-gray-500">
                                        <span>AMOUNT PAID</span>
                                        <span className="font-extrabold text-gray-900 dark:text-white">TSh {(p.amount || 0).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>

                          <div className="flex flex-col justify-center gap-2 p-3.5 rounded-btn bg-surface-muted/50 dark:bg-[#161616]">
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
                                onClick={() => handleAdvance(order.id, isDeliveryPayment ? 'AWAITING_DELIVERY_PAYMENT' : 'AWAITING_PAYMENT', 'Payment proof rejected.')}
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
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-left text-xs">
                        <thead className="text-2xs uppercase tracking-wider text-gray-400 font-bold">
                          <tr>
                            <th className="py-2.5 px-1">Item Description</th>
                            <th className="py-2.5 px-2 text-center">Qty</th>
                            <th className="py-2.5 px-2 text-right">Unit Price</th>
                            <th className="py-2.5 px-1 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsList.map((item: any) => (
                            <tr key={item.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30">
                              <td className="py-2.5 px-1 font-medium text-gray-900 dark:text-white">
                                {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                              </td>
                              <td className="py-2.5 px-2 text-center text-gray-500">{item.quantity}</td>
                              <td className="py-2.5 px-2 text-right text-gray-700 dark:text-gray-300">
                                TSh {(item.price || 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-1 text-right font-bold text-gray-900 dark:text-white">
                                TSh {(item.subtotal || (item.price * item.quantity) || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2} rowSpan={footerRowCount} className="align-bottom pb-1 px-1">
                              {isOrderPaid && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedReceiptOrder({ ...order, items: itemsList });
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-100 dark:bg-[#161616] dark:hover:bg-[#202020] dark:text-neutral-200 dark:hover:text-white transition cursor-pointer border-0 border-none outline-none focus:outline-none"
                                  title="View Receipt"
                                >
                                  <Printer size={13} className="shrink-0" />
                                  <span>View Receipt</span>
                                </button>
                              )}
                            </td>
                            <td className="pt-3 pb-1 px-2 text-right text-2xs text-gray-400 font-medium whitespace-nowrap">
                              Subtotal
                            </td>
                            <td className="pt-3 pb-1 px-1 text-right text-xs font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                              TSh {(parseFloat(order.total_amount || 0) - parseFloat(order.shipping_fee || 0)).toLocaleString()}
                            </td>
                          </tr>
                          {order.promo_code_code && (
                            <tr>
                              <td className="py-1 px-2 text-right text-2xs text-emerald-500 font-medium whitespace-nowrap">
                                Promo ({order.promo_code_code})
                              </td>
                              <td className="py-1 px-1 text-right text-xs font-medium text-emerald-500 whitespace-nowrap">
                                -TSh {parseInt(order.discount_amount || 0).toLocaleString()}
                              </td>
                            </tr>
                          )}
                          {order.shipping_fee > 0 && (
                            <tr>
                              <td className="py-1 px-2 text-right text-2xs text-gray-400 font-medium whitespace-nowrap">
                                Shipping Fee
                              </td>
                              <td className="py-1 px-1 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                TSh {Number(order.shipping_fee).toLocaleString()}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="pt-2 pb-1 px-2 text-right text-xs font-bold text-gray-900 dark:text-white border-t border-surface-border dark:border-surface-dark-border whitespace-nowrap">
                              Total
                            </td>
                            <td className="pt-2 pb-1 px-1 text-right text-xs font-extrabold text-gray-900 dark:text-white border-t border-surface-border dark:border-surface-dark-border whitespace-nowrap">
                              TSh {parseInt(order.total_amount || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Footer Actions */}
                    {(order.status === 'SHIPPED_TO_WAREHOUSE' || ['AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'PAID', 'SELLER_CONFIRMED', 'PREPARING', 'PACKAGING'].includes(order.status)) && (
                      <div className="flex items-center justify-end gap-2 pt-2">
                        {order.status === 'SHIPPED_TO_WAREHOUSE' && (
                          <div className="flex items-center gap-2 p-2 rounded-btn bg-surface-muted dark:bg-[#161616]">
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
                    )}
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
          <div className="bg-white dark:bg-[#141414] rounded-card w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Ship to Warehouse
                </h3>
                <p className="text-2xs text-gray-500 dark:text-gray-400">
                  Select the intake hub to dispatch Order #{shipModalOpen}
                </p>
              </div>
              <button onClick={() => setShipModalOpen(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={18} />
              </button>
            </div>
            
            <div className="px-5 py-2 space-y-3.5 text-xs">
              {/* Warehouse Selection */}
              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Intake Warehouse
                </label>
                <select
                  required
                  className="w-full px-3 py-2.5 text-xs rounded-btn bg-surface-muted/60 dark:bg-[#1e1e1e] dark:text-white border-0 outline-none focus:ring-1 focus:ring-brand-500/40"
                  value={shipWarehouseCode}
                  onChange={(e) => setShipWarehouseCode(e.target.value)}
                >
                  {regionWarehouses.length === 0 ? (
                    <option value="">No warehouse in {shipRegion || 'region'}</option>
                  ) : (
                    regionWarehouses.map(w => (
                      <option key={w.code} value={w.code}>
                        {w.name} {w.district ? `(${w.district})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Exact Location Card (Compact & Clean) */}
              {selectedWh && (
                <div className="p-3.5 rounded-btn bg-surface-muted/50 dark:bg-[#181818] space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 dark:text-white">{selectedWh.name}</span>
                    <span className="text-3xs font-mono text-brand-600 dark:text-brand-400 font-semibold">{selectedWh.code}</span>
                  </div>
                  <p className="text-2xs text-gray-500 dark:text-gray-400">
                    {selectedWh.address || 'Central Hub'}{selectedWh.district ? ` • ${selectedWh.district}` : ''}
                  </p>
                </div>
              )}
              
              {/* Courier Notes */}
              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700 dark:text-gray-300">Courier / Delivery Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Sent via Bodaboda, Plate MC 123, Rider: Juma (0712...)"
                  className="w-full px-3 py-2.5 text-xs rounded-btn bg-surface-muted/60 dark:bg-[#1e1e1e] dark:text-white border-0 outline-none focus:ring-1 focus:ring-brand-500/40 placeholder:text-gray-500"
                  value={shipNotes}
                  onChange={(e) => setShipNotes(e.target.value)}
                />
              </div>
            </div>
            
            <div className="p-5 pt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShipModalOpen(null)}>
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

      {/* Thermal Receipt Modal */}
      {selectedReceiptOrder && (
        <ReceiptModal
          order={selectedReceiptOrder}
          onClose={() => setSelectedReceiptOrder(null)}
        />
      )}
    </div>
  );
};

export default DashboardOrders;
