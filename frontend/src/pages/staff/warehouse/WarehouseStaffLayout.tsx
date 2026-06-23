import React, { useState, useEffect } from 'react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { Package, Camera, Upload, CheckCircle, FileText, MapPin, Key, ShieldCheck, Clock } from 'lucide-react';

const WarehouseStaffLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'intake' | 'pickup' | 'transfers'>('intake');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pickup Verification States
  const [pickupCode, setPickupCode] = useState('');
  const [verifyingPickup, setVerifyingPickup] = useState(false);

  // Transfers States
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [transferOrderId, setTransferOrderId] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [creatingTransfer, setCreatingTransfer] = useState(false);

  // Pending Intakes Queue States
  const [pendingIntakes, setPendingIntakes] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const fetchPendingQueue = async (whId: string) => {
    if (!whId) return;
    setLoadingQueue(true);
    try {
      const res = await api.get(`/api/warehouses/warehouses/${whId}/pending-intakes/`);
      setPendingIntakes(res.data.results || res.data || []);
    } catch {
      toast.error('Failed to load pending queue');
    } finally {
      setLoadingQueue(false);
    }
  };

  const fetchTransfers = async (whId: string) => {
    if (!whId) return;
    setLoadingTransfers(true);
    try {
      const res = await api.get(`/api/warehouses/transfers/?warehouse=${whId}`);
      setTransfers(res.data.results || res.data || []);
    } catch {
      toast.error('Failed to load warehouse transfers');
    } finally {
      setLoadingTransfers(false);
    }
  };

  useEffect(() => {
    // Load warehouses list
    api.get('/api/warehouses/warehouses/')
      .then(res => {
        const list = res.data.results || res.data || [];
        setWarehouses(list);
        if (list.length > 0) {
          const savedId = localStorage.getItem('sokonimax_warehouse_id');
          const exists = list.some((w: any) => w.id.toString() === savedId);
          if (savedId && exists) {
            setSelectedWarehouseId(savedId);
          } else {
            setSelectedWarehouseId(list[0].id.toString());
          }
        }
      })
      .catch(() => toast.error('Failed to load warehouses list'));
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) {
      localStorage.setItem('sokonimax_warehouse_id', selectedWarehouseId);
      fetchPendingQueue(selectedWarehouseId);
      fetchTransfers(selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId || !destWarehouseId || !transferOrderId) {
      toast.error('All fields are required.');
      return;
    }
    if (selectedWarehouseId === destWarehouseId) {
      toast.error('Source and destination warehouse cannot be the same.');
      return;
    }
    setCreatingTransfer(true);
    try {
      await api.post('/api/warehouses/transfers/', {
        source_warehouse: selectedWarehouseId,
        destination_warehouse: destWarehouseId,
        order: transferOrderId,
        status: 'pending'
      });
      toast.success('Warehouse transfer created successfully!');
      setTransferOrderId('');
      fetchTransfers(selectedWarehouseId);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to create transfer';
      toast.error(msg);
    } finally {
      setCreatingTransfer(false);
    }
  };

  const handleShipTransfer = async (id: number) => {
    try {
      await api.post(`/api/warehouses/transfers/${id}/ship/`);
      toast.success('Transfer marked as shipped!');
      fetchTransfers(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to ship transfer');
    }
  };

  const handleReceiveTransfer = async (id: number) => {
    try {
      await api.post(`/api/warehouses/transfers/${id}/receive/`);
      toast.success('Transfer marked as received!');
      fetchTransfers(selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to receive transfer');
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId) {
      toast.error('Please select a warehouse hub.');
      return;
    }
    if (!orderId) {
      toast.error('Order ID is required.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('warehouse', selectedWarehouseId);
    formData.append('order', orderId);
    formData.append('package_condition', condition);
    formData.append('notes', notes);
    if (photo) {
      formData.append('photo', photo);
    }

    try {
      await api.post('/api/warehouses/intakes/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Order #${orderId} checked into warehouse successfully!`);
      // Reset form
      setOrderId('');
      setNotes('');
      setPhoto(null);
      setPhotoPreview(null);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to record warehouse intake. Make sure the order exists and is in the correct state (e.g. Shipped to Warehouse).';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupCode || pickupCode.length !== 6) {
      toast.error('Please enter a valid 6-digit pickup code.');
      return;
    }

    setVerifyingPickup(true);
    try {
      const res = await api.post('/api/warehouses/pickup/verify/', { code: pickupCode });
      toast.success(`Order #${res.data.order_id} verified and released successfully!`);
      setPickupCode('');
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to verify pickup code. Please make sure the code is correct and has not been used.';
      toast.error(errMsg);
    } finally {
      setVerifyingPickup(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-brand-500/10 text-brand-500 rounded-xl">
          <Package size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Warehouse Operations Hub</h2>
          <p className="text-xs text-gray-500">Manage incoming inventory intakes and secure customer package handovers.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('intake')}
          className={`flex-1 py-3 text-center border-b-2 text-sm font-semibold transition-all duration-200 ${
            activeTab === 'intake'
              ? 'border-brand-600 text-brand-600 dark:text-white'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Package Intake
        </button>
        <button
          onClick={() => setActiveTab('pickup')}
          className={`flex-1 py-3 text-center border-b-2 text-sm font-semibold transition-all duration-200 ${
            activeTab === 'pickup'
              ? 'border-brand-600 text-brand-600 dark:text-white'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Customer Pickup Verification
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex-1 py-3 text-center border-b-2 text-sm font-semibold transition-all duration-200 ${
            activeTab === 'transfers'
              ? 'border-brand-600 text-brand-600 dark:text-white'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Warehouse Transfers
        </button>
      </div>

      {/* Tab 1: Package Intake */}
      {activeTab === 'intake' && (
        <div className="space-y-6">
          <form onSubmit={handleIntakeSubmit} className="card p-6 space-y-6 border-gray-100 dark:border-neutral-800">
            {/* Select Warehouse */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2"><MapPin size={16} /> Current Warehouse Hub</span>
              </label>
              <select
                required
                className="input w-full"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            {/* Order ID */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2"><FileText size={16} /> Order ID / Code</span>
              </label>
              <input
                type="number"
                required
                placeholder="e.g. 1024"
                className="input w-full"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
            </div>

            {/* Condition Check */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Package Condition</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'good', label: 'Good / Intact', color: 'border-green-500 text-green-600 dark:text-green-400 bg-green-50/20' },
                  { id: 'opened', label: 'Box Opened', color: 'border-yellow-500 text-yellow-600 dark:text-yellow-400 bg-yellow-50/20' },
                  { id: 'damaged', label: 'Damaged Pack', color: 'border-red-500 text-red-600 dark:text-red-400 bg-red-50/20' },
                  { id: 'incomplete', label: 'Missing Item', color: 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50/20' }
                ].map(cond => {
                  const active = condition === cond.id;
                  return (
                    <button
                      key={cond.id}
                      type="button"
                      onClick={() => setCondition(cond.id)}
                      className={`py-3 px-2 border rounded-xl text-xs font-bold text-center transition ${
                        active
                          ? cond.color + ' ring-2 ring-brand-500'
                          : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {cond.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Photo Proof */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2"><Camera size={16} /> Photo Verification Proof</span>
              </label>
              <div className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-6 text-center hover:border-brand-500 transition-colors relative cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handlePhotoChange}
                />
                {photoPreview ? (
                  <div className="space-y-3 pointer-events-none">
                    <img src={photoPreview} alt="Intake Proof Preview" className="max-h-48 mx-auto object-contain rounded-lg border dark:border-neutral-800" />
                    <p className="text-xs text-brand-600 font-bold flex items-center justify-center gap-1">
                      <CheckCircle size={14} /> {photo?.name}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 pointer-events-none">
                    <Upload className="mx-auto text-gray-400" size={24} />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Click to capture photo using camera or upload file
                    </p>
                    <p className="text-[10px] text-gray-400">Support mobile camera snapshots</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Intake Logs / Notes</label>
              <textarea
                rows={3}
                placeholder="Add any specific details regarding packaging, shipping label, or anomalies..."
                className="input w-full"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Recording Intake...' : 'Submit & Receive Package'}
            </button>
          </form>

          {/* Pending Queue Card */}
          <div className="card p-6 border-gray-100 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-brand-500" /> Pending Intake Queue ({pendingIntakes.length})
              </h3>
              <button
                type="button"
                onClick={() => fetchPendingQueue(selectedWarehouseId)}
                className="text-xs text-brand-600 hover:text-brand-700 font-bold"
              >
                Refresh
              </button>
            </div>

            {loadingQueue ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
              </div>
            ) : pendingIntakes.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500">
                No orders are currently waiting to be received at this warehouse.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {pendingIntakes.map((order: any) => (
                  <div
                    key={order.id}
                    onClick={() => setOrderId(order.id.toString())}
                    className={`p-3 border rounded-xl hover:border-brand-500 transition cursor-pointer text-left ${
                      orderId === order.id.toString()
                        ? 'border-brand-600 bg-brand-50/20 ring-1 ring-brand-500'
                        : 'border-gray-100 dark:border-neutral-800 hover:bg-gray-50/50 dark:hover:bg-neutral-800/20'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">Order #{order.id}</span>
                      <span className="text-[9px] bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 px-1.5 py-0.5 rounded-full font-bold uppercase">
                        Pending
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 truncate">
                      Buyer: {order.delivery_info?.fullName || order.buyer_username || 'Customer'}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5 truncate">
                      {order.items?.map((i: any) => `${i.quantity}x ${i.product_name || i.name}`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Pickup Verification */}
      {activeTab === 'pickup' && (
        <form onSubmit={handlePickupVerify} className="card p-6 space-y-6 border-gray-100 dark:border-neutral-800">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
              <span className="flex items-center gap-2"><Key size={16} /> Enter 6-Digit Pickup Code</span>
            </label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="e.g. 832912"
              className="input w-full text-center text-lg font-mono font-bold tracking-widest"
              value={pickupCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (val.length <= 6) setPickupCode(val);
              }}
            />
            <p className="text-[11px] text-gray-400">The 6-digit secure code is sent to the customer once their package arrives at the regional hub.</p>
          </div>

          <button
            type="submit"
            disabled={verifyingPickup || pickupCode.length !== 6}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {verifyingPickup ? (
              'Verifying Code...'
            ) : (
              <>
                <ShieldCheck size={18} />
                Verify & Release Package
              </>
            )}
          </button>
        </form>
      )}

      {/* Tab 3: Warehouse Transfers */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          {/* Create Transfer Form */}
          <form onSubmit={handleCreateTransfer} className="card p-6 space-y-6 border-gray-100 dark:border-neutral-800">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider border-b border-gray-100 dark:border-neutral-800 pb-3">
              Initiate Inter-Warehouse Transfer
            </h3>

            {/* Source Warehouse */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Source Warehouse (Current)</label>
              <input
                type="text"
                disabled
                className="input w-full bg-gray-50 dark:bg-neutral-800 cursor-not-allowed"
                value={warehouses.find(w => w.id.toString() === selectedWarehouseId)?.name || 'Loading source...'}
              />
            </div>

            {/* Destination Warehouse */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Destination Warehouse</label>
              <select
                required
                className="input w-full"
                value={destWarehouseId}
                onChange={(e) => setDestWarehouseId(e.target.value)}
              >
                <option value="">-- Select Destination --</option>
                {warehouses.filter(w => w.id.toString() !== selectedWarehouseId).map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            {/* Order ID */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Order ID</label>
              <input
                type="number"
                required
                placeholder="e.g. 1024"
                className="input w-full"
                value={transferOrderId}
                onChange={(e) => setTransferOrderId(e.target.value)}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={creatingTransfer || !destWarehouseId || !transferOrderId}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingTransfer ? 'Creating Transfer...' : 'Initiate Transfer'}
            </button>
          </form>

          {/* Transfers List */}
          <div className="card p-6 border-gray-100 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                Hub Transfer Queue ({transfers.length})
              </h3>
              <button
                type="button"
                onClick={() => fetchTransfers(selectedWarehouseId)}
                className="text-xs text-brand-600 hover:text-brand-700 font-bold"
              >
                Refresh
              </button>
            </div>

            {loadingTransfers ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
              </div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500">
                No active transfers recorded at this warehouse hub.
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {transfers.map((t: any) => {
                  const isSource = t.source_warehouse.toString() === selectedWarehouseId || t.source_warehouse?.id?.toString() === selectedWarehouseId;
                  const isDest = t.destination_warehouse.toString() === selectedWarehouseId || t.destination_warehouse?.id?.toString() === selectedWarehouseId;
                  
                  return (
                    <div key={t.id} className="p-4 border border-gray-100 dark:border-neutral-800 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">Transfer #{t.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          t.status === 'pending'
                            ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : t.status === 'in_transit'
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                            : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                          {t.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                        <div>
                          <p className="font-bold text-gray-400 uppercase text-[9px]">Source</p>
                          <p className="truncate font-semibold text-gray-700 dark:text-gray-300">
                            {t.source_warehouse_name || `Hub #${t.source_warehouse}`}
                          </p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-400 uppercase text-[9px]">Destination</p>
                          <p className="truncate font-semibold text-gray-700 dark:text-gray-300">
                            {t.destination_warehouse_name || `Hub #${t.destination_warehouse}`}
                          </p>
                        </div>
                        <div className="col-span-2 border-t border-gray-50 dark:border-neutral-900 pt-2 mt-1">
                          <p className="font-bold text-gray-400 uppercase text-[9px]">Order Reference</p>
                          <p className="font-bold text-gray-800 dark:text-gray-200">Order #{t.order}</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2 border-t border-gray-50 dark:border-neutral-900">
                        {t.status === 'pending' && isSource && (
                          <button
                            onClick={() => handleShipTransfer(t.id)}
                            className="flex-1 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs uppercase tracking-wide transition"
                          >
                            Mark Shipped
                          </button>
                        )}
                        {t.status === 'in_transit' && isDest && (
                          <button
                            onClick={() => handleReceiveTransfer(t.id)}
                            className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs uppercase tracking-wide transition"
                          >
                            Mark Received
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseStaffLayout;
