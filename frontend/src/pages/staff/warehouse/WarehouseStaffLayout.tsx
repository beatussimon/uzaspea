import React, { useState, useEffect } from 'react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { Package, Camera, Upload, CheckCircle, FileText, MapPin, Key, ShieldCheck } from 'lucide-react';

const WarehouseStaffLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'intake' | 'pickup'>('intake');
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

  useEffect(() => {
    // Load warehouses list
    api.get('/api/warehouses/warehouses/')
      .then(res => {
        const list = res.data.results || res.data || [];
        setWarehouses(list);
        if (list.length > 0) {
          setSelectedWarehouseId(list[0].id.toString());
        }
      })
      .catch(() => toast.error('Failed to load warehouses list'));
  }, []);

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
          Customer Pickup Code Verification
        </button>
      </div>

      {/* Tab 1: Package Intake */}
      {activeTab === 'intake' && (
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
    </div>
  );
};

export default WarehouseStaffLayout;
