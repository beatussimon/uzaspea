import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Truck, DollarSign, CheckCircle2, AlertTriangle, 
  Search, ChevronRight, X
} from 'lucide-react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';
import { CardGridSkeleton } from '../../../components/Skeleton';

interface Shipment {
  id: number | string;
  order: number | string;
  status: string;
  carrier_type: string;
  driver?: number | string;
  driver_username?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  has_vehicles?: boolean;
  created_at?: string;
  [key: string]: any;
}

interface Driver {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: any;
}

interface Payment {
  id: number | string;
  driver: number | string;
  driver_username?: string;
  status: string;
  amount: number | string;
  is_paid?: boolean;
  paid_at?: string;
  shipment_order_id?: number | string;
  [key: string]: any;
}

const SHIPMENT_STATUS_BADGES: Record<string, { label: string; dot: string; color: string; bg: string }> = {
  pending: { 
    label: 'Pending Dispatch', 
    dot: 'bg-amber-500', 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-500/10 border-amber-500/20' 
  },
  in_transit: { 
    label: 'In Transit', 
    dot: 'bg-blue-500', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20' 
  },
  arrived_at_warehouse: { 
    label: 'At Warehouse', 
    dot: 'bg-purple-500', 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-500/10 border-purple-500/20' 
  },
  delivered: { 
    label: 'Delivered', 
    dot: 'bg-emerald-500', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-500/10 border-emerald-500/20' 
  },
};

const LogisticsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shipments' | 'payments'>('shipments');

  // Shipment states
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [loadingMoreShipments, setLoadingMoreShipments] = useState(false);
  const [, setPageShipments] = useState(1);
  const [hasMoreShipments, setHasMoreShipments] = useState(true);
  const shipmentSentinelRef = useRef<HTMLDivElement>(null);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [shipmentFilter, setShipmentFilter] = useState('all');
  const [shipmentSearch, setShipmentSearch] = useState('');

  // Payments states
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingMorePayments, setLoadingMorePayments] = useState(false);
  const [, setPagePayments] = useState(1);
  const [hasMorePayments, setHasMorePayments] = useState(true);
  const paymentSentinelRef = useRef<HTMLDivElement>(null);

  const [paymentFilter, setPaymentFilter] = useState('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [payingId, setPayingId] = useState<number | string | null>(null);

  // Edit Shipment Modal states
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editCarrierType, setEditCarrierType] = useState<'driver' | 'third_party'>('driver');
  const [editDriver, setEditDriver] = useState('');
  const [editTrackingNum, setEditTrackingNum] = useState('');
  const [editDeliveryTime, setEditDeliveryTime] = useState('');
  const [deliveryCode, setDeliveryCode] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch Drivers list
  useEffect(() => {
    api.get('/api/logistics/shipments/drivers/')
      .then(res => setDrivers(res.data.results || res.data || []))
      .catch(() => toast.error('Failed to load fleet drivers.'));
  }, []);

  // Fetch Shipments with infinite scroll
  const fetchShipments = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoadingShipments(true);
      setPageShipments(1);
    } else {
      setLoadingMoreShipments(true);
    }

    let url = `/api/logistics/shipments/?page=${p}`;
    if (shipmentFilter !== 'all') {
      url += `&status=${shipmentFilter}`;
    }

    api.get(url)
      .then((res) => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setShipments(incoming);
        else {
          setShipments((prev) => {
            const ids = new Set(prev.map((s) => s.id));
            return [...prev, ...incoming.filter((s) => !ids.has(s.id))];
          });
        }
        setHasMoreShipments(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load shipments.');
        setHasMoreShipments(false);
      })
      .finally(() => {
        setLoadingShipments(false);
        setLoadingMoreShipments(false);
      });
  }, [shipmentFilter]);

  // Fetch Payments with infinite scroll
  const fetchPayments = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoadingPayments(true);
      setPagePayments(1);
    } else {
      setLoadingMorePayments(true);
    }

    let url = `/api/logistics/driver-payments/?page=${p}`;
    if (paymentFilter === 'unpaid') url += '&is_paid=false';
    if (paymentFilter === 'paid') url += '&is_paid=true';

    api.get(url)
      .then((res) => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setPayments(incoming);
        else {
          setPayments((prev) => {
            const ids = new Set(prev.map((pay) => pay.id));
            return [...prev, ...incoming.filter((pay) => !ids.has(pay.id))];
          });
        }
        setHasMorePayments(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load driver payments.');
        setHasMorePayments(false);
      })
      .finally(() => {
        setLoadingPayments(false);
        setLoadingMorePayments(false);
      });
  }, [paymentFilter]);

  useEffect(() => {
    fetchShipments(1, true);
  }, [fetchShipments]);

  useEffect(() => {
    fetchPayments(1, true);
  }, [fetchPayments]);

  // Sentinel observers
  useEffect(() => {
    const sentinel = shipmentSentinelRef.current;
    if (!sentinel || !hasMoreShipments || loadingMoreShipments || loadingShipments) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreShipments && !loadingMoreShipments && !loadingShipments) {
          setPageShipments((prev) => {
            const nextPage = prev + 1;
            fetchShipments(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMoreShipments, loadingMoreShipments, loadingShipments, fetchShipments]);

  useEffect(() => {
    const sentinel = paymentSentinelRef.current;
    if (!sentinel || !hasMorePayments || loadingMorePayments || loadingPayments) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePayments && !loadingMorePayments && !loadingPayments) {
          setPagePayments((prev) => {
            const nextPage = prev + 1;
            fetchPayments(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMorePayments, loadingMorePayments, loadingPayments, fetchPayments]);

  const handleMarkPaid = async (id: number | string) => {
    setPayingId(id);
    try {
      await api.post(`/api/logistics/driver-payments/${id}/pay/`);
      toast.success('Payment disbursed to driver successfully.');
      fetchPayments(1, true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to process payment.');
    } finally {
      setPayingId(null);
    }
  };

  const openEditModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setEditStatus(shipment.status);
    setEditCarrierType(shipment.carrier_type as 'driver' | 'third_party');
    setEditDriver(shipment.driver?.toString() || '');
    setEditTrackingNum(shipment.tracking_number || '');
    setEditDeliveryTime(shipment.estimated_delivery ? shipment.estimated_delivery.substring(0, 16) : '');
    setDeliveryCode('');
  };

  const handleUpdateShipment = async (e: React.FormEvent, targetStatus?: string) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setSavingEdit(true);
    try {
      if (targetStatus === 'delivered') {
        if (!deliveryCode || deliveryCode.length !== 6) {
          toast.error('Please enter the 6-digit delivery code provided by customer.');
          setSavingEdit(false);
          return;
        }
        await api.post(`/api/logistics/shipments/${selectedShipment.id}/confirm_delivery/`, { code: deliveryCode });
      } else {
        const driverId = editCarrierType === 'driver' && editDriver ? parseInt(editDriver) : null;
        await api.patch(`/api/logistics/shipments/${selectedShipment.id}/`, {
          status: targetStatus || editStatus,
          carrier_type: editCarrierType,
          driver: driverId,
          tracking_number: editTrackingNum,
          estimated_delivery: editDeliveryTime ? new Date(editDeliveryTime).toISOString() : null
        });
      }
      toast.success('Shipment updated successfully!');
      setSelectedShipment(null);
      setDeliveryCode('');
      fetchShipments(1, true);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to update shipment.';
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredShipments = useMemo(() => {
    if (!shipmentSearch.trim()) return shipments;
    const q = shipmentSearch.toLowerCase();
    return shipments.filter(
      (s) =>
        String(s.id).includes(q) ||
        String(s.order).includes(q) ||
        (s.driver_username || '').toLowerCase().includes(q) ||
        (s.tracking_number || '').toLowerCase().includes(q)
    );
  }, [shipments, shipmentSearch]);

  const filteredPayments = useMemo(() => {
    if (!paymentSearch.trim()) return payments;
    const q = paymentSearch.toLowerCase();
    return payments.filter(
      (p) =>
        String(p.id).includes(q) ||
        String(p.shipment_order_id || '').includes(q) ||
        (p.driver_username || '').toLowerCase().includes(q) ||
        String(p.amount).includes(q)
    );
  }, [payments, paymentSearch]);

  const shipmentFilterTabs = [
    { key: 'all', label: 'All Shipments' },
    { key: 'pending', label: 'Pending Dispatch' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'arrived_at_warehouse', label: 'At Warehouse Hub' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const paymentFilterTabs = [
    { key: 'all', label: 'All Payouts' },
    { key: 'unpaid', label: 'Awaiting Payout' },
    { key: 'paid', label: 'Disbursed' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logistics Command Center</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Dispatch fleet shipments, monitor line-haul transit, verify customer deliveries, and settle driver payouts.
          </p>
        </div>
        
        {/* Universal Mode Switcher */}
        <div className="flex bg-surface-muted dark:bg-[#161616] p-1 rounded-full border border-surface-border dark:border-surface-dark-border">
          <button
            type="button"
            onClick={() => setActiveTab('shipments')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              activeTab === 'shipments'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Shipments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              activeTab === 'payments'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Driver Payouts
          </button>
        </div>
      </header>

      {activeTab === 'shipments' ? (
        <>
          {/* Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {shipmentFilterTabs.map((tab) => {
                const isActive = shipmentFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setShipmentFilter(tab.key)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                        : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={shipmentSearch}
                onChange={(e) => setShipmentSearch(e.target.value)}
                placeholder="Search Order #, driver, tracking..."
                className="input pl-8 py-1.5 text-xs w-full"
              />
            </div>
          </div>

          {/* Shipments Grid */}
          {loadingShipments ? (
            <CardGridSkeleton count={6} cols={3} />
          ) : filteredShipments.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No Shipments Found"
              description={shipmentSearch || shipmentFilter !== 'all' ? 'No shipments matching your filter criteria.' : 'There are currently no shipments recorded.'}
              action={shipmentSearch || shipmentFilter !== 'all' ? {
                label: 'Clear Filters',
                onClick: () => { setShipmentFilter('all'); setShipmentSearch(''); }
              } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredShipments.map((ship) => {
                const badgeInfo = SHIPMENT_STATUS_BADGES[ship.status] || { 
                  label: ship.status, 
                  dot: 'bg-gray-400', 
                  color: 'text-gray-600 dark:text-gray-400', 
                  bg: 'bg-gray-500/10 border-gray-500/20' 
                };

                return (
                  <div
                    key={ship.id}
                    onClick={() => openEditModal(ship)}
                    className="card p-5 cursor-pointer hover:border-gray-900/20 dark:hover:border-white/20 transition group flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-3xs font-mono font-bold text-gray-400 uppercase">SHP-{String(ship.id).padStart(5, '0')}</p>
                          <h3 className="font-bold text-gray-900 dark:text-white text-base">Order #{ship.order}</h3>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badgeInfo.bg} ${badgeInfo.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dot}`} />
                          {badgeInfo.label}
                        </span>
                      </div>

                      {/* Clean Unboxed Metadata */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 dark:text-gray-500 font-normal">Carrier</span>
                          <span className="font-medium text-gray-900 dark:text-gray-200">
                            {ship.carrier_type === 'driver' ? 'SokoniMax Fleet' : 'Third-Party'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 dark:text-gray-500 font-normal">Driver</span>
                          <span className="font-medium text-gray-900 dark:text-gray-200">
                            {ship.driver_username ? `@${ship.driver_username}` : 'Unassigned'}
                          </span>
                        </div>
                        {ship.tracking_number && (
                          <div className="flex items-center justify-between font-mono">
                            <span className="text-gray-400 dark:text-gray-500 font-normal font-sans">Tracking</span>
                            <span className="font-medium text-brand-500">{ship.tracking_number}</span>
                          </div>
                        )}
                        {ship.has_vehicles && (
                          <div className="pt-0.5 text-[11px] font-medium text-amber-500 flex items-center gap-1">
                            <AlertTriangle size={12} /> Vehicle inspection required
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-3xs text-gray-400 pt-2 border-t border-surface-border/40">
                      <span>Click to update dispatch</span>
                      <ChevronRight size={13} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sentinel */}
          {loadingMoreShipments && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
          <div ref={shipmentSentinelRef} className="h-4" />
        </>
      ) : (
        <>
          {/* Driver Payouts Tab */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {paymentFilterTabs.map((tab) => {
                const isActive = paymentFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPaymentFilter(tab.key)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                        : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                placeholder="Search driver, Order #..."
                className="input pl-8 py-1.5 text-xs w-full"
              />
            </div>
          </div>

          {loadingPayments ? (
            <CardGridSkeleton count={6} cols={3} />
          ) : filteredPayments.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No Payouts Found"
              description={paymentSearch || paymentFilter !== 'all' ? 'No driver payout records match your search criteria.' : 'There are currently no driver payouts.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPayments.map((pay) => (
                <div key={pay.id} className="card p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-3xs font-mono font-bold text-gray-400 uppercase">PAY-{String(pay.id).padStart(4, '0')}</p>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white">
                          TZS {Number(pay.amount || 0).toLocaleString()}
                        </h3>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        pay.is_paid
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${pay.is_paid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {pay.is_paid ? 'Disbursed' : 'Awaiting Payout'}
                      </span>
                    </div>

                    {/* Clean Unboxed Metadata */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-normal">Driver</span>
                        <span className="font-medium text-gray-900 dark:text-gray-200">@{pay.driver_username || `ID ${pay.driver}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-normal">Related Order</span>
                        <span className="font-medium text-brand-500 font-mono">#{pay.shipment_order_id || '—'}</span>
                      </div>
                      {pay.paid_at && (
                        <div className="flex justify-between text-[11px] text-gray-400 pt-1 border-t border-surface-border/40">
                          <span>Disbursed</span>
                          <span>{new Date(pay.paid_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {!pay.is_paid ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleMarkPaid(pay.id)}
                      disabled={payingId === pay.id}
                      className="w-full flex items-center justify-center gap-1.5"
                    >
                      {payingId === pay.id ? <Spinner size="sm" /> : <DollarSign size={14} />}
                      Disburse Payout
                    </Button>
                  ) : (
                    <div className="text-center py-2 text-3xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/5 rounded-btn border border-emerald-500/10 flex items-center justify-center gap-1">
                      <CheckCircle2 size={13} /> Settled
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sentinel */}
          {loadingMorePayments && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
          <div ref={paymentSentinelRef} className="h-4" />
        </>
      )}

      {/* Edit & Dispatch Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setSelectedShipment(null)}>
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start pb-2 border-b border-surface-border dark:border-surface-dark-border">
              <div>
                <p className="text-3xs font-mono font-bold text-gray-400 uppercase">SHP-{String(selectedShipment.id).padStart(5, '0')}</p>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Manage Shipment Order #{selectedShipment.order}</h3>
              </div>
              <button onClick={() => setSelectedShipment(null)} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateShipment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Carrier Mode</label>
                <select
                  className="input"
                  value={editCarrierType}
                  onChange={(e) => setEditCarrierType(e.target.value as 'driver' | 'third_party')}
                >
                  <option value="driver">SokoniMax Dedicated Fleet</option>
                  <option value="third_party">Third-Party Courier</option>
                </select>
              </div>

              {editCarrierType === 'driver' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Assign Fleet Driver</label>
                  <select
                    className="input"
                    value={editDriver}
                    onChange={(e) => setEditDriver(e.target.value)}
                  >
                    <option value="">-- Unassigned --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id.toString()}>@{d.username} ({d.first_name} {d.last_name})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Tracking ID / Waybill Code</label>
                <input
                  type="text"
                  placeholder="Optional tracking reference..."
                  className="input font-mono"
                  value={editTrackingNum}
                  onChange={(e) => setEditTrackingNum(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Est. Delivery / Handover Window</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={editDeliveryTime}
                  onChange={(e) => setEditDeliveryTime(e.target.value)}
                />
              </div>

              {/* Action Buttons depending on status */}
              <div className="pt-4 border-t border-surface-border dark:border-surface-dark-border space-y-2">
                {selectedShipment.status === 'pending' && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={(e) => handleUpdateShipment(e, 'in_transit')}
                    disabled={savingEdit}
                    className="w-full"
                  >
                    {savingEdit ? 'Syncing...' : 'Dispatch Shipment (Mark In Transit)'}
                  </Button>
                )}

                {selectedShipment.status === 'in_transit' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => handleUpdateShipment(e, 'arrived_at_warehouse')}
                    disabled={savingEdit}
                    className="w-full text-amber-500"
                  >
                    {savingEdit ? 'Syncing...' : 'Mark Arrived at Regional Warehouse'}
                  </Button>
                )}

                {(selectedShipment.status === 'in_transit' || selectedShipment.status === 'arrived_at_warehouse') && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-surface-border/40">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                      Customer 6-Digit Delivery Code (Required to finalize)
                    </label>
                    <input
                      type="text"
                      value={deliveryCode}
                      onChange={(e) => setDeliveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="e.g. 849201"
                      className="input text-center font-mono font-black text-lg tracking-[0.25em]"
                    />
                    <Button
                      type="button"
                      variant="default"
                      onClick={(e) => handleUpdateShipment(e, 'delivered')}
                      disabled={savingEdit || deliveryCode.length !== 6}
                      className="w-full"
                    >
                      {savingEdit ? 'Verifying...' : 'Confirm Delivery to Customer'}
                    </Button>
                  </div>
                )}

                {selectedShipment.status === 'delivered' && (
                  <div className="text-center py-3 bg-surface-muted rounded-btn text-xs text-gray-500 font-bold">
                    This shipment is delivered and finalized.
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogisticsManager;
