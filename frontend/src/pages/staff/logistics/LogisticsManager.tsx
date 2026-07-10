import React, { useState, useEffect } from 'react';
import { Truck, DollarSign, CheckCircle2, User, AlertTriangle, Package, Clock, X, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../api';
import toast from 'react-hot-toast';

// Reusable Components matching Warehouse Ops design language
const SkeletonCards = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="animate-pulse bg-white dark:bg-[#111] h-32 rounded-3xl border border-gray-100 dark:border-neutral-800"></div>
    ))}
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-12 bg-white/50 dark:bg-[#111]/50 rounded-3xl border border-dashed border-gray-200 dark:border-neutral-800">
    <div className="w-12 h-12 bg-gray-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-3">
      <div className="w-1.5 h-1.5 bg-gray-300 dark:bg-neutral-700 rounded-full"></div>
    </div>
    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{text}</p>
  </div>
);

const LogisticsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shipments' | 'payments'>('shipments');

  // Shipment states
  const [shipments, setShipments] = useState<any[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [drivers, setDrivers] = useState<any[]>([]);

  // Payments states
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);

  // Edit Shipment Modal states
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editCarrierType, setEditCarrierType] = useState<'driver' | 'third_party'>('driver');
  const [editDriver, setEditDriver] = useState('');
  const [editTrackingNum, setEditTrackingNum] = useState('');
  const [editDeliveryTime, setEditDeliveryTime] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchShipments = async () => {
    try {
      const res = await api.get('/api/logistics/shipments/');
      setShipments(res.data.results || res.data || []);
    } catch {
      toast.error('Failed to load shipments.');
    } finally {
      setLoadingShipments(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await api.get('/api/logistics/driver-payments/');
      setPayments(res.data.results || res.data || []);
    } catch {
      toast.error('Failed to load driver payments.');
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    api.get('/api/logistics/shipments/drivers/')
      .then(res => setDrivers(res.data || []))
      .catch(() => toast.error('Failed to load fleet drivers.'));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchShipments();
      fetchPayments();
    }, 30000);
    fetchShipments();
    fetchPayments();
    return () => clearInterval(interval);
  }, []);

  const handleMarkPaid = async (id: number) => {
    setPayingId(id);
    try {
      await api.post(`/api/logistics/driver-payments/${id}/pay/`);
      toast.success('Payment disbursed to driver successfully.');
      fetchPayments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to process payment.');
    } finally {
      setPayingId(null);
    }
  };

  const openEditModal = (shipment: any) => {
    setSelectedShipment(shipment);
    setEditStatus(shipment.status);
    setEditCarrierType(shipment.carrier_type);
    setEditDriver(shipment.driver?.toString() || '');
    setEditTrackingNum(shipment.tracking_number || '');
    setEditDeliveryTime(shipment.estimated_delivery ? shipment.estimated_delivery.substring(0, 16) : '');
  };

  const [deliveryCode, setDeliveryCode] = useState('');

  const handleUpdateShipment = async (e: React.FormEvent, targetStatus?: string) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setSavingEdit(true);
    try {
      if (targetStatus === 'delivered') {
        if (!deliveryCode || deliveryCode.length !== 6) {
          toast.error('Please enter the 6-digit delivery code.');
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
      fetchShipments();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to update shipment.';
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Derived Queues
  const pendingShipments = shipments.filter(s => s.status === 'pending');
  const transitShipments = shipments.filter(s => s.status === 'in_transit');
  const hubShipments = shipments.filter(s => s.status === 'arrived_at_hub');
  const deliveredShipments = shipments.filter(s => s.status === 'delivered');

  const unpaidPayments = payments.filter(p => !p.is_paid);
  const paidPayments = payments.filter(p => p.is_paid);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 min-h-screen pb-12">
      
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-dark border border-gray-100 dark:border-neutral-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 shadow-[0_0_20px_rgba(249,115,22,0.8)]"></div>
        <div className="pl-2">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Truck className="text-brand-500" size={28} />
            Logistics Command
          </h1>
          <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Fleet & Carrier Operations</p>
        </div>

        {/* Universal Mode Switcher (Warehouse Ops Style) */}
        <div className="flex bg-gray-100 dark:bg-neutral-900 p-1 rounded-xl shadow-inner w-full md:w-auto">
          {[
            { id: 'shipments', label: 'Shipments Kanban' },
            { id: 'payments', label: 'Payouts Kanban' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 md:w-48 py-3 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-neutral-800 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'shipments' ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { title: 'Pending Dispatch', count: pendingShipments.length, icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { title: 'In Transit', count: transitShipments.length, icon: Truck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { title: 'At Hub', count: hubShipments.length, icon: MapPin, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { title: 'Delivered', count: deliveredShipments.length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
            ].map((kpi, idx) => (
              <motion.div 
                key={kpi.title}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                className="glass-dark border border-gray-100 dark:border-neutral-800 rounded-3xl p-6 flex items-center gap-5 hover:shadow-lg transition-shadow"
              >
                <div className={`p-4 rounded-2xl ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon size={28} />
                </div>
                <div>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">{loadingShipments ? '-' : kpi.count}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{kpi.title}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Kanban Swimlanes */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Lane 1: Pending */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Package size={16} /> Pending
              </h3>
              {loadingShipments ? <SkeletonCards /> : pendingShipments.length === 0 ? <EmptyState text="No pending tasks" /> : (
                <div className="space-y-3">
                  {pendingShipments.map(ship => (
                    <ShipmentCard key={ship.id} ship={ship} onClick={() => openEditModal(ship)} badge="Pending" badgeColor="amber" />
                  ))}
                </div>
              )}
            </div>

            {/* Lane 2: In Transit */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Truck size={16} /> In Transit
              </h3>
              {loadingShipments ? <SkeletonCards /> : transitShipments.length === 0 ? <EmptyState text="Empty lane" /> : (
                <div className="space-y-3">
                  {transitShipments.map(ship => (
                    <ShipmentCard key={ship.id} ship={ship} onClick={() => openEditModal(ship)} badge="Transit" badgeColor="blue" />
                  ))}
                </div>
              )}
            </div>

            {/* Lane 3: At Hub */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <MapPin size={16} /> Destination Hub
              </h3>
              {loadingShipments ? <SkeletonCards /> : hubShipments.length === 0 ? <EmptyState text="No arrivals" /> : (
                <div className="space-y-3">
                  {hubShipments.map(ship => (
                    <ShipmentCard key={ship.id} ship={ship} onClick={() => openEditModal(ship)} badge="Hub" badgeColor="purple" />
                  ))}
                </div>
              )}
            </div>

            {/* Lane 4: Delivered */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 size={16} /> Delivered
              </h3>
              {loadingShipments ? <SkeletonCards /> : deliveredShipments.length === 0 ? <EmptyState text="No deliveries" /> : (
                <div className="space-y-3">
                  {deliveredShipments.map(ship => (
                    <ShipmentCard key={ship.id} ship={ship} onClick={() => openEditModal(ship)} badge="Done" badgeColor="emerald" />
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      ) : (
        <>
          {/* KPI Cards for Payments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: 'Awaiting Payouts', count: unpaidPayments.length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { title: 'Disbursed', count: paidPayments.length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
            ].map((kpi, idx) => (
              <motion.div 
                key={kpi.title}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                className="glass-dark border border-gray-100 dark:border-neutral-800 rounded-3xl p-6 flex items-center gap-5 hover:shadow-lg transition-shadow"
              >
                <div className={`p-4 rounded-2xl ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon size={28} />
                </div>
                <div>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">{loadingPayments ? '-' : kpi.count}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{kpi.title}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Kanban Swimlanes for Payments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Lane 1: Unpaid */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} /> Awaiting Payout
              </h3>
              {loadingPayments ? <SkeletonCards /> : unpaidPayments.length === 0 ? <EmptyState text="All clear!" /> : (
                <div className="space-y-3">
                  {unpaidPayments.map(pay => (
                    <PaymentCard 
                      key={pay.id} 
                      pay={pay} 
                      onAction={() => handleMarkPaid(pay.id)} 
                      loading={payingId === pay.id}
                      status="unpaid" 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Lane 2: Paid */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 size={16} /> Disbursed
              </h3>
              {loadingPayments ? <SkeletonCards /> : paidPayments.length === 0 ? <EmptyState text="Empty lane" /> : (
                <div className="space-y-3">
                  {paidPayments.map(pay => (
                    <PaymentCard 
                      key={pay.id} 
                      pay={pay} 
                      onAction={() => {}} 
                      loading={false}
                      status="paid" 
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit Shipment Modal - Warehouse Style */}
      <AnimatePresence>
        {selectedShipment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-xl shadow-2xl relative flex flex-col max-h-[90vh]"
            >
              <button onClick={() => setSelectedShipment(null)} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-neutral-800 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white transition z-10">
                <X size={20} />
              </button>

              <div className="p-6 md:p-8 overflow-y-auto flex-1">
                {/* Modal Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                    <Truck size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                      Manage Shipment
                    </h2>
                    <p className="text-sm text-gray-500 font-bold">SHP-{selectedShipment.id.toString().padStart(5, '0')}</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateShipment} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Carrier Mode</label>
                      <select required className="w-full bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 text-sm font-bold outline-none text-gray-900 dark:text-white" value={editCarrierType} onChange={(e) => setEditCarrierType(e.target.value as any)}>
                        <option value="driver">SokoniMax Fleet</option>
                        <option value="third_party">Third-Party Courier</option>
                      </select>
                    </div>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {editCarrierType === 'driver' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Assign Fleet Driver</label>
                        <select className="w-full bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 text-sm font-bold outline-none text-gray-900 dark:text-white" value={editDriver} onChange={(e) => setEditDriver(e.target.value)}>
                          <option value="">-- Unassigned --</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id.toString()}>@{d.username} ({d.first_name} {d.last_name})</option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Waybill / Tracking ID</label>
                    <input
                      type="text"
                      placeholder="Optional tracking code"
                      className="w-full bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 text-sm font-bold font-mono outline-none text-gray-900 dark:text-white"
                      value={editTrackingNum}
                      onChange={(e) => setEditTrackingNum(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Est. Delivery / Handover Window</label>
                    <input
                      type="datetime-local"
                      className="w-full bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 text-sm font-bold outline-none text-gray-900 dark:text-white"
                      value={editDeliveryTime}
                      onChange={(e) => setEditDeliveryTime(e.target.value)}
                    />
                  </div>

                  {selectedShipment.status === 'pending' && (
                    <button
                      type="button"
                      onClick={(e) => handleUpdateShipment(e, 'in_transit')}
                      disabled={savingEdit}
                      className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-black rounded-xl text-sm uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:opacity-50 mt-6"
                    >
                      {savingEdit ? 'Syncing...' : 'Dispatch (Mark In Transit)'}
                    </button>
                  )}

                  {selectedShipment.status === 'in_transit' && (
                    <div className="flex flex-col gap-3 mt-6">
                      <button
                        type="button"
                        onClick={(e) => handleUpdateShipment(e, 'arrived_at_hub')}
                        disabled={savingEdit}
                        className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-white font-black rounded-xl text-sm uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50"
                      >
                        {savingEdit ? 'Syncing...' : 'Mark Arrived at Hub'}
                      </button>
                    </div>
                  )}

                  {(selectedShipment.status === 'in_transit' || selectedShipment.status === 'arrived_at_hub') && (
                    <div className="flex flex-col gap-3 mt-6">
                      <div className="pt-4 border-t border-gray-200 dark:border-neutral-800">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 block">Customer Delivery Code (Required)</label>
                        <input
                          type="text"
                          value={deliveryCode}
                          onChange={(e) => setDeliveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter 6-digit Code"
                          className="w-full bg-gray-50 dark:bg-neutral-800 border-2 border-transparent focus:border-gray-900 dark:focus:border-white rounded-xl px-4 py-3 text-center font-mono font-bold text-xl tracking-[0.2em] text-gray-900 dark:text-white outline-none mb-3"
                        />
                        <button
                          type="button"
                          onClick={(e) => handleUpdateShipment(e, 'delivered')}
                          disabled={savingEdit || deliveryCode.length !== 6}
                          className="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-black rounded-xl text-sm uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(34,197,94,0.3)] disabled:opacity-50"
                        >
                          {savingEdit ? 'Syncing...' : 'Mark Delivered to Customer'}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedShipment.status === 'delivered' && (
                    <div className="mt-6 p-4 rounded-xl bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-center">
                      <p className="text-sm font-bold text-gray-500">
                        Shipment delivered to customer.
                      </p>
                      <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mt-1">Status Locked</p>
                    </div>
                  )}
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Sub-components for Kanban Cards (matching Warehouse Ops QueueCard design)
const ShipmentCard = ({ ship, onClick, badge, badgeColor }: { ship: any, onClick: () => void, badge: string, badgeColor: string }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white dark:bg-[#111] border border-gray-100 dark:border-neutral-800 rounded-3xl p-4 cursor-pointer hover:border-brand-500 hover:shadow-xl transition-all group relative overflow-hidden"
    >
      <div className={`absolute top-0 left-0 w-1 h-full bg-${badgeColor}-500 opacity-0 group-hover:opacity-100 transition-opacity`}></div>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SHP-{ship.id.toString().padStart(5, '0')}</p>
          <h4 className="text-sm font-black text-gray-900 dark:text-white mt-0.5">Order #{ship.order}</h4>
        </div>
        <span className={`px-2 py-1 bg-${badgeColor}-500/10 text-${badgeColor}-500 text-[9px] font-black uppercase tracking-widest rounded-lg border border-${badgeColor}-500/20`}>
          {badge}
        </span>
      </div>
      
      <div className="space-y-2 mt-4 pt-3 border-t border-gray-50 dark:border-neutral-800/50">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
          {ship.carrier_type === 'driver' ? <User size={14} className="text-gray-400" /> : <Truck size={14} className="text-gray-400" />}
          {ship.carrier_type === 'driver' ? (ship.driver_username ? `@${ship.driver_username}` : 'Unassigned') : 'External Courier'}
        </div>
        
        {ship.has_vehicles && (
          <div className="inline-flex items-center gap-1.5 text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full font-bold border border-amber-500/20 uppercase mt-1">
            <AlertTriangle size={10} /> Needs Driver
          </div>
        )}
      </div>
    </div>
  );
};

const PaymentCard = ({ pay, onAction, loading, status }: { pay: any, onAction: () => void, loading: boolean, status: 'paid' | 'unpaid' }) => {
  return (
    <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-neutral-800 rounded-3xl p-4 hover:border-brand-500 transition-colors relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1 h-full ${status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PAY-{pay.id.toString().padStart(4, '0')}</p>
          <h4 className="text-lg font-black text-gray-900 dark:text-white mt-0.5">TZS {Number(pay.amount).toLocaleString()}</h4>
        </div>
      </div>
      
      <div className="space-y-2 text-xs font-bold text-gray-500 pt-3 border-t border-gray-50 dark:border-neutral-800/50">
        <p className="flex justify-between">
          <span className="text-gray-400 uppercase tracking-widest text-[9px]">Driver</span>
          <span className="text-gray-900 dark:text-white">@{pay.driver_username || 'Unknown'}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-gray-400 uppercase tracking-widest text-[9px]">Context</span>
          <span className="text-brand-600 dark:text-brand-400">Order #{pay.shipment_order_id}</span>
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-50 dark:border-neutral-800/50">
        {status === 'unpaid' ? (
          <button
            onClick={onAction}
            disabled={loading}
            className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-black rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <div className="animate-spin h-3 w-3 border-2 border-emerald-500 border-t-transparent rounded-full" /> : <DollarSign size={14} />}
            Disburse Now
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest py-2.5 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
            <CheckCircle2 size={14} /> Disbursed on {new Date(pay.paid_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogisticsManager;
