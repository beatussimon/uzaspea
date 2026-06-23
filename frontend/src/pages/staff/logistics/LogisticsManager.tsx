import React, { useState, useEffect } from 'react';
import { Truck, DollarSign, CheckCircle2, ExternalLink, User, Clipboard, AlertTriangle } from 'lucide-react';
import api from '../../../api';
import toast from 'react-hot-toast';

const LogisticsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shipments' | 'create' | 'payments'>('shipments');

  // Shipment states
  const [shipments, setShipments] = useState<any[]>([]);
  const [shipmentFilter, setShipmentFilter] = useState('');
  const [loadingShipments, setLoadingShipments] = useState(false);

  // Create Shipment states
  const [orderId, setOrderId] = useState('');
  const [carrierType, setCarrierType] = useState<'driver' | 'third_party'>('driver');
  const [driverUsername, setDriverUsername] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [creatingShipment, setCreatingShipment] = useState(false);

  // Payments states
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentFilter, setPaymentFilter] = useState(''); // '' (all), 'paid', 'unpaid'
  const [loadingPayments, setLoadingPayments] = useState(false);
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
    setLoadingShipments(true);
    try {
      const url = shipmentFilter ? `/api/logistics/shipments/?status=${shipmentFilter}` : '/api/logistics/shipments/';
      const res = await api.get(url);
      setShipments(res.data.results || res.data || []);
    } catch {
      toast.error('Failed to load shipments.');
    } finally {
      setLoadingShipments(false);
    }
  };

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const res = await api.get('/api/logistics/driver-payments/');
      const list = res.data.results || res.data || [];
      if (paymentFilter === 'paid') {
        setPayments(list.filter((p: any) => p.is_paid));
      } else if (paymentFilter === 'unpaid') {
        setPayments(list.filter((p: any) => !p.is_paid));
      } else {
        setPayments(list);
      }
    } catch {
      toast.error('Failed to load driver payments.');
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'shipments') {
      fetchShipments();
    } else if (activeTab === 'payments') {
      fetchPayments();
    }
  }, [activeTab, shipmentFilter, paymentFilter]);

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      toast.error('Order ID is required.');
      return;
    }
    setCreatingShipment(true);
    try {
      // Find driver ID by username if driver is selected
      let driverId = null;
      if (carrierType === 'driver' && driverUsername) {
        try {
          const profileRes = await api.get(`/api/profiles/${driverUsername}/`);
          driverId = profileRes.data.user;
        } catch {
          toast.error(`Driver username @${driverUsername} not found.`);
          setCreatingShipment(false);
          return;
        }
      }

      await api.post('/api/logistics/shipments/', {
        order: orderId,
        carrier_type: carrierType,
        driver: driverId,
        tracking_number: trackingNumber,
        status: 'pending'
      });

      toast.success('Shipment record created successfully!');
      setOrderId('');
      setDriverUsername('');
      setTrackingNumber('');
      setActiveTab('shipments');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to create shipment.';
      toast.error(msg);
    } finally {
      setCreatingShipment(false);
    }
  };

  const handleMarkPaid = async (id: number) => {
    setPayingId(id);
    try {
      await api.post(`/api/logistics/driver-payments/${id}/pay/`);
      toast.success('Driver payment marked as paid.');
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
    setEditDriver(shipment.driver_username || '');
    setEditTrackingNum(shipment.tracking_number || '');
    setEditDeliveryTime(shipment.estimated_delivery ? shipment.estimated_delivery.substring(0, 16) : '');
  };

  const handleUpdateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    // Enforce driver assignment for vehicles before in_transit
    if (editStatus === 'in_transit' && editCarrierType === 'driver' && !editDriver) {
      if (selectedShipment.has_vehicles) {
        toast.error("Vehicle shipments must have a driver assigned before they can transition to transit!");
        return;
      }
    }

    setSavingEdit(true);
    try {
      let driverId = null;
      if (editCarrierType === 'driver' && editDriver) {
        try {
          const profileRes = await api.get(`/api/profiles/${editDriver}/`);
          driverId = profileRes.data.user;
        } catch {
          toast.error(`Driver username @${editDriver} not found.`);
          setSavingEdit(false);
          return;
        }
      }

      await api.patch(`/api/logistics/shipments/${selectedShipment.id}/`, {
        status: editStatus,
        carrier_type: editCarrierType,
        driver: driverId,
        tracking_number: editTrackingNum,
        estimated_delivery: editDeliveryTime ? new Date(editDeliveryTime).toISOString() : null
      });

      toast.success('Shipment updated successfully!');
      setSelectedShipment(null);
      fetchShipments();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to update shipment.';
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-brand-500/10 text-brand-500 rounded-xl">
          <Truck size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Logistics & Shipments Management</h2>
          <p className="text-xs text-gray-500">Monitor vehicle dispatching, driver assignments, and secure shipping fees payout.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-neutral-800">
        {[
          { id: 'shipments', label: 'All Shipments', count: shipments.length },
          { id: 'create', label: 'Create Shipment' },
          { id: 'payments', label: 'Driver Payments', count: payments.length }
        ].map((tab: any) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-center border-b-2 text-sm font-semibold transition-all duration-200 flex justify-center items-center gap-2 ${
              activeTab === tab.id
                ? 'border-brand-600 text-brand-600 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-[10px] bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400 font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Shipments List */}
      {activeTab === 'shipments' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap bg-white dark:bg-[#0a0a0a] p-2 rounded-xl border border-gray-100 dark:border-neutral-800">
            {['', 'pending', 'in_transit', 'arrived_at_hub', 'delivered'].map((st: string) => (
              <button
                key={st}
                onClick={() => setShipmentFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                  shipmentFilter === st
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                {st ? st.replace('_', ' ') : 'All Statuses'}
              </button>
            ))}
          </div>

          {loadingShipments ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
            </div>
          ) : shipments.length === 0 ? (
            <div className="text-center py-12 text-gray-500 card">
              No shipments found matching the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shipments.map((ship: any) => (
                <div key={ship.id} className="card p-5 border-gray-100 dark:border-neutral-800 space-y-4 flex flex-col justify-between hover:border-brand-500 transition-colors">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shipment #{ship.id}</span>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mt-0.5">Order Ref: Order #{ship.order}</h4>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                        ship.status === 'pending'
                          ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : ship.status === 'in_transit'
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                          : ship.status === 'delivered'
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      }`}>
                        {ship.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 pt-1 border-t border-gray-50 dark:border-neutral-900">
                      <div>
                        <p className="text-[9px] font-bold uppercase text-gray-400">Carrier</p>
                        <p className="font-semibold text-gray-700 dark:text-gray-300 capitalize">{ship.carrier_type.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase text-gray-400">Driver</p>
                        <p className="font-semibold text-gray-700 dark:text-gray-300 truncate">
                          {ship.driver_username ? `@${ship.driver_username}` : 'None Assigned'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase text-gray-400">Tracking Code</p>
                        <p className="font-semibold text-gray-700 dark:text-gray-300 font-mono truncate">{ship.tracking_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase text-gray-400">Est. Handover</p>
                        <p className="font-semibold text-gray-700 dark:text-gray-300 truncate">
                          {ship.estimated_delivery ? new Date(ship.estimated_delivery).toLocaleString() : 'Not Set'}
                        </p>
                      </div>
                    </div>

                    {ship.has_vehicles && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-500 bg-amber-500/10 p-2 rounded-lg font-bold border border-amber-500/20">
                        <AlertTriangle size={14} />
                        <span>Contains Vehicle (Driver assignment mandatory before transit)</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-50 dark:border-neutral-900 mt-2">
                    <button
                      onClick={() => openEditModal(ship)}
                      className="flex-1 py-2 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs uppercase tracking-wide transition border dark:border-neutral-800"
                    >
                      Update
                    </button>
                    {ship.status !== 'pending' && (
                      <a
                        href={`/shipments/${ship.id}/track`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs uppercase tracking-wide transition flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink size={14} /> Track
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Shipment Form */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateShipment} className="card p-6 space-y-6 border-gray-100 dark:border-neutral-800">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider border-b border-gray-100 dark:border-neutral-800 pb-3">
            Register New Order Shipment
          </h3>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Clipboard size={16} /> Order ID
            </label>
            <input
              type="number"
              required
              placeholder="e.g. 1045"
              className="input w-full"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
            <p className="text-[10px] text-gray-400">Order should ideally be in SELLER_CONFIRMED, PACKAGING, or RECEIVED_AT_WAREHOUSE states.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Carrier Type</label>
            <select
              className="input w-full"
              value={carrierType}
              onChange={(e) => setCarrierType(e.target.value as any)}
            >
              <option value="driver">SokoniMax Fleet Driver</option>
              <option value="third_party">Third-Party Courier</option>
            </select>
          </div>

          {carrierType === 'driver' && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <User size={16} /> Driver Username
              </label>
              <input
                type="text"
                placeholder="e.g. driver_john"
                className="input w-full"
                value={driverUsername}
                onChange={(e) => setDriverUsername(e.target.value)}
              />
              <p className="text-[10px] text-gray-400">Enter the exact system username of the driver (without the @ symbol).</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Tracking Number / Reference</label>
            <input
              type="text"
              placeholder="e.g. SNX-TRACK-19485"
              className="input w-full"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={creatingShipment || !orderId}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition shadow-lg shadow-brand-600/20 disabled:opacity-50"
          >
            {creatingShipment ? 'Creating Shipment...' : 'Create Shipment Record'}
          </button>
        </form>
      )}

      {/* Driver Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex gap-2 bg-white dark:bg-[#0a0a0a] p-2 rounded-xl border border-gray-100 dark:border-neutral-800">
            {['', 'unpaid', 'paid'].map((f: string) => (
              <button
                key={f}
                onClick={() => setPaymentFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                  paymentFilter === f
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                {f ? f : 'All Payments'}
              </button>
            ))}
          </div>

          {loadingPayments ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12 text-gray-500 card">
              No driver payments recorded.
            </div>
          ) : (
            <div className="card overflow-x-auto border-gray-100 dark:border-neutral-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 font-bold uppercase text-[9px] text-gray-400">
                    <th className="p-4">Payment ID</th>
                    <th className="p-4">Driver</th>
                    <th className="p-4">Shipment / Order</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-neutral-900">
                  {payments.map((pay: any) => (
                    <tr key={pay.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/10">
                      <td className="p-4 font-mono font-bold">#{pay.id}</td>
                      <td className="p-4">
                        <span className="font-semibold">@{pay.driver_username || 'Unknown'}</span>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Shipment #{pay.shipment}</p>
                        <p className="text-[10px] text-gray-400 font-bold">Order #{pay.shipment_order_id}</p>
                      </td>
                      <td className="p-4 font-bold text-gray-800 dark:text-gray-100">
                        TZS {Number(pay.amount).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                          pay.is_paid
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {pay.is_paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="p-4">
                        {!pay.is_paid && (
                          <button
                            onClick={() => handleMarkPaid(pay.id)}
                            disabled={payingId === pay.id}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition shadow shadow-green-600/20 flex items-center gap-1"
                          >
                            <DollarSign size={12} />
                            {payingId === pay.id ? 'Processing...' : 'Mark Paid'}
                          </button>
                        )}
                        {pay.is_paid && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-green-500" />
                            {new Date(pay.paid_at).toLocaleDateString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Shipment Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 border-neutral-800 space-y-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-100 dark:border-neutral-800 pb-3 flex items-center gap-2">
              <Truck size={18} className="text-brand-500" /> Update Shipment #{selectedShipment.id}
            </h3>

            <form onSubmit={handleUpdateShipment} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Order Reference</label>
                <input type="text" disabled className="input w-full bg-gray-50 dark:bg-neutral-900 cursor-not-allowed text-xs" value={`Order #${selectedShipment.order}`} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Shipment Status</label>
                <select required className="input w-full text-xs" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="in_transit">In Transit</option>
                  <option value="arrived_at_hub">Arrived At Hub</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Carrier Type</label>
                <select required className="input w-full text-xs" value={editCarrierType} onChange={(e) => setEditCarrierType(e.target.value as any)}>
                  <option value="driver">SokoniMax Fleet Driver</option>
                  <option value="third_party">Third-Party Courier</option>
                </select>
              </div>

              {editCarrierType === 'driver' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Driver Username</label>
                  <input
                    type="text"
                    placeholder="driver_john"
                    className="input w-full text-xs"
                    value={editDriver}
                    onChange={(e) => setEditDriver(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Tracking number / Waybill</label>
                <input
                  type="text"
                  placeholder="SNX-..."
                  className="input w-full text-xs font-mono"
                  value={editTrackingNum}
                  onChange={(e) => setEditTrackingNum(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Est. Delivery / Handover Time</label>
                <input
                  type="datetime-local"
                  className="input w-full text-xs"
                  value={editDeliveryTime}
                  onChange={(e) => setEditDeliveryTime(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-50 dark:border-neutral-900">
                <button
                  type="button"
                  onClick={() => setSelectedShipment(null)}
                  className="flex-1 py-2 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs uppercase transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs uppercase transition shadow shadow-brand-600/20"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogisticsManager;
