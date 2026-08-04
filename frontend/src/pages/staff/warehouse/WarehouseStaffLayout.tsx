import React, { useState, useEffect, useRef } from 'react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { 
  Package, CheckCircle, Clock, Truck, QrCode, X, Activity, Camera, PenTool, ShieldCheck, Key, MapPin, Zap,
  RefreshCw
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import { useOrderTracking } from '../../../hooks/useOrderTracking';

interface Warehouse {
  id: number | string;
  code: string;
  name: string;
  [key: string]: unknown;
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
  [key: string]: unknown;
}

interface Driver {
  id: number | string;
  name: string;
  [key: string]: unknown;
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

  // Smart Filters
  const [queueFilter, setQueueFilter] = useState<'all' | 'origin' | 'destination'>('all');
  const [activeTab, setActiveTab] = useState<'line_haul' | 'local_logistics'>('line_haul');
  const [loading, setLoading] = useState(true);

  // Smart Scan
  const [scanQuery, setScanQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Modals & Context
  const [activeModal, setActiveModal] = useState<'intake' | 'origin_intake' | 'destination_intake' | 'last_mile_sorting' | 'pricing' | 'dispatch' | 'pickup' | 'verify' | 'confirm_delivery' | null>(null);
  const [orderPreview, setOrderPreview] = useState<Order | null>(null);

  // Intake Form State
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [requireSignatures, setRequireSignatures] = useState(true);
  const sellerSigRef = useRef<SignatureCanvas>(null);
  const staffSigRef = useRef<SignatureCanvas>(null);

  // Pricing Form State
  const [deliveryFee, setDeliveryFee] = useState('');
  const [destinationWarehouseCode, setDestinationWarehouseCode] = useState('');
  const [suggestedFee, setSuggestedFee] = useState<number | null>(null);
  const [feeDataPoints, setFeeDataPoints] = useState(0);

  // Pickup Form State
  const [pickupCode, setPickupCode] = useState('');
  const [deliveryCodeInput, setDeliveryCodeInput] = useState('');

  // Dispatch Form State
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [carrierType, setCarrierType] = useState<'driver' | 'third_party'>('driver');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [thirdPartyDriverInfo, setThirdPartyDriverInfo] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Initialize
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
      .then(res => {
        setDrivers(res.data.results || res.data || []);
      })
      .catch(() => toast.error('Failed to load drivers list'));
  }, []);

  useEffect(() => {
    if (activeModal === 'pricing' && destinationWarehouseCode && selectedWarehouseId) {
      api.get(`/api/warehouses/warehouses/${selectedWarehouseId}/suggested-fee/?destination_warehouse=${destinationWarehouseCode}`)
        .then(res => {
          if (res.data.suggested_fee) {
            setSuggestedFee(res.data.suggested_fee);
            setFeeDataPoints(res.data.data_points);
            setDeliveryFee(res.data.suggested_fee.toString());
          } else {
            setSuggestedFee(null);
            setFeeDataPoints(0);
            setDeliveryFee('');
          }
        })
        .catch(() => {
          setSuggestedFee(null);
          setFeeDataPoints(0);
        });
    }
  }, [destinationWarehouseCode, activeModal, selectedWarehouseId]);

  // Fetch all queues
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
    } catch (err) {
      toast.error('Failed to sync warehouse data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWarehouseId) {
      localStorage.setItem('sokonimax_warehouse_id', selectedWarehouseId);
      fetchAllQueues(selectedWarehouseId);
      const interval = setInterval(() => fetchAllQueues(selectedWarehouseId), 30000);
      return () => clearInterval(interval);
    }
  }, [selectedWarehouseId]);

  const currentWh = warehouses.find(w => w.id.toString() === selectedWarehouseId);
  useOrderTracking(currentWh?.code ? `warehouse_${currentWh.code}` : null, () => {
    if (selectedWarehouseId) fetchAllQueues(selectedWarehouseId);
  });

  const applyFilter = (list: Order[]) => {
    if (queueFilter === 'all') return list;
    return list.filter(order => {
      const isDestination = order.delivery_info?.destination_warehouse_code === currentWh?.code;
      if (queueFilter === 'destination') return isDestination;
      return !isDestination;
    });
  };

  // Handle Smart Scan
  const processScan = async (queryText: string) => {
    if (!queryText.trim()) return;
    setScanning(true);
    try {
      const cleanQuery = queryText.trim();
      const res = await api.get(`/api/warehouses/intakes/preview-order/?order_id=${encodeURIComponent(cleanQuery)}`);
      const order = res.data;
      setOrderPreview(order);
      if (order.delivery_info?.destination_warehouse_code) {
        setDestinationWarehouseCode(order.delivery_info.destination_warehouse_code);
      }
      setScanQuery('');
      scanInputRef.current?.blur();

      switch (order.status) {
        case 'SHIPPED_TO_WAREHOUSE':
        case 'PAID':
        case 'SELLER_CONFIRMED':
        case 'PREPARING':
        case 'PACKAGING':
        case 'PROCESSING':
          setActiveModal('origin_intake');
          break;
        case 'RECEIVED_AT_WAREHOUSE':
          setActiveModal('pricing');
          break;
        case 'AWAITING_DELIVERY_PAYMENT':
        case 'PENDING_DELIVERY_VERIFICATION':
          setActiveModal('verify');
          break;
        case 'ASSIGNED_TRANSPORT':
        case 'READY_FOR_TRANSIT':
          setActiveModal('dispatch');
          break;
        case 'IN_TRANSIT':
          setActiveModal('destination_intake');
          break;
        case 'ARRIVED_AT_REGIONAL_WAREHOUSE':
          setActiveModal('last_mile_sorting');
          break;
        case 'READY_FOR_PICKUP':
        case 'READY_FOR_VEHICLE_HANDOVER':
          setActiveModal('pickup');
          break;
        case 'FAILED_DELIVERY':
        case 'RETURNED_TO_WAREHOUSE':
          setActiveModal('destination_intake');
          break;
        default:
          toast.success(`Order #${order.id} loaded (${order.status.replace(/_/g, ' ')})`);
      }
    } catch (err: any | unknown) {
      toast.error(err.response?.data?.error || 'Order not found or invalid barcode.');
    } finally {
      setScanning(false);
    }
  };

  const handleSmartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    await processScan(scanQuery);
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;
    let scanTimeout: ReturnType<typeof setTimeout>;

    if (showScanner) {
      scanTimeout = setTimeout(() => {
        if (!isMounted) return;
        try {
          html5QrCode = new Html5Qrcode("reader");
          html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              if (html5QrCode) {
                html5QrCode.stop().then(() => { html5QrCode?.clear(); }).catch(() => {});
              }
              setShowScanner(false);
              setScanQuery(decodedText);
              processScan(decodedText);
            },
            () => { /* ignore frame errors */ }
          ).catch((err) => {
            console.error("Camera access failed", err);
            toast.error("Could not access camera. Please check permissions.");
            setShowScanner(false);
          });
        } catch(e) {
          console.error("Scanner init error", e);
        }
      }, 300); // Wait for modal to render
    }

    return () => {
      isMounted = false;
      clearTimeout(scanTimeout);
      if (html5QrCode) {
        html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => {});
      }
    };
  }, [showScanner]);

  const handleActionClick = async (orderId: string, actionType: string) => {
    setScanning(true);
    try {
      const res = await api.get(`/api/warehouses/intakes/preview-order/?order_id=${encodeURIComponent(orderId)}`);
      const order = res.data;
      setOrderPreview(order);
      if (order.delivery_info?.destination_warehouse_code) {
        setDestinationWarehouseCode(order.delivery_info.destination_warehouse_code);
      }
      if (actionType === 'intake') {
        if (order.status === 'SHIPPED_TO_WAREHOUSE') setActiveModal('origin_intake');
        else if (order.status === 'ARRIVED_AT_REGIONAL_WAREHOUSE') setActiveModal('last_mile_sorting');
        else if (order.status === 'IN_TRANSIT' || order.status === 'FAILED_DELIVERY') setActiveModal('destination_intake');
        else setActiveModal('origin_intake');
      } else {
        setActiveModal(actionType as typeof activeModal);
      }
    } catch {
      toast.error('Failed to load order details');
    } finally {
      setScanning(false);
    }
  };

  // Intake Submission
  const submitIntake = async () => {
    if (requireSignatures && (sellerSigRef.current?.isEmpty() || staffSigRef.current?.isEmpty())) {
      toast.error('Both signatures are required for handover custody.');
      return;
    }
    setSubmitting(true);
    const formData = new FormData();
    formData.append('warehouse', selectedWarehouseId);
    if (!orderPreview) return;
    formData.append('order', orderPreview.id.toString());
    formData.append('package_condition', condition);
    formData.append('notes', notes || (requireSignatures ? '' : 'Intake check-in (Signatures bypassed)'));
    formData.append('seller_signature', requireSignatures ? sellerSigRef.current?.toDataURL() || '' : '');
    formData.append('staff_signature', requireSignatures ? staffSigRef.current?.toDataURL() || '' : '');
    if (photo) formData.append('photo', photo);

    try {
      await api.post('/api/warehouses/intakes/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Order #${orderPreview.id} securely checked into warehouse!`);
      closeModal();
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any | unknown) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to record intake.');
    } finally {
      setSubmitting(false);
    }
  };

  // Pricing Submission
  const submitPricing = async () => {
    if (!destinationWarehouseCode) {
      toast.error('Please select a destination warehouse.');
      return;
    }
    if (!deliveryFee || isNaN(Number(deliveryFee))) {
      toast.error('Please enter a valid amount.');
      return;
    }
    setSubmitting(true);
    if (!orderPreview) return;
    try {
      await api.post(`/api/warehouses/warehouses/${selectedWarehouseId}/set-delivery-fee/`, {
        order_id: orderPreview.id,
        fee: Number(deliveryFee),
        destination_warehouse: destinationWarehouseCode
      });
      toast.success('Delivery fee confirmed!');
      closeModal();
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any | unknown) {
      toast.error(err.response?.data?.error || 'Failed to set fee.');
    } finally {
      setSubmitting(false);
    }
  };

  // Dispatch Submission
  const submitDispatch = async () => {
    setSubmitting(true);
    if (!orderPreview) return;
    try {
      // 1. Check if shipment already exists for this order, or create it
      const shipRes = await api.get(`/api/logistics/shipments/?order=${orderPreview.id}`);
      const shipmentsList = shipRes.data.results || shipRes.data || [];
      const existingShipment = shipmentsList[0];

      const driverId = carrierType === 'driver' && selectedDriverId ? parseInt(selectedDriverId) : null;
      const shipmentData: Record<string, unknown> = {
        order: orderPreview.id,
        carrier_type: carrierType,
        driver: driverId,
        tracking_number: trackingNumber,
        estimated_delivery: estimatedDelivery ? new Date(estimatedDelivery).toISOString() : null,
      };

      if (carrierType === 'third_party') {
        shipmentData.third_party_driver_info = thirdPartyDriverInfo;
      }

      if (existingShipment) {
        await api.patch(`/api/logistics/shipments/${existingShipment.id}/`, shipmentData);
      } else {
        await api.post(`/api/logistics/shipments/`, shipmentData);
      }

      // 2. Call dispatch-order in warehouses ViewSet
      await api.post(`/api/warehouses/warehouses/${selectedWarehouseId}/dispatch-order/`, {
        order_id: orderPreview.id
      });
      toast.success('Order dispatched successfully with carrier details!');
      closeModal();
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any | unknown) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to dispatch order.');
    } finally {
      setSubmitting(false);
    }
  };

  // Verify Submission
  const submitVerify = async (status: string) => {
    setSubmitting(true);
    if (!orderPreview) return;
    try {
      const formData = new FormData();
      formData.append('status', status);
      formData.append('notes', 'Payment verified by warehouse staff.');
      
      await api.post(`/api/orders/${orderPreview.id}/advance/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(status === 'ASSIGNED_TRANSPORT' ? 'Payment verified and assigned to transport!' : 'Payment rejected, customer notified.');
      closeModal();
      if (selectedWarehouseId) fetchAllQueues(selectedWarehouseId);
    } catch (err: any | unknown) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to verify payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Pickup Submission
  const submitPickup = async () => {
    if (!pickupCode || pickupCode.length !== 6) {
      toast.error('Please enter 6-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/warehouses/pickup/verify/', { code: pickupCode });
      toast.success(`Order released successfully!`);
      closeModal();
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any | unknown) {
      toast.error(err.response?.data?.error || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Last-Mile Delivery by Code
  const submitConfirmDelivery = async () => {
    if (!deliveryCodeInput || deliveryCodeInput.trim().length < 4) {
      toast.error('Please enter the delivery code provided by the recipient.');
      return;
    }
    setSubmitting(true);
    if (!orderPreview) return;
    try {
      const formData = new FormData();
      formData.append('delivery_code', deliveryCodeInput.trim());
      formData.append('status', 'DELIVERED');
      await api.post(`/api/orders/${orderPreview.id}/advance/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Delivery confirmed! Order marked as DELIVERED.');
      closeModal();
      fetchAllQueues(selectedWarehouseId);
    } catch (err: any | unknown) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Code verification failed. Check the code and try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setOrderPreview(null);
    setCondition('good');
    setNotes('');
    setPhoto(null);
    setPhotoPreview(null);
    setDeliveryFee('');
    setDestinationWarehouseCode('');
    setPickupCode('');
    setDeliveryCodeInput('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 min-h-screen">
      
      {/* Header & Smart Scan */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white border border-gray-200 rounded-[28px] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative">
        <div className="absolute top-0 left-0 w-2 h-full bg-[#F59E0B] rounded-l-[28px]"></div>
        <div className="pl-4">
          <h1 className="text-2xl font-black text-black flex items-center gap-3">
            <Activity className="text-[#F59E0B]" size={28} />
            Operations Board
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Warehouse</span>
            <select
              className="text-xs font-bold text-[#F59E0B] outline-none cursor-pointer bg-transparent border-none p-0"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Universal Scanner */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <form onSubmit={handleSmartScan} className="relative group flex-1">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <QrCode className={`${scanning ? 'animate-pulse text-[#F59E0B]' : 'text-gray-400 group-focus-within:text-[#F59E0B]'} transition-colors`} size={20} />
            </div>
            <input
              ref={scanInputRef}
              type="text"
              placeholder="Scan Barcode / Order ID..."
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              disabled={scanning}
              className="w-full md:w-80 h-14 pl-12 pr-12 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:border-[#F59E0B] focus:ring-4 focus:ring-[#F59E0B]/10 transition-all shadow-sm disabled:opacity-50"
            />
            {scanning && (
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <div className="animate-spin h-5 w-5 border-2 border-[#F59E0B] border-t-transparent rounded-full" />
              </div>
            )}
          </form>
          <button 
            type="button"
            onClick={() => setShowScanner(true)}
            className="w-14 h-14 bg-[#FFF5E5] hover:bg-[#FFEAD0] text-[#F59E0B] rounded-2xl flex items-center justify-center transition-colors shadow-sm shrink-0"
          >
            <Camera size={24} />
          </button>
        </div>
      </div>

      {/* Smart Filters */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 hide-scrollbar">
        <button 
          onClick={() => setQueueFilter('all')}
          className={`whitespace-nowrap px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${queueFilter === 'all' ? 'bg-[#D97706] text-white shadow-md' : 'bg-[#F3F4F6] text-gray-500 hover:bg-gray-200'}`}
        >
          All Tasks
        </button>
        <button 
          onClick={() => setQueueFilter('origin')}
          className={`whitespace-nowrap px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${queueFilter === 'origin' ? 'bg-[#D97706] text-white shadow-md' : 'bg-[#F3F4F6] text-gray-500 hover:bg-gray-200'}`}
        >
          Origin Warehouse
        </button>
        <button 
          onClick={() => setQueueFilter('destination')}
          className={`whitespace-nowrap px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${queueFilter === 'destination' ? 'bg-[#D97706] text-white shadow-md' : 'bg-[#F3F4F6] text-gray-500 hover:bg-gray-200'}`}
        >
          Destination Warehouse
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200 mb-8 gap-8">
        <button 
          onClick={() => setActiveTab('line_haul')}
          className={`pb-3 font-black uppercase tracking-widest text-[13px] transition-all border-b-[3px] ${
            activeTab === 'line_haul' 
              ? 'border-[#F59E0B] text-[#F59E0B]' 
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Line-Haul & Origin Logistics
        </button>
        <button 
          onClick={() => setActiveTab('local_logistics')}
          className={`pb-3 font-black uppercase tracking-widest text-[13px] transition-all border-b-[3px] ${
            activeTab === 'local_logistics' 
              ? 'border-[#F59E0B] text-[#F59E0B]' 
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Local Warehouse Logistics (Last-Mile)
        </button>
      </div>

      {activeTab === 'line_haul' ? (
        <>
          {/* KPI Cards (Line-Haul) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { title: 'Origin Intake', count: applyFilter(pendingIntakes.filter(o => o.status === 'SHIPPED_TO_WAREHOUSE')).length, icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
              { title: 'Pricing Queue', count: applyFilter(receivedIntakes).length, icon: Clock, color: 'text-[#F59E0B]', bg: 'bg-[#FFF5E5]' },
              { title: 'Hold Shelf', count: applyFilter(awaitingPayments).length, icon: ShieldCheck, color: 'text-yellow-500', bg: 'bg-yellow-50' },
              { title: 'Line-Haul Dispatch', count: applyFilter(outboundOrders.filter(o => o.delivery_info?.destination_warehouse_code !== currentWh?.code)).length, icon: Truck, color: 'text-green-500', bg: 'bg-green-50' }
            ].map((kpi, idx) => (
              <motion.div 
                key={kpi.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white border border-gray-100 rounded-[24px] p-5 flex items-center gap-4 hover:shadow-md transition-shadow shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)]"
              >
                <div className={`w-[60px] h-[60px] rounded-[18px] flex flex-shrink-0 items-center justify-center ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon size={26} />
                </div>
                <div className="min-w-0">
                  <p className="text-3xl font-black text-black leading-none mb-1 truncate">{loading ? '-' : kpi.count}</p>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest truncate">{kpi.title}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Swimlanes (Line-Haul) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Lane 1: Awaiting Intake */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Package size={16} /> Origin Intake
              </h3>
              {loading ? <SkeletonCards /> : applyFilter(pendingIntakes.filter(o => o.status === 'SHIPPED_TO_WAREHOUSE')).length === 0 ? <EmptyState text="No pending intakes" /> : (
                <div className="space-y-3">
                  {applyFilter(pendingIntakes.filter(o => o.status === 'SHIPPED_TO_WAREHOUSE')).map(order => (
                    <QueueCard key={order.id} order={order} badge="Inbound" onClick={() => handleActionClick(order.id.toString(), 'intake')} />
                  ))}
                </div>
              )}
            </div>

            {/* Lane 2: Delivery Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} /> Delivery Pricing
              </h3>
              {loading ? <SkeletonCards /> : applyFilter(receivedIntakes).length === 0 ? <EmptyState text="No pricing tasks" /> : (
                <div className="space-y-3">
                  {applyFilter(receivedIntakes).map(order => (
                    <QueueCard key={order.id} order={order} badge="Received" onClick={() => handleActionClick(order.id.toString(), 'pricing')} />
                  ))}
                </div>
              )}
            </div>

            {/* Lane 3: Hold Shelf */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck size={16} /> Hold Shelf
              </h3>
              {loading ? <SkeletonCards /> : applyFilter(awaitingPayments).length === 0 ? <EmptyState text="No items held" /> : (
                <div className="space-y-3">
                  {applyFilter(awaitingPayments).map(order => (
                    <QueueCard 
                      key={order.id} 
                      order={order} 
                      badge={order.status === 'PENDING_DELIVERY_VERIFICATION' ? 'Verifying' : 'Hold'} 
                      onClick={() => {
                        if (order.status === 'PENDING_DELIVERY_VERIFICATION') {
                          handleActionClick(order.id.toString(), 'verify');
                        }
                      }} 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Lane 4: Line-Haul Dispatch */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Truck size={16} /> Line-Haul Dispatch
              </h3>
              {loading ? <SkeletonCards /> : applyFilter(outboundOrders.filter(o => o.delivery_info?.destination_warehouse_code !== currentWh?.code)).length === 0 ? <EmptyState text="No dispatch tasks" /> : (
                <div className="space-y-3">
                  {applyFilter(outboundOrders.filter(o => o.delivery_info?.destination_warehouse_code !== currentWh?.code)).map(order => (
                    <QueueCard key={order.id} order={order} badge="Ready" onClick={() => handleActionClick(order.id.toString(), 'dispatch')} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Inter-Warehouse Transfers Section */}
          <div className="mt-12 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-xl font-black text-black uppercase tracking-tight flex items-center gap-2">
                  <RefreshCw size={20} className="text-[#F59E0B]" />
                  Inter-Warehouse Transfers
                </h2>
                <p className="text-xs font-medium text-gray-500 mt-1">
                  Manage transfer shipments moving between regional warehouses
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500">
                  Incoming: {incomingTransfers.length}
                </span>
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500">
                  Outgoing: {outgoingTransfers.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Incoming Transfers (Road Transit) */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <RefreshCw size={14} className="text-blue-500" /> Incoming Transfers
                </h3>
                {incomingTransfers.length === 0 ? <EmptyState text="No incoming transfers" /> : (
                  <div className="space-y-3">
                    {incomingTransfers.map(transfer => (
                      <div key={transfer.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-black">Order #{transfer.order}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-500">In Transit</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Origin: <span className="font-semibold text-gray-900">{transfer.source_warehouse_name}</span>
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Shipped: {transfer.shipped_at ? new Date(transfer.shipped_at).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleActionClick(transfer.order.toString(), 'intake')}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg uppercase tracking-wider transition-all"
                        >
                          Receive Package
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing Transfers (Ready to Ship) */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <RefreshCw size={14} className="text-[#F59E0B]" /> Outgoing Transfers
                </h3>
                {outgoingTransfers.length === 0 ? <EmptyState text="No outgoing transfers pending" /> : (
                  <div className="space-y-3">
                    {outgoingTransfers.map(transfer => (
                      <div key={transfer.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-black">Order #{transfer.order}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FFF5E5] text-[#F59E0B]">Pending</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Destination: <span className="font-semibold text-gray-900">{transfer.destination_warehouse_name}</span>
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Created: {new Date(transfer.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await api.post(`/api/warehouses/transfers/${transfer.id}/ship/`);
                              toast.success(`Transfer #${transfer.id} shipped successfully.`);
                              fetchAllQueues(selectedWarehouseId);
                            } catch {
                              toast.error('Failed to dispatch transfer.');
                            }
                          }}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-lg uppercase tracking-wider transition-all"
                        >
                          Ship Package
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* KPI Cards (Local Logistics) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Dest WH Intake', count: applyFilter(pendingIntakes.filter(o => ['IN_TRANSIT', 'ARRIVED_AT_REGIONAL_WAREHOUSE'].includes(o.status))).length, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { title: 'Local Delivery Dispatch', count: applyFilter(outboundOrders.filter(o => o.delivery_info?.destination_warehouse_code === currentWh?.code)).length, icon: Truck, color: 'text-green-500', bg: 'bg-green-500/10' },
              { title: 'Ready for Pickup / Release', count: applyFilter(readyForPickup).length, icon: Key, color: 'text-purple-500', bg: 'bg-purple-500/10' }
            ].map((kpi, idx) => (
              <motion.div 
                key={kpi.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="glass-dark border border-gray-200 shadow-sm dark:border-neutral-800 rounded-3xl p-6 flex items-center gap-5 hover:shadow-lg transition-shadow"
              >
                <div className={`p-4 rounded-2xl ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon size={28} />
                </div>
                <div>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">{loading ? '-' : kpi.count}</p>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{kpi.title}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Swimlanes (Local Logistics) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lane 1: Dest Hub Intake */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Package size={16} /> Destination Warehouse Intake
              </h3>
              {loading ? <SkeletonCards /> : applyFilter(pendingIntakes.filter(o => ['IN_TRANSIT', 'ARRIVED_AT_REGIONAL_WAREHOUSE'].includes(o.status))).length === 0 ? <EmptyState text="No pending intakes" /> : (
                <div className="space-y-3">
                  {applyFilter(pendingIntakes.filter(o => ['IN_TRANSIT', 'ARRIVED_AT_REGIONAL_WAREHOUSE'].includes(o.status))).map(order => (
                    <QueueCard key={order.id} order={order} badge={order.status === 'ARRIVED_AT_REGIONAL_WAREHOUSE' ? 'WH Arrived' : 'Inbound Transfer'} onClick={() => handleActionClick(order.id.toString(), 'intake')} />
                  ))}
                </div>
              )}
            </div>

            {/* Lane 2: Local Delivery Dispatch */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Truck size={16} /> Local Delivery Dispatch
              </h3>
              {loading ? <SkeletonCards /> : applyFilter(outboundOrders.filter(o => o.delivery_info?.destination_warehouse_code === currentWh?.code)).length === 0 ? <EmptyState text="No deliveries" /> : (
                <div className="space-y-3">
                  {applyFilter(outboundOrders.filter(o => o.delivery_info?.destination_warehouse_code === currentWh?.code)).map(order => (
                    order.status === 'OUT_FOR_DELIVERY' ? (
                      <div key={order.id} className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border-2 border-green-500/40 shadow-sm flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-gray-900 dark:text-white">Order #{order.id}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Out for Delivery</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">
                              {order.delivery_info?.full_name} · {order.delivery_info?.address}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleActionClick(order.id.toString(), 'confirm_delivery')}
                          className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        >
                          <Key size={14} /> Confirm Delivery (Enter Code)
                        </button>
                      </div>
                    ) : (
                      <QueueCard key={order.id} order={order} badge="Last Mile" onClick={() => handleActionClick(order.id.toString(), 'dispatch')} />
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Lane 3: Customer Release / Pickup */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Key size={16} /> Customer Release / Pickup
              </h3>
              {loading ? <SkeletonCards /> : applyFilter(readyForPickup).length === 0 ? <EmptyState text="No pickups" /> : (
                <div className="space-y-3">
                  {applyFilter(readyForPickup).map(order => (
                    <QueueCard key={order.id} order={order} badge="Pickup" onClick={() => handleActionClick(order.id.toString(), 'pickup')} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}


      {/* MODALS */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh]"
            >
              <button onClick={closeModal} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-neutral-800 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white transition z-10">
                <X size={20} />
              </button>

              <div className="p-6 md:p-8 overflow-y-auto flex-1">
                {/* Modal Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                    {activeModal === 'intake' && <Package size={32} />}
                    {activeModal === 'pricing' && <Clock size={32} />}
                    {activeModal === 'dispatch' && <Truck size={32} />}
                    {activeModal === 'verify' && <ShieldCheck size={32} />}
                    {activeModal === 'confirm_delivery' && <Key size={32} className="text-green-600" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                      {activeModal === 'origin_intake' && 'Package Intake (From Seller)'}
                      {activeModal === 'destination_intake' && 'Regional WH Receipt'}
                      {activeModal === 'last_mile_sorting' && 'Last-Mile Sorting'}
                      {activeModal === 'pricing' && 'Confirm Pricing'}
                      {activeModal === 'dispatch' && 'Dispatch Transfer'}
                      {activeModal === 'pickup' && 'Verify Pickup'}
                      {activeModal === 'verify' && 'Verify Payment'}
                      {activeModal === 'confirm_delivery' && 'Confirm Last-Mile Delivery'}
                    </h2>
                    <p className="text-sm text-gray-500 font-bold">Order #{orderPreview?.id}</p>
                  </div>
                </div>

                {/* Context Details */}
                <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-2xl p-5 mb-8 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Departure Date</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {orderPreview?.logistics_info?.departure_date ? new Date(orderPreview.logistics_info.departure_date).toLocaleDateString() : 'Pending'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Expected Arrival</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {orderPreview?.logistics_info?.expected_arrival ? new Date(orderPreview.logistics_info.expected_arrival).toLocaleDateString() : 'Pending'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Carrier / Courier</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {orderPreview?.logistics_info?.carrier_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Tracking Number</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {orderPreview?.logistics_info?.tracking_number || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Buyer Username</p>
                    <p className="font-bold text-gray-900 dark:text-white">{orderPreview?.buyer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Seller Username</p>
                    <p className="font-bold text-gray-900 dark:text-white">{orderPreview?.seller_name}</p>
                  </div>
                </div>

                {/* Origin Intake Specific */}
                {activeModal === 'origin_intake' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Condition</label>
                      <select 
                        className="w-full bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 text-sm font-bold outline-none"
                        value={condition} onChange={e => setCondition(e.target.value)}
                      >
                        <option value="good">Good (No damage)</option>
                        <option value="damaged">Damaged (Issues present)</option>
                        <option value="needs_repack">Needs Repackaging</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Package Photo (Optional)</label>
                      <label className="border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition">
                        <Camera size={24} className="text-gray-400 mb-2" />
                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Tap to take photo</span>
                        <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            setPhoto(e.target.files[0]);
                            setPhotoPreview(URL.createObjectURL(e.target.files[0]));
                          }
                        }} />
                      </label>
                      {photoPreview && <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover rounded-xl mt-2" />}
                    </div>

                    <div className="flex items-center gap-3 bg-brand-50 dark:bg-brand-900/20 p-4 rounded-xl cursor-pointer" onClick={() => setRequireSignatures(!requireSignatures)}>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${requireSignatures ? 'bg-brand-500 text-white' : 'bg-gray-200 dark:bg-neutral-700'}`}>
                        {requireSignatures && <CheckCircle size={14} />}
                      </div>
                      <span className="text-sm font-bold text-brand-700 dark:text-brand-400">Require Physical Signatures</span>
                    </div>

                    {requireSignatures && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><PenTool size={14}/> Courier/Seller Signature</label>
                          <div className="border-2 border-gray-200 shadow-sm dark:border-neutral-700 rounded-xl bg-gray-50 dark:bg-neutral-800 overflow-hidden">
                            <SignatureCanvas ref={sellerSigRef} penColor="currentColor" canvasProps={{ className: 'w-full h-32 text-gray-900 dark:text-white' }} />
                          </div>
                          <button type="button" onClick={() => sellerSigRef.current?.clear()} className="text-xs text-brand-500 font-bold">Clear</button>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><PenTool size={14}/> Staff Signature</label>
                          <div className="border-2 border-gray-200 shadow-sm dark:border-neutral-700 rounded-xl bg-gray-50 dark:bg-neutral-800 overflow-hidden">
                            <SignatureCanvas ref={staffSigRef} penColor="currentColor" canvasProps={{ className: 'w-full h-32 text-gray-900 dark:text-white' }} />
                          </div>
                          <button type="button" onClick={() => staffSigRef.current?.clear()} className="text-xs text-brand-500 font-bold">Clear</button>
                        </div>
                      </div>
                    )}

                    <button onClick={submitIntake} disabled={submitting} className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg shadow-brand-500/30 mt-6">
                      {submitting ? 'Checking In...' : 'Confirm Intake'}
                    </button>
                  </div>
                )}

                {/* Destination Intake Specific */}
                {activeModal === 'destination_intake' && (
                  <div className="space-y-6">
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-bold mb-4">
                      Please confirm receipt from the regional transport driver. A photo of the package is required.
                    </p>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Condition After Transit</label>
                      <select 
                        className="w-full bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 text-sm font-bold outline-none"
                        value={condition} onChange={e => setCondition(e.target.value)}
                      >
                        <option value="good">Good (No damage)</option>
                        <option value="damaged">Damaged (Issues present)</option>
                        <option value="needs_repack">Needs Repackaging</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-brand-500 uppercase tracking-wider flex items-center gap-2">
                        Package Photo (Required) *
                      </label>
                      <label className="border-2 border-dashed border-brand-300 dark:border-brand-700 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20 transition">
                        <Camera size={24} className="text-brand-500 mb-2" />
                        <span className="text-sm font-bold text-brand-600 dark:text-brand-400">Tap to take photo</span>
                        <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            setPhoto(e.target.files[0]);
                            setPhotoPreview(URL.createObjectURL(e.target.files[0]));
                          }
                        }} />
                      </label>
                      {photoPreview && <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover rounded-xl mt-2" />}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><PenTool size={14}/> Transport Driver Signature</label>
                        <div className="border-2 border-gray-200 shadow-sm dark:border-neutral-700 rounded-xl bg-gray-50 dark:bg-neutral-800 overflow-hidden">
                          <SignatureCanvas ref={sellerSigRef} penColor="currentColor" canvasProps={{ className: 'w-full h-32 text-gray-900 dark:text-white' }} />
                        </div>
                        <button type="button" onClick={() => sellerSigRef.current?.clear()} className="text-xs text-brand-500 font-bold">Clear</button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><PenTool size={14}/> Staff Signature</label>
                        <div className="border-2 border-gray-200 shadow-sm dark:border-neutral-700 rounded-xl bg-gray-50 dark:bg-neutral-800 overflow-hidden">
                          <SignatureCanvas ref={staffSigRef} penColor="currentColor" canvasProps={{ className: 'w-full h-32 text-gray-900 dark:text-white' }} />
                        </div>
                        <button type="button" onClick={() => staffSigRef.current?.clear()} className="text-xs text-brand-500 font-bold">Clear</button>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        if (!photo) {
                          toast.error('A package photo is required for destination warehouse receipt.');
                          return;
                        }
                        if (sellerSigRef.current?.isEmpty() || staffSigRef.current?.isEmpty()) {
                          toast.error('Both signatures are required for transport handover.');
                          return;
                        }
                        setRequireSignatures(true);
                        submitIntake();
                      }} 
                      disabled={submitting} 
                      className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg shadow-brand-500/30 mt-6"
                    >
                      {submitting ? 'Confirming Receipt...' : 'Confirm WH Receipt'}
                    </button>
                  </div>
                )}

                {/* Last-Mile Sorting Specific */}
                {activeModal === 'last_mile_sorting' && (
                  <div className="space-y-6">
                    <p className="text-gray-600 dark:text-gray-300 font-bold text-center">
                      This package is ready to be sorted for final delivery.
                    </p>
                    <div className="bg-gray-50 dark:bg-neutral-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-4">
                      {orderPreview?.status === 'ARRIVED_AT_REGIONAL_WAREHOUSE' && (
                        <>
                          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                            <MapPin size={32} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">Sort for Last-Mile</h3>
                            <p className="text-sm text-gray-500 mt-1">Assign to courier or pickup shelf.</p>
                          </div>
                        </>
                      )}
                    </div>

                    <button 
                      onClick={() => {
                        setRequireSignatures(false);
                        submitIntake();
                      }} 
                      disabled={submitting} 
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30 mt-6 flex items-center justify-center gap-2"
                    >
                      <Truck size={20} /> {submitting ? 'Sorting...' : 'Confirm Sorting Complete'}
                    </button>
                  </div>
                )}

                {/* Pricing Specific */}
                {activeModal === 'pricing' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Destination Warehouse</label>
                      <select 
                        value={destinationWarehouseCode}
                        onChange={e => setDestinationWarehouseCode(e.target.value)}
                        className="w-full text-lg font-bold bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 outline-none"
                      >
                        <option value="" disabled>-- Select Destination --</option>
                        {warehouses.map(w => (
                          <option key={w.code} value={w.code}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Actual Delivery Fee (TSh)</label>
                      <input 
                        type="number"
                        placeholder="e.g. 5000"
                        value={deliveryFee}
                        onChange={e => setDeliveryFee(e.target.value)}
                        className="w-full text-2xl font-black bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-4 outline-none"
                      />
                      {suggestedFee !== null && (
                        <p className="text-sm text-brand-600 dark:text-brand-400 mt-1">
                          <Zap size={14} className="inline mb-1 mr-1" />
                          Suggested fee based on {feeDataPoints} past {feeDataPoints === 1 ? 'delivery' : 'deliveries'}: TSh {suggestedFee.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button onClick={submitPricing} disabled={submitting} className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg shadow-amber-500/30 mt-6">
                      {submitting ? 'Setting...' : 'Confirm & Notify Customer'}
                    </button>
                  </div>
                )}

                {/* Dispatch Specific */}
                {activeModal === 'dispatch' && (
                  <div className="space-y-6">
                    <div className="border-b border-gray-200 shadow-sm dark:border-neutral-800 pb-4 mb-4">
                      <h3 className="text-sm font-black text-gray-505 dark:text-neutral-400 uppercase tracking-wider mb-2">Carrier Assignment</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setCarrierType('driver')}
                          className={`py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${carrierType === 'driver' ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-gray-250 dark:border-neutral-700 text-gray-500'}`}
                        >
                          Fleet Driver
                        </button>
                        <button
                          type="button"
                          onClick={() => setCarrierType('third_party')}
                          className={`py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${carrierType === 'third_party' ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-gray-250 dark:border-neutral-700 text-gray-500'}`}
                        >
                          External Courier
                        </button>
                      </div>
                    </div>

                    {carrierType === 'driver' ? (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Fleet Driver</label>
                        <select
                          value={selectedDriverId}
                          onChange={e => setSelectedDriverId(e.target.value)}
                          className="w-full text-sm font-bold bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 outline-none"
                        >
                          <option value="">-- Select Driver --</option>
                          {drivers.map((d: Driver) => (
                            <option key={d.id} value={d.id}>
                              {d.username} ({d.vehicle_type || 'No Vehicle'} - {d.assigned_region || 'No Region'})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Courier Info (Name, Phone, Co.)</label>
                          <input
                            type="text"
                            placeholder="e.g. DHL - Juma Omar, +255 712..."
                            value={thirdPartyDriverInfo}
                            onChange={e => setThirdPartyDriverInfo(e.target.value)}
                            className="w-full text-sm bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tracking Number</label>
                          <input
                            type="text"
                            placeholder="e.g. TRK987654321"
                            value={trackingNumber}
                            onChange={e => setTrackingNumber(e.target.value)}
                            className="w-full text-sm bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estimated Delivery Time</label>
                      <input
                        type="datetime-local"
                        value={estimatedDelivery}
                        onChange={e => setEstimatedDelivery(e.target.value)}
                        className="w-full text-sm bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 outline-none animate-none"
                      />
                    </div>

                    <p className="text-xs text-gray-400 dark:text-neutral-500 text-center italic mt-2">
                      {orderPreview?.delivery_info?.current_warehouse_code === orderPreview?.delivery_info?.destination_warehouse_code
                        ? 'Ready for local delivery. Dispatching will mark order as OUT_FOR_DELIVERY.'
                        : 'Transfer shipment. Dispatching will mark order as IN_TRANSIT.'}
                    </p>

                    <button onClick={submitDispatch} disabled={submitting} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg shadow-green-500/30 mt-6 flex justify-center items-center gap-2">
                      <Truck size={24} />
                      {submitting ? 'Dispatching...' : 'Confirm Dispatch & Handover'}
                    </button>
                  </div>
                )}

                {/* Pickup Specific */}
                {activeModal === 'pickup' && (
                  <div className="space-y-6">
                    <div className="space-y-2 text-center">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer 6-Digit PIN</label>
                      <input 
                        type="text"
                        maxLength={6}
                        placeholder="••••••"
                        value={pickupCode}
                        onChange={e => setPickupCode(e.target.value.toUpperCase())}
                        className="w-full text-center tracking-[1em] text-4xl font-black bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-6 outline-none uppercase"
                      />
                    </div>
                    <button onClick={submitPickup} disabled={submitting} className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg shadow-brand-500/30 mt-6 flex justify-center items-center gap-2">
                      <ShieldCheck size={24} /> {submitting ? 'Verifying...' : 'Verify & Release'}
                    </button>
                  </div>
                )}

                {/* Confirm Delivery (Last Mile) */}
                {activeModal === 'confirm_delivery' && (
                  <div className="space-y-6">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-2xl p-4">
                      <p className="text-sm font-bold text-green-800 dark:text-green-300 flex items-center gap-2">
                        <Key size={16} /> Ask the recipient for their delivery code and enter it below to confirm hand-off.
                      </p>
                      {orderPreview?.delivery_info && (
                        <div className="mt-3 text-xs text-green-700 dark:text-green-400 space-y-1">
                          <p><span className="font-bold">Recipient:</span> {orderPreview.delivery_info.full_name}</p>
                          <p><span className="font-bold">Phone:</span> {orderPreview.delivery_info.phone}</p>
                          <p><span className="font-bold">Address:</span> {orderPreview.delivery_info.address}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-center">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recipient's Delivery Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="••••••"
                        value={deliveryCodeInput}
                        onChange={e => setDeliveryCodeInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center tracking-[1em] text-4xl font-black bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-green-500 rounded-xl px-4 py-6 outline-none"
                        autoFocus
                      />
                      <p className="text-xs text-gray-400">The buyer received this code in their orders page</p>
                    </div>
                    <button
                      onClick={submitConfirmDelivery}
                      disabled={submitting || deliveryCodeInput.length < 4}
                      className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-black rounded-xl text-lg uppercase tracking-widest transition-all shadow-lg shadow-green-500/30 flex justify-center items-center gap-2"
                    >
                      <CheckCircle size={24} /> {submitting ? 'Confirming...' : 'Confirm Delivery & Complete Order'}
                    </button>
                  </div>
                )}

                {/* Verify Specific */}
                {activeModal === 'verify' && (
                  <div className="space-y-6">
                    {(() => {
                       const payment = orderPreview?.payments?.find((p) => p.status === 'PENDING_VERIFICATION');
                       if (!payment) return <p className="text-sm text-gray-500 text-center">No pending payment records found.</p>;
                       return (
                         <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl space-y-2">
                               <p className="text-xs font-bold text-gray-500 uppercase">Transaction ID</p>
                               <p className="font-mono text-lg font-bold dark:text-white bg-gray-100 dark:bg-neutral-900 px-3 py-2 rounded-lg inline-block">{payment.transaction_id || 'N/A'}</p>
                            </div>
                            
                            {payment.proof_image && (
                              <div className="space-y-2">
                                 <p className="text-xs font-bold text-gray-500 uppercase">Proof Image</p>
                                 <a href={payment.proof_image} target="_blank" rel="noreferrer" className="block w-full overflow-hidden rounded-xl border border-gray-200 dark:border-neutral-700 hover:opacity-90 transition">
                                    <img src={payment.proof_image} alt="Proof" className="w-full object-contain max-h-64 bg-black/5" />
                                 </a>
                              </div>
                            )}

                            <div className="flex gap-3 pt-4">
                               <button onClick={() => submitVerify('ASSIGNED_TRANSPORT')} disabled={submitting} className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl text-sm md:text-lg uppercase tracking-widest transition-all shadow-lg shadow-green-500/30">
                                 {submitting ? 'Processing...' : 'Verify & Assign Transport'}
                               </button>
                               <button onClick={() => submitVerify('AWAITING_DELIVERY_PAYMENT')} disabled={submitting} className="flex-1 py-4 bg-red-100 hover:bg-red-200 text-red-600 font-black rounded-xl text-sm md:text-lg uppercase tracking-widest transition-colors">
                                 Reject
                               </button>
                            </div>
                         </div>
                       );
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScanner && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden w-full max-w-md shadow-2xl relative p-6">
              <button onClick={() => setShowScanner(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors z-10"><X size={24} /></button>
              <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4 uppercase tracking-widest text-center">Scan QR Code</h2>
              <div id="reader" className="w-full overflow-hidden rounded-xl border border-gray-200 dark:border-neutral-800"></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// UI Subcomponents
const SkeletonCards = () => (
  <div className="space-y-3">
    {[1,2,3].map(i => (
      <div key={i} className="h-20 bg-gray-100 dark:bg-neutral-800/50 rounded-2xl animate-pulse"></div>
    ))}
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="py-8 text-center border-[1.5px] border-dashed border-gray-200 bg-gray-50/50 rounded-2xl">
    <CheckCircle size={20} className="mx-auto text-gray-300 mb-2 stroke-[2.5]" />
    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{text}</p>
  </div>
);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'Pending';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const QueueCard = ({ order, badge, onClick }: { order: Order, badge?: string, onClick: () => void }) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="p-3 bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-md transition cursor-pointer flex justify-between items-center group w-full relative"
  >
    <div className="flex items-center gap-3 w-full">
      <div className="relative shrink-0">
        <div className="w-[64px] h-[64px] bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border border-gray-100">
          {order.items?.[0]?.product_image ? (
            <img src={order.items[0].product_image} className="w-full h-full object-cover" alt="" />
          ) : (
            <Package size={24} className="text-gray-300" />
          )}
        </div>
        {order.items?.length > 1 && (
          <div className="absolute -bottom-1 -right-1 bg-[#F59E0B] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-white">
            +{order.items.length - 1}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-black uppercase tracking-widest bg-[#FFF5E5] text-[#F59E0B] px-1.5 py-0.5 rounded">
            {badge || `ORDER #${order.id}`}
          </span>
          <span className="text-[10px] font-bold text-gray-400">
            {formatDate(order.order_date)}
          </span>
        </div>
        <p className="text-sm font-black text-black truncate uppercase tracking-tight">
          {order.items?.[0]?.product_name || 'SokoniMax Package'}
        </p>
        <p className="text-xs text-gray-500 font-bold truncate">
          Store: <span className="text-gray-900">@{order.items?.[0]?.seller_username || 'seller'}</span>
        </p>
      </div>
    </div>
  </motion.div>
);

export default WarehouseStaffLayout;
