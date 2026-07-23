import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Edit2, Shield, Save } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

const SystemPaymentMethodsManager: React.FC = () => {
  const [methods, setMethods] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    network: '',
    number: '',
    name: '',
    purpose: 'general',
    is_system: true,
  });

  const fetchMethods = async () => {
    try {
      const res = await api.get('/api/lipa-numbers/?is_system=true');
      setMethods(res.data.results || res.data || []);
    } catch (err) {
      toast.error('Failed to load payment methods');
    }
  };

  const fetchNetworks = async () => {
    try {
      const res = await api.get('/api/mobile-networks/');
      setNetworks(res.data.results || res.data || []);
      if (res.data.results?.length > 0) {
        setFormData(prev => ({ ...prev, network: res.data.results[0].id }));
      } else if (res.data?.length > 0) {
        setFormData(prev => ({ ...prev, network: res.data[0].id }));
      }
    } catch (err) {
      toast.error('Failed to load networks');
    }
  };

  useEffect(() => {
    fetchMethods();
    fetchNetworks();
    setLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.patch(`/api/lipa-numbers/${isEditing}/`, formData);
        toast.success('Payment method updated');
      } else {
        await api.post('/api/lipa-numbers/', formData);
        toast.success('Payment method added');
      }
      setIsEditing(null);
      setFormData({ network: networks[0]?.id || '', number: '', name: '', purpose: 'general', is_system: true });
      fetchMethods();
    } catch (err) {
      toast.error('Failed to save payment method');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this payment method?')) return;
    try {
      await api.delete(`/api/lipa-numbers/${id}/`);
      toast.success('Payment method deleted');
      fetchMethods();
    } catch (err) {
      toast.error('Failed to delete payment method');
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">System Payment Methods</h2>
        <p className="text-gray-500 text-sm mt-1">Manage global Lipa Numbers used by sellers to pay the platform.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 shadow-sm dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
            {isEditing ? 'Edit Payment Method' : 'Add New Payment Method'}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Network</label>
              <select
                required
                value={formData.network}
                onChange={e => setFormData({ ...formData, network: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-gray-900 dark:focus:ring-white focus:border-gray-900 dark:focus:border-white"
              >
                {networks.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Account Number</label>
              <input
                required
                type="text"
                placeholder="e.g. 0700 000 000"
                value={formData.number}
                onChange={e => setFormData({ ...formData, number: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-gray-900 dark:focus:ring-white focus:border-gray-900 dark:focus:border-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Account Name</label>
              <input
                required
                type="text"
                placeholder="Uzaspea Limited"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-gray-900 dark:focus:ring-white focus:border-gray-900 dark:focus:border-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Purpose</label>
              <select
                required
                value={formData.purpose}
                onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-gray-900 dark:focus:ring-white focus:border-gray-900 dark:focus:border-white"
              >
                <option value="general">General (Fallback)</option>
                <option value="subscriptions">Subscriptions & Upgrades</option>
                <option value="commissions">Commission Payments</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            {isEditing ? (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(null);
                  setFormData({ network: networks[0]?.id || '', number: '', name: '', purpose: 'general', is_system: true });
                }}
                className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              className="btn-primary py-2 px-6 rounded-lg text-sm font-bold shadow-md flex items-center gap-2"
            >
              {isEditing ? <Save size={16} /> : <Plus size={16} />}
              {isEditing ? 'Save Changes' : 'Add Payment Method'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 shadow-sm dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">Network</th>
                <th className="px-6 py-4 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">Details</th>
                <th className="px-6 py-4 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">Purpose</th>
                <th className="px-6 py-4 font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {methods.map((method) => (
                <tr key={method.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {method.network_logo ? (
                        <img src={method.network_logo} alt={method.network_name} className="h-8 w-8 rounded object-cover border border-gray-200 shadow-sm dark:border-gray-700" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <CreditCard size={16} className="text-gray-400" />
                        </div>
                      )}
                      <span className="font-bold text-gray-900 dark:text-white">{method.network_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono text-gray-900 dark:text-white font-bold">{method.number}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{method.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      method.purpose === 'subscriptions' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                      method.purpose === 'commissions' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {method.purpose}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setIsEditing(method.id);
                          setFormData({
                            network: method.network,
                            number: method.number,
                            name: method.name,
                            purpose: method.purpose,
                            is_system: method.is_system,
                          });
                        }}
                        className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(method.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {methods.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Shield size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500">No system payment methods found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemPaymentMethodsManager;
