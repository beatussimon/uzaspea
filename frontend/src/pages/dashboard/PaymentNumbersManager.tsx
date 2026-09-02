import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Smartphone, Plus, Edit2, Trash2, Copy, Check, ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

// ============ Dashboard Payment Numbers ============
const PaymentNumbersManager: React.FC = () => {
  const navigate = useNavigate();
  const [lipaNumbers, setLipaNumbers] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [form, setForm] = useState({ network: '', number: '', name: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    api.get('/api/lipa-numbers/').then(r => setLipaNumbers(r.data.results || r.data)).catch(() => {});
    api.get('/api/mobile-networks/').then(r => setNetworks(r.data.results || r.data)).catch(() => {});
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
      toast.success('Payment number saved');
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition -ml-1.5 p-0.5 rounded-lg inline-flex items-center"
              title="Back"
            >
              <ChevronLeft size={22} />
            </button>
            <span>Payment Numbers</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Configure mobile money (Lipa) numbers displayed to buyers for manual offline payments.
          </p>
        </div>
      </header>

      {/* Form Card */}
      <div className="card p-5 space-y-4">
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
            {editingId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setEditingId(null); setForm({ network: '', number: '', name: '' }); }}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              className="font-medium flex items-center gap-1.5"
            >
              <Plus size={14} />
              {editingId ? 'Update Number' : 'Save Payment Number'}
            </Button>
          </div>
        </form>
      </div>

      {/* Numbers List */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Active Payment Numbers</h2>
          <p className="text-2xs text-gray-400">{lipaNumbers.length} numbers available for checkout</p>
        </div>

        {lipaNumbers.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="No Payment Numbers Configured"
            description="Add your Vodacom M-Pesa, Tigo Pesa, Airtel Money, or Halopesa number above."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lipaNumbers.map(lipa => (
              <div key={lipa.id} className="card p-4 flex flex-col justify-between hover:shadow-xs transition">
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

                <div className="flex items-center justify-between pt-3 border-t border-surface-border dark:border-surface-dark-border">
                  <button
                    type="button"
                    onClick={() => handleCopy(lipa.id, lipa.number)}
                    className="btn-ghost text-3xs py-1 px-2 border border-surface-border dark:border-surface-dark-border rounded flex items-center gap-1"
                  >
                    {copiedId === lipa.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copiedId === lipa.id ? 'Copied' : 'Copy'}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingId(lipa.id); setForm({ network: lipa.network, number: lipa.number, name: lipa.name }); }}
                      className="text-3xs py-1 px-2.5 h-7 font-bold"
                    >
                      <Edit2 size={11} className="mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(lipa.id)}
                      className="text-3xs py-1 px-2.5 h-7 text-red-500 border-red-500/30 hover:bg-red-500/10"
                    >
                      <Trash2 size={11} className="mr-1" /> Remove
                    </Button>
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
