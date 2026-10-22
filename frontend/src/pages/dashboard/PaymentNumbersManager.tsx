import React, { useState, useEffect } from 'react';
import {  } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Smartphone, Plus, Edit2, Trash2, Copy, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PaymentNumbersSkeleton } from '../../components/Skeleton';

// ============ Dashboard Payment Numbers ============
const PaymentNumbersManager: React.FC = () => {
  const [lipaNumbers, setLipaNumbers] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ network: '', number: '', name: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/lipa-numbers/').then(r => setLipaNumbers(r.data.results || r.data)).catch(() => {}),
      api.get('/api/mobile-networks/').then(r => setNetworks(r.data.results || r.data)).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.network || !form.number || !form.name) {
      toast.error('Please complete all fields');
      return;
    }
    try {
      if (editingId) {
        await api.patch(`/api/lipa-numbers/${editingId}/`, form);
      } else {
        await api.post('/api/lipa-numbers/', form);
      }
      const r = await api.get('/api/lipa-numbers/');
      setLipaNumbers(r.data.results || r.data);
      setForm({ network: '', number: '', name: '' });
      setEditingId(null);
      setShowForm(false);
      toast.success(editingId ? 'Payment number updated' : 'Payment number saved');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save payment number');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/lipa-numbers/${id}/`);
      setLipaNumbers(prev => prev.filter(l => l.id !== id));
      toast.success('Removed payment number');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2 flex-nowrap min-w-0 min-h-[36px]">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap shrink-0">
            Payment Numbers
          </h1>

          <Button
            type="button"
            size="sm"
            variant={showForm || editingId ? 'outline' : 'default'}
            onClick={() => {
              if (showForm || editingId) {
                setShowForm(false);
                setEditingId(null);
                setForm({ network: '', number: '', name: '' });
              } else {
                setShowForm(true);
              }
            }}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-btn shadow-xs shrink-0 cursor-pointer"
          >
            {showForm || editingId ? <X size={14} /> : <Plus size={14} />}
            <span className="sm:hidden">{showForm || editingId ? 'Close' : 'Add'}</span>
            <span className="hidden sm:inline">{showForm || editingId ? 'Close' : 'Add Payment Number'}</span>
          </Button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
          Configure mobile money (Lipa) numbers displayed to buyers for manual offline payments.
        </p>
      </header>

      {/* Form Card (Hidden by default; revealed via Add button or Edit action) */}
      {(showForm || editingId) && (
        <div className="card !border-none p-5 space-y-4 animate-scale-in">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Edit Payment Number' : 'Add New Payment Number'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Provide your official mobile money number for direct buyer payments
            </p>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile Network</label>
              <select
                value={form.network}
                onChange={e => setForm({ ...form, network: e.target.value })}
                className="input py-2 text-xs w-full"
                required
              >
                <option value="">Select Network</option>
                {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone / Till Number</label>
              <input
                placeholder="e.g. 0712345678"
                value={form.number}
                onChange={e => setForm({ ...form, number: e.target.value })}
                className="input py-2 text-xs w-full font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Account Name</label>
              <input
                placeholder="Registered owner name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="input py-2 text-xs w-full"
                required
              />
            </div>

            <div className="sm:col-span-3 flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm({ network: '', number: '', name: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="font-medium flex items-center gap-1.5 !bg-black !text-white hover:!bg-neutral-800 dark:!bg-white dark:!text-black dark:hover:!bg-neutral-200 shadow-sm"
              >
                <Plus size={14} />
                {editingId ? 'Update Number' : 'Save Payment Number'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Numbers List */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Active Payment Numbers</h2>
          <p className="text-2xs text-gray-400">{lipaNumbers.length} numbers available for checkout</p>
        </div>

        {loading ? (
          <PaymentNumbersSkeleton count={3} />
        ) : lipaNumbers.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="No Payment Numbers Configured"
            description="Add your Vodacom M-Pesa, Tigo Pesa, Airtel Money, or Halopesa number to accept customer payments."
            action={{
              label: 'Add Payment Number',
              onClick: () => setShowForm(true),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lipaNumbers.map(lipa => (
              <div key={lipa.id} className="card !border-none p-4 flex flex-col justify-between hover:shadow-xs transition">
                <div className="flex items-center gap-3 mb-3">
                  {lipa.network_logo ? (
                    <img src={lipa.network_logo} alt={lipa.network_name} className="h-8 max-w-[64px] object-contain shrink-0" />
                  ) : (
                    <Smartphone size={22} className="text-gray-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{lipa.network_name}</p>
                    <p className="text-sm font-bold font-mono text-gray-900 dark:text-white truncate">{lipa.number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{lipa.name}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 mt-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(lipa.id, lipa.number)}
                    className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition flex items-center gap-1 font-normal"
                  >
                    {copiedId === lipa.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copiedId === lipa.id ? 'Copied' : 'Copy'}</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(lipa.id);
                        setForm({ network: lipa.network, number: lipa.number, name: lipa.name });
                        setShowForm(true);
                      }}
                      className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition flex items-center gap-1 font-normal"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(lipa.id)}
                      className="text-xs text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 transition flex items-center gap-1 font-normal"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentNumbersManager;
