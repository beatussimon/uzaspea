import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { 
  Package, Truck, QrCode, X, 
  Search, RefreshCw
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

interface Order {
  id: number | string;
  status: string;
  delivery_info?: {
    destination_warehouse_code?: string;
    full_name?: string;
    address?: string;
    current_warehouse_code?: string;
    phone?: string;
    [key: string]: any;
  };
  payments?: Array<{ status: string; [key: string]: any }>;
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
  const [activeModal, setActiveModal] = useState<'intake' | 'pricing' | 'dispatch' | 'pickup' | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
      const res = await api.get(`/api/warehouses/warehouses/scan_order/?query=${encodeURIComponent(scanCode.trim())}`);
      const order = res.data;
      if (order && order.id) {
        setSelectedOrder(order);
        toast.success(`Found Order #${order.id}`);
        if (order.status === 'confirmed' || order.status === 'processing') {
          setActiveModal('intake');
        } else if (order.status === 'received_at_warehouse') {
          setActiveModal('pricing');
        } else if (order.status === 'ready_for_pickup') {
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
      formData.append('order_id', selectedOrder.id.toString());
      formData.append('condition', condition);
      formData.append('notes', intakeNotes);
      if (photo) formData.append('package_photo', photo);

      if (sellerSigRef.current && !sellerSigRef.current.isEmpty()) {
        const sellerSig = sellerSigRef.current.getTrimmedCanvas().toDataURL('image/png');
        formData.append('seller_signature', sellerSig);
      }
      if (staffSigRef.current && !staffSigRef.current.isEmpty()) {
        const staffSig = staffSigRef.current.getTrimmedCanvas().toDataURL('image/png');
        formData.append('staff_signature', staffSig);
      }

      await api.post(`/api/warehouses/warehouses/${selectedWarehouseId}/intake/`, formData);
      toast.success('Package intake recorded successfully!');
      setActiveModal(null);
      setSelectedOrder(null);
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Intake recording failed');
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
      await api.post(`/api/warehouses/warehouses/${selectedWarehouseId}/set-pricing/`, {
        order_id: selectedOrder.id,
        delivery_fee: deliveryFee,
        destination_warehouse_code: destinationWarehouseCode
      });
      toast.success('Delivery fee updated!');
      setActiveModal(null);
      setSelectedOrder(null);
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to set pricing');
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
      await api.post(`/api/warehouses/warehouses/${selectedWarehouseId}/dispatch/`, {
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
      toast.error(err.response?.data?.error || 'Dispatch failed');
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
      await api.post(`/api/warehouses/warehouses/${selectedWarehouseId}/confirm-pickup/`, {
        order_id: selectedOrder.id,
        pickup_code: pickupCode
      });
      toast.success('Customer pickup confirmed!');
      setActiveModal(null);
      setSelectedOrder(null);
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Pickup verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter queue items
  const activeOrders = useMemo(() => {
    let list: Order[] = [];
    if (queueFilter === 'pending_intake') list = pendingIntakes;
    else if (queueFilter === 'received') list = receivedIntakes;
    else if (queueFilter === 'awaiting_payment') list = awaitingPayments;
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
    { key: 'awaiting_payment', label: 'Awaiting Buyer Payment', count: awaitingPayments.length },
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
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-500/10 text-brand-500 border border-brand-500/20 capitalize">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                      {order.status.replace(/_/g, ' ')}
                    </span>
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
                    {order.delivery_info?.destination_warehouse_code && (
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-normal">Dest. Hub</span>
                        <span className="font-medium text-brand-500">{order.delivery_info.destination_warehouse_code}</span>
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
                      onClick={() => { setSelectedOrder(order); setActiveModal('pricing'); }}
                      className="w-full"
                    >
                      Set Delivery Fee
                    </Button>
                  )}
                  {queueFilter === 'awaiting_payment' && (
                    <div className="text-center py-2 text-[11px] text-amber-500 font-medium bg-amber-500/5 rounded-btn border border-amber-500/10">
                      Waiting for buyer payment
                    </div>
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
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Destination Hub Code</label>
                <input
                  type="text"
                  className="input font-mono"
                  placeholder="e.g. DAR-01"
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
    </div>
  );
};

export default WarehouseStaffLayout;
