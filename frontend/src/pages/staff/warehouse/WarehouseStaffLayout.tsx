import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { 
  Package, Truck, QrCode, X, 
  Search, RefreshCw, CheckCircle, Eye,
  ExternalLink, ShieldCheck, AlertCircle
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';
import { CardGridSkeleton } from '../../../components/Skeleton';

interface Warehouse {
  id: number | string;
  code: string;
  name: string;
  [key: string]: any;
}

interface PaymentRecord {
  id: number | string;
  order?: number | string;
  payment_method?: string;
  proof_image?: string | null;
  transaction_id?: string;
  status: string;
  amount?: number | string;
  created_at?: string;
  [key: string]: any;
}

interface Order {
  id: number | string;
  status: string;
  shipping_fee?: number | string;
  fulfillment_type?: string;
  shipping_method?: string;
  delivery_info?: {
    destination_warehouse_code?: string;
    full_name?: string;
    address?: string;
    current_warehouse_code?: string;
    phone?: string;
    [key: string]: any;
  };
  payments?: PaymentRecord[];
  items?: Array<any>;
  shipments?: Array<any>;
  [key: string]: any;
}

interface Transfer {
  id: number | string;
  order: number | string;
  destination_warehouse?: string | number;
  source_warehouse?: string | number;
  source_warehouse_name?: string;
  destination_warehouse_name?: string;
  status: string;
  created_at: string;
  shipped_at?: string;
  [key: string]: any;
}

interface Driver {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: any;
}

const WarehouseStaffLayout: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  
  // Queues
  const [pendingIntakes, setPendingIntakes] = useState<Order[]>([]);
  const [receivedIntakes, setReceivedIntakes] = useState<Order[]>([]);
  const [awaitingPayments, setAwaitingPayments] = useState<Order[]>([]);
  const [outboundOrders, setOutboundOrders] = useState<Order[]>([]);
  const [readyForPickup, setReadyForPickup] = useState<Order[]>([]);
  const [incomingTransfers, setIncomingTransfers] = useState<Transfer[]>([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState<Transfer[]>([]);

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<'local' | 'transfers'>('local');
  const [queueFilter, setQueueFilter] = useState<string>('pending_intake');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals & Forms
  const [activeModal, setActiveModal] = useState<'intake' | 'pricing' | 'dispatch' | 'pickup' | 'verify_payment' | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [zoomReceipt, setZoomReceipt] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Intake State
  const [condition, setCondition] = useState('good');
  const [intakeNotes, setIntakeNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const sellerSigRef = useRef<SignatureCanvas>(null);
  const staffSigRef = useRef<SignatureCanvas>(null);

  // Pricing State
  const [deliveryFee, setDeliveryFee] = useState('');
  const [destinationWarehouseCode, setDestinationWarehouseCode] = useState('');
  const [suggestedFee, setSuggestedFee] = useState<number | null>(null);

  // Pickup State
  const [pickupCode, setPickupCode] = useState('');

  // Dispatch State
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [carrierType, setCarrierType] = useState<'driver' | 'third_party'>('driver');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  // Quick Scanner
  const [scanCode, setScanCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load Warehouses & Drivers
  useEffect(() => {
    api.get('/api/warehouses/warehouses/')
      .then(res => {
        const list = res.data.results || res.data || [];
        setWarehouses(list);
        if (list.length > 0) {
          const savedId = localStorage.getItem('sokonimax_warehouse_id');
          if (savedId && list.some((w: Warehouse) => w.id.toString() === savedId)) {
            setSelectedWarehouseId(savedId);
          } else {
            setSelectedWarehouseId(list[0].id.toString());
          }
        }
      })
      .catch(() => toast.error('Failed to load warehouses list'));

    api.get('/api/logistics/shipments/drivers/')
      .then(res => setDrivers(res.data.results || res.data || []))
      .catch(() => toast.error('Failed to load drivers list'));
  }, []);

  // Fetch suggested delivery fee
  useEffect(() => {
    if (activeModal === 'pricing' && destinationWarehouseCode && selectedWarehouseId) {
      api.get(`/api/warehouses/warehouses/${selectedWarehouseId}/suggested-fee/?destination_warehouse=${destinationWarehouseCode}`)
        .then(res => {
          if (res.data.suggested_fee) {
            setSuggestedFee(res.data.suggested_fee);
            setDeliveryFee(res.data.suggested_fee.toString());
          } else {
            setSuggestedFee(null);
            setDeliveryFee('');
          }
        })
        .catch(() => {
          setSuggestedFee(null);
        });
    }
  }, [destinationWarehouseCode, activeModal, selectedWarehouseId]);

  // Fetch all queues for selected warehouse
  const fetchAllQueues = async (whId: string) => {
    if (!whId) return;
    setLoading(true);
    try {
      const [pendingRes, pricingRes, waitingRes, dispatchRes, pickupRes, transfersInTransitRes, transfersPendingRes] = await Promise.all([
        api.get(`/api/warehouses/warehouses/${whId}/pending-intakes/`),
        api.get(`/api/warehouses/warehouses/${whId}/received-intakes/`),
        api.get(`/api/warehouses/warehouses/${whId}/awaiting-payment/`),
        api.get(`/api/warehouses/warehouses/${whId}/outbound-queue/`),
        api.get(`/api/warehouses/warehouses/${whId}/ready-for-pickup/`),
        api.get(`/api/warehouses/transfers/?warehouse=${whId}&status=in_transit`),
        api.get(`/api/warehouses/transfers/?warehouse=${whId}&status=pending`)
      ]);
      setPendingIntakes(pendingRes.data.results || pendingRes.data || []);
      setReceivedIntakes(pricingRes.data.results || pricingRes.data || []);
      setAwaitingPayments(waitingRes.data.results || waitingRes.data || []);
      setOutboundOrders(dispatchRes.data.results || dispatchRes.data || []);
      setReadyForPickup(pickupRes.data.results || pickupRes.data || []);

      const incoming = (transfersInTransitRes.data.results || transfersInTransitRes.data || []).filter(
        (t: Transfer) => t.destination_warehouse?.toString() === whId
      );
      setIncomingTransfers(incoming);

      const outgoing = (transfersPendingRes.data.results || transfersPendingRes.data || []).filter(
        (t: Transfer) => t.source_warehouse?.toString() === whId
      );
      setOutgoingTransfers(outgoing);
    } catch {
      toast.error('Failed to sync warehouse inventory queues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWarehouseId) {
      localStorage.setItem('sokonimax_warehouse_id', selectedWarehouseId);
      fetchAllQueues(selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  // Quick Scan handler
  const handleScanLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;
    setScanning(true);
    try {
      const res = await api.get(`/api/warehouses/intakes/preview-order/?order_id=${encodeURIComponent(scanCode.trim())}`);
      const order = res.data;
      if (order && order.id) {
        setSelectedOrder(order);
        setDestinationWarehouseCode(order.delivery_info?.destination_warehouse_code || '');
        setDeliveryFee(order.shipping_fee ? String(order.shipping_fee) : '');
        toast.success(`Found Order #${order.id}`);
        const st = (order.status || '').toUpperCase();
        if (['SHIPPED_TO_WAREHOUSE', 'PAID', 'PAID_PRODUCT', 'PREPARING', 'PACKAGING', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'IN_TRANSIT', 'FAILED_DELIVERY'].includes(st)) {
          setActiveModal('intake');
        } else if (['RECEIVED_AT_WAREHOUSE', 'AWAITING_DELIVERY_PAYMENT'].includes(st)) {
          setActiveModal('pricing');
        } else if (['READY_FOR_PICKUP', 'READY_FOR_VEHICLE_HANDOVER'].includes(st)) {
          setActiveModal('pickup');
        } else {
          setActiveModal('dispatch');
        }
      } else {
        toast.error('Order not found with that tracking code');
      }
    } catch {
      toast.error('Scan lookup failed. Please verify code.');
    } finally {
      setScanning(false);
      setScanCode('');
    }
  };

  // Submit Intake
  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('warehouse', selectedWarehouseId.toString());
      formData.append('order', selectedOrder.id.toString());
      formData.append('package_condition', condition);
      formData.append('notes', intakeNotes);
      if (photo) formData.append('photo', photo);

      if (sellerSigRef.current && !sellerSigRef.current.isEmpty()) {
        const sellerSig = sellerSigRef.current.getTrimmedCanvas().toDataURL('image/png');
        formData.append('seller_signature', sellerSig);
      }
      if (staffSigRef.current && !staffSigRef.current.isEmpty()) {
        const staffSig = staffSigRef.current.getTrimmedCanvas().toDataURL('image/png');
        formData.append('staff_signature', staffSig);
      }

      await api.post('/api/warehouses/intakes/', formData);
      toast.success('Package intake recorded successfully!');
      setActiveModal(null);
      setSelectedOrder(null);
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Intake recording failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Pricing
  const handleSubmitPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      await api.post(`/api/warehouses/warehouses/${selectedWarehouseId}/set-delivery-fee/`, {
        order_id: selectedOrder.id,
        fee: deliveryFee,
        delivery_fee: deliveryFee,
        destination_warehouse: destinationWarehouseCode,
        destination_warehouse_code: destinationWarehouseCode
      });
      toast.success('Delivery fee updated!');
      setActiveModal(null);
      setSelectedOrder(null);
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to set pricing');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Dispatch
  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      await api.post(`/api/warehouses/warehouses/${selectedWarehouseId}/dispatch-order/`, {
        order_id: selectedOrder.id,
        carrier_type: carrierType,
        driver_id: carrierType === 'driver' && selectedDriverId ? parseInt(selectedDriverId) : null,
        tracking_number: trackingNumber,
        estimated_delivery: estimatedDelivery ? new Date(estimatedDelivery).toISOString() : null
      });
      toast.success('Order dispatched successfully!');
      setActiveModal(null);
      setSelectedOrder(null);
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Dispatch failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Customer Pickup
  const handleSubmitPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      await api.post('/api/warehouses/pickup/verify/', {
        code: pickupCode
      });
      toast.success('Customer pickup confirmed!');
      setActiveModal(null);
      setSelectedOrder(null);
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Pickup verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Verify Delivery Fee Payment (Approve or Reject)
  const handleVerifyDeliveryPayment = async (action: 'approve' | 'reject') => {
    if (!selectedOrder) return;
    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please enter a rejection reason.');
      return;
    }

    setPaymentSubmitting(true);
    try {
      await api.post(`/api/warehouses/warehouses/${selectedWarehouseId}/verify-delivery-payment/`, {
        order_id: selectedOrder.id,
        action,
        reason: rejectionReason.trim(),
      });
      if (action === 'approve') {
        toast.success('Delivery payment verified and approved! Order advanced.');
      } else {
        toast.success('Payment rejected. Buyer notified to re-submit.');
      }
      setActiveModal(null);
      setSelectedOrder(null);
      setRejectionReason('');
      setIsRejecting(false);
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || `Failed to ${action} payment`);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const pendingVerificationCount = useMemo(() => {
    return awaitingPayments.filter((o) => o.status === 'PENDING_DELIVERY_VERIFICATION').length;
  }, [awaitingPayments]);

  // Filter queue items
  const activeOrders = useMemo(() => {
    let list: Order[] = [];
    if (queueFilter === 'pending_intake') list = pendingIntakes;
    else if (queueFilter === 'received') list = receivedIntakes;
    else if (queueFilter === 'awaiting_payment') {
      list = [...awaitingPayments].sort((a, b) => {
        if (a.status === 'PENDING_DELIVERY_VERIFICATION' && b.status !== 'PENDING_DELIVERY_VERIFICATION') return -1;
        if (b.status === 'PENDING_DELIVERY_VERIFICATION' && a.status !== 'PENDING_DELIVERY_VERIFICATION') return 1;
        return 0;
      });
    }
    else if (queueFilter === 'outbound') list = outboundOrders;
    else if (queueFilter === 'ready_for_pickup') list = readyForPickup;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (o) =>
        String(o.id).includes(q) ||
        (o.delivery_info?.full_name || '').toLowerCase().includes(q) ||
        (o.delivery_info?.phone || '').includes(q)
    );
  }, [queueFilter, pendingIntakes, receivedIntakes, awaitingPayments, outboundOrders, readyForPickup, searchQuery]);

  const activeTransfers = useMemo(() => {
    let list: Transfer[] = [];
    if (queueFilter === 'incoming_transfers') list = incomingTransfers;
    else if (queueFilter === 'outgoing_transfers') list = outgoingTransfers;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (t) =>
        String(t.id).includes(q) ||
        String(t.order).includes(q) ||
        (t.source_warehouse_name || '').toLowerCase().includes(q) ||
        (t.destination_warehouse_name || '').toLowerCase().includes(q)
    );
  }, [queueFilter, incomingTransfers, outgoingTransfers, searchQuery]);

  const localFilterTabs = [
    { key: 'pending_intake', label: 'Pending Intake', count: pendingIntakes.length },
    { key: 'received', label: 'Received / Set Pricing', count: receivedIntakes.length },
    {
      key: 'awaiting_payment',
      label: pendingVerificationCount > 0 ? `Delivery Payments (${pendingVerificationCount} ready)` : 'Awaiting Buyer Payment',
      count: awaitingPayments.length,
    },
    { key: 'outbound', label: 'Outbound Dispatch', count: outboundOrders.length },
    { key: 'ready_for_pickup', label: 'Ready for Pickup', count: readyForPickup.length },
  ];

  const transferFilterTabs = [
    { key: 'incoming_transfers', label: 'Incoming In-Transit', count: incomingTransfers.length },
    { key: 'outgoing_transfers', label: 'Pending Dispatch', count: outgoingTransfers.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Warehouse Intake & Hub Operations</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Physical package intake, inspection logs, shipping tariffs, cross-docking, and customer pickup fulfillment.
          </p>
        </div>

        {/* Warehouse Selector & Refresh */}
        <div className="flex items-center gap-2">
          <select
            className="input text-xs font-bold py-1.5 min-w-[200px]"
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id.toString()}>{w.name} ({w.code})</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAllQueues(selectedWarehouseId)}
            className="p-2 shrink-0"
            title="Refresh Queues"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </header>

      {/* Quick Scanner & Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Universal Mode Switcher */}
        <div className="flex bg-surface-muted dark:bg-[#161616] p-1 rounded-full border border-surface-border dark:border-surface-dark-border w-fit">
          <button
            type="button"
            onClick={() => {
              setActiveTab('local');
              setQueueFilter('pending_intake');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              activeTab === 'local'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Local Logistics
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('transfers');
              setQueueFilter('incoming_transfers');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              activeTab === 'transfers'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Inter-Warehouse Line-Haul
          </button>
        </div>

        {/* Scan / Barcode Form */}
        <form onSubmit={handleScanLookup} className="md:col-span-2 flex gap-2">
          <div className="relative flex-1">
            <QrCode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              placeholder="Scan Barcode / Waybill / Order #..."
              className="input pl-8 py-1.5 text-xs w-full font-mono"
            />
          </div>
          <Button type="submit" variant="default" size="sm" disabled={scanning}>
            {scanning ? <Spinner size="sm" /> : 'Lookup'}
          </Button>
        </form>
      </div>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(activeTab === 'local' ? localFilterTabs : transferFilterTabs).map((tab) => {
            const isActive = queueFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setQueueFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.2 rounded-full text-3xs font-black ${
                  isActive
                    ? 'bg-white/20 dark:bg-black/20 text-inherit'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders, customers, phone..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Orders or Transfers Grid */}
      {loading ? (
        <CardGridSkeleton count={6} cols={3} />
      ) : activeTab === 'local' ? (
        activeOrders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Queue is Empty"
            description={searchQuery ? 'No orders match your search query.' : 'There are currently no orders in this warehouse queue.'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrders.map((order) => (
              <div key={order.id} className="card p-5 flex flex-col justify-between space-y-4 hover:border-gray-900/20 dark:hover:border-white/20 transition">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-3xs font-mono font-bold text-gray-400 uppercase">ORD-{order.id}</span>
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">Order #{order.id}</h3>
                    </div>
                    {order.status === 'PENDING_DELIVERY_VERIFICATION' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Verify Payment
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-500/10 text-brand-500 border border-brand-500/20 capitalize">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {/* Clean Unboxed Metadata */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400 dark:text-gray-500 font-normal">Customer</span>
                      <span className="font-medium text-gray-900 dark:text-gray-200">{order.delivery_info?.full_name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 dark:text-gray-500 font-normal">Phone</span>
                      <span className="font-medium text-gray-900 dark:text-gray-200">{order.delivery_info?.phone || 'N/A'}</span>
                    </div>
                    {order.shipping_fee !== undefined && Number(order.shipping_fee) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-normal">Delivery Fee</span>
                        <span className="font-bold text-amber-500">TSh {Number(order.shipping_fee).toLocaleString()}</span>
                      </div>
                    )}
                    {order.delivery_info?.destination_warehouse_code && (
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-normal">Dest. Hub</span>
                        <span className="font-medium text-brand-500">{order.delivery_info.destination_warehouse_code}</span>
                      </div>
                    )}
                    {order.status === 'PENDING_DELIVERY_VERIFICATION' && (
                      <div className="flex justify-between items-center pt-1 mt-1 border-t border-surface-border/30">
                        <span className="text-gray-400 font-normal">Tx Ref</span>
                        <span className="font-mono text-xs font-bold text-amber-500">
                          {order.payments?.find(p => p.status === 'PENDING_VERIFICATION')?.transaction_id || order.payments?.[order.payments.length - 1]?.transaction_id || 'Attached'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contextual Action Button */}
                <div className="pt-2 border-t border-surface-border/40">
                  {queueFilter === 'pending_intake' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => { setSelectedOrder(order); setActiveModal('intake'); }}
                      className="w-full"
                    >
                      Record Package Intake
                    </Button>
                  )}
                  {queueFilter === 'received' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(order);
                        setDestinationWarehouseCode(order.delivery_info?.destination_warehouse_code || '');
                        setDeliveryFee(order.shipping_fee ? String(order.shipping_fee) : '');
                        setActiveModal('pricing');
                      }}
                      className="w-full"
                    >
                      Set Delivery Fee
                    </Button>
                  )}
                  {queueFilter === 'awaiting_payment' && (
                    order.status === 'PENDING_DELIVERY_VERIFICATION' ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsRejecting(false);
                          setRejectionReason('');
                          setActiveModal('verify_payment');
                        }}
                        className="w-full font-bold flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck size={14} />
                        Review Delivery Payment
                      </Button>
                    ) : (
                      <div className="text-center py-2 text-[11px] text-amber-500/80 font-medium bg-amber-500/5 rounded-btn border border-amber-500/10">
                        Waiting for buyer payment
                      </div>
                    )
                  )}
                  {queueFilter === 'outbound' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => { setSelectedOrder(order); setActiveModal('dispatch'); }}
                      className="w-full"
                    >
                      Dispatch / Route Shipment
                    </Button>
                  )}
                  {queueFilter === 'ready_for_pickup' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => { setSelectedOrder(order); setActiveModal('pickup'); }}
                      className="w-full"
                    >
                      Verify Customer Pickup
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        activeTransfers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No Transfers Found"
            description="No line-haul transfers found matching this filter."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTransfers.map((t) => (
              <div key={t.id} className="card p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-3xs font-mono font-bold text-gray-400 uppercase">TRF-{t.id}</span>
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">Order #{t.order}</h3>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 capitalize">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Clean Unboxed Metadata */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400 dark:text-gray-500 font-normal">Origin</span>
                      <span className="font-medium text-gray-900 dark:text-gray-200">{t.source_warehouse_name || `Hub #${t.source_warehouse}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 dark:text-gray-500 font-normal">Destination</span>
                      <span className="font-medium text-gray-900 dark:text-gray-200">{t.destination_warehouse_name || `Hub #${t.destination_warehouse}`}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-surface-border/40">
                  {queueFilter === 'incoming_transfers' ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api.post(`/api/warehouses/transfers/${t.id}/receive/`);
                          toast.success('Transfer package received at destination hub!');
                          fetchAllQueues(selectedWarehouseId);
                        } catch {
                          toast.error('Failed to receive transfer');
                        }
                      }}
                      className="w-full"
                    >
                      Confirm Hub Intake
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api.post(`/api/warehouses/transfers/${t.id}/dispatch/`);
                          toast.success('Transfer package dispatched for line-haul transit!');
                          fetchAllQueues(selectedWarehouseId);
                        } catch {
                          toast.error('Failed to dispatch transfer');
                        }
                      }}
                      className="w-full"
                    >
                      Dispatch Line-Haul
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Intake Modal */}
      {activeModal === 'intake' && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setActiveModal(null)}>
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-surface-border dark:border-surface-dark-border">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Record Intake: Order #{selectedOrder.id}</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitIntake} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Package Condition</label>
                <select className="input" value={condition} onChange={(e) => setCondition(e.target.value)}>
                  <option value="good">Good / Sealed (No visible damage)</option>
                  <option value="damaged">Damaged Box / Torn Packaging</option>
                  <option value="missing_items">Missing Items / Incomplete</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Intake Notes</label>
                <textarea
                  rows={2}
                  className="input"
                  placeholder="Verification notes or inspection observations..."
                  value={intakeNotes}
                  onChange={(e) => setIntakeNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Package Photograph</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPhoto(f);
                      setPhotoPreview(URL.createObjectURL(f));
                    }
                  }}
                  className="input text-xs"
                />
                {photoPreview && (
                  <img src={photoPreview} alt="Intake preview" className="mt-2 h-28 rounded-btn object-cover border border-surface-border" />
                )}
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-surface-border dark:border-surface-dark-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveModal(null)}>Cancel</Button>
                <Button type="submit" variant="default" size="sm" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Confirm Intake'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      {activeModal === 'pricing' && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setActiveModal(null)}>
          <div className="card max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-surface-border">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Set Delivery Tariff</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmitPricing} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Destination Hub</label>
                {warehouses.length > 0 && (
                  <select
                    className="input text-xs mb-1.5"
                    value={destinationWarehouseCode}
                    onChange={(e) => setDestinationWarehouseCode(e.target.value)}
                  >
                    <option value="">-- Same Warehouse / Local Delivery --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.code}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  className="input font-mono text-xs"
                  placeholder="Or enter custom hub code, e.g. DAR-01"
                  value={destinationWarehouseCode}
                  onChange={(e) => setDestinationWarehouseCode(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Delivery Fee (TZS) {suggestedFee && <span className="text-brand-500 font-normal">(Suggested: {suggestedFee.toLocaleString()})</span>}
                </label>
                <input
                  type="number"
                  required
                  className="input font-bold"
                  placeholder="e.g. 5000"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-surface-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveModal(null)}>Cancel</Button>
                <Button type="submit" variant="default" size="sm" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save & Notify Buyer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {activeModal === 'dispatch' && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setActiveModal(null)}>
          <div className="card max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-surface-border">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Dispatch Order #{selectedOrder.id}</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmitDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Carrier Mode</label>
                <select className="input" value={carrierType} onChange={(e) => setCarrierType(e.target.value as any)}>
                  <option value="driver">SokoniMax Fleet Driver</option>
                  <option value="third_party">Third-Party Courier</option>
                </select>
              </div>

              {carrierType === 'driver' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Assign Driver</label>
                  <select className="input" value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}>
                    <option value="">-- Select Driver --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id.toString()}>@{d.username} ({d.first_name} {d.last_name})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Waybill / Tracking Reference</label>
                <input
                  type="text"
                  className="input font-mono"
                  placeholder="e.g. TRK-98319"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Est. Delivery / Handover Window</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-surface-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveModal(null)}>Cancel</Button>
                <Button type="submit" variant="default" size="sm" disabled={submitting}>
                  {submitting ? 'Dispatching...' : 'Dispatch Shipment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pickup Modal */}
      {activeModal === 'pickup' && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setActiveModal(null)}>
          <div className="card max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-surface-border">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Customer Pickup Verification</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmitPickup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  6-Digit Pickup Code from Customer
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 593021"
                  value={pickupCode}
                  onChange={(e) => setPickupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center font-mono font-black text-xl tracking-[0.25em]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-surface-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveModal(null)}>Cancel</Button>
                <Button type="submit" variant="default" size="sm" disabled={submitting || pickupCode.length !== 6}>
                  {submitting ? 'Verifying...' : 'Confirm Handover & Finalize'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Delivery Payment Modal */}
      {activeModal === 'verify_payment' && selectedOrder && (() => {
        const pendingPayment = selectedOrder.payments?.find(p => p.status === 'PENDING_VERIFICATION') || selectedOrder.payments?.[selectedOrder.payments.length - 1];
        const feeAmount = Number(selectedOrder.shipping_fee || pendingPayment?.amount || 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setActiveModal(null)}>
            <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center pb-2 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} className="text-amber-500" />
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Verify Delivery Payment</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>

              {/* Order & Route Overview */}
              <div className="p-3 rounded-btn bg-surface-muted/50 dark:bg-[#111] border border-surface-border space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Order Reference</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">ORD-{selectedOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Buyer</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedOrder.delivery_info?.full_name || 'Customer'} ({selectedOrder.delivery_info?.phone || 'No Phone'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fulfillment Mode</span>
                  <span className="font-medium text-brand-500">
                    {selectedOrder.fulfillment_type === 'WAREHOUSE_PICKUP' ? 'Hub Pickup' : 'Line-Haul / Delivery'}
                  </span>
                </div>
                {selectedOrder.delivery_info?.destination_warehouse_code && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Destination Hub</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {selectedOrder.delivery_info.destination_warehouse_code}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-surface-border/50 text-sm font-bold">
                  <span className="text-gray-400">Required Delivery Fee</span>
                  <span className="text-amber-500">TSh {feeAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Proof Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700 dark:text-gray-300 uppercase">Payment Proof Details</span>
                  {pendingPayment && (
                    <span className="text-2xs font-mono text-gray-400">
                      Payment #{pendingPayment.id} • {pendingPayment.created_at ? new Date(pendingPayment.created_at).toLocaleString() : ''}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-btn bg-surface-muted/30 dark:bg-[#141414] border border-surface-border space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Payment Method</span>
                    <span className="font-medium uppercase text-gray-900 dark:text-gray-200">
                      {pendingPayment?.payment_method || 'OFFLINE'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Amount Paid</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      TSh {Number(pendingPayment?.amount || feeAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-400 block">Transaction Reference / ID</span>
                    <div className="p-2 rounded-btn bg-black/40 border border-surface-border font-mono font-bold text-sm text-amber-400 select-all tracking-wider">
                      {pendingPayment?.transaction_id || 'None Provided'}
                    </div>
                  </div>
                </div>

                {/* Receipt Photo */}
                {pendingPayment?.proof_image ? (
                  <div className="space-y-1.5">
                    <label className="block text-2xs font-bold text-gray-400 uppercase">Receipt Photograph</label>
                    <div
                      onClick={() => setZoomReceipt(pendingPayment.proof_image || null)}
                      className="relative group cursor-zoom-in rounded-btn overflow-hidden border border-surface-border bg-black/60 max-h-56 flex items-center justify-center p-2"
                    >
                      <img src={pendingPayment.proof_image} alt="Proof" className="max-h-52 w-auto object-contain rounded" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5">
                        <Eye size={14} /> Click to Enlarge Receipt
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <a
                        href={pendingPayment.proof_image}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xs text-brand-500 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink size={10} /> Open image in new tab
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-btn bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>No receipt image uploaded. Confirm transaction ID in bank/M-Pesa portal.</span>
                  </div>
                )}
              </div>

              {/* Rejection Form */}
              {isRejecting ? (
                <div className="p-3.5 rounded-btn bg-red-500/10 border border-red-500/20 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold uppercase">
                    <AlertCircle size={14} />
                    <span>Reject Payment & Request Resubmission</span>
                  </div>
                  <textarea
                    rows={2}
                    className="input text-xs border-red-500/40 focus:border-red-500"
                    placeholder="Enter reason for customer (e.g. Transaction ID was invalid or amount did not match)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsRejecting(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={paymentSubmitting || !rejectionReason.trim()}
                      onClick={() => handleVerifyDeliveryPayment('reject')}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                      {paymentSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-4 flex justify-between items-center border-t border-surface-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRejecting(true)}
                    className="text-red-500 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                  >
                    Reject Payment
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setActiveModal(null)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={paymentSubmitting}
                      onClick={() => handleVerifyDeliveryPayment('approve')}
                      className="font-bold flex items-center gap-1.5"
                    >
                      {paymentSubmitting ? 'Verifying...' : (
                        <>
                          <CheckCircle size={14} />
                          Approve & Clear Order
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Lightbox Receipt Zoom Modal */}
      {zoomReceipt && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setZoomReceipt(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomReceipt(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition"
              title="Close image preview"
            >
              <X size={20} />
            </button>
            <img
              src={zoomReceipt}
              alt="Receipt zoom"
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseStaffLayout;
