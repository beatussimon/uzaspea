import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard, Plus, Trash2, Edit2, Save, X, Search } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { PageHeaderSkeleton, CardGridSkeleton } from '../../components/Skeleton';

const SystemPaymentMethodsManager: React.FC = () => {
  const [methods, setMethods] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [filterPurpose, setFilterPurpose] = useState('all');
  const [search, setSearch] = useState('');

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
    } catch {
      toast.error('Failed to load payment methods');
    }
  };

  const fetchNetworks = async () => {
    try {
      const res = await api.get('/api/mobile-networks/');
      const list = res.data.results || res.data || [];
      setNetworks(list);
      if (list.length > 0) {
        setFormData(prev => ({ ...prev, network: list[0].id }));
      }
    } catch {
      toast.error('Failed to load mobile networks');
    }
  };

  useEffect(() => {
    Promise.all([fetchMethods(), fetchNetworks()]).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.patch(`/api/lipa-numbers/${isEditing}/`, formData);
        toast.success('Payment channel updated');
      } else {
        await api.post('/api/lipa-numbers/', formData);
        toast.success('New payment channel added');
      }
      setIsEditing(null);
      setFormData({ network: networks[0]?.id || '', number: '', name: '', purpose: 'general', is_system: true });
      fetchMethods();
    } catch {
      toast.error('Failed to save payment channel');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this payment method?')) return;
    try {
      await api.delete(`/api/lipa-numbers/${id}/`);
      toast.success('Payment method deleted');
      fetchMethods();
    } catch {
      toast.error('Failed to delete payment method');
    }
  };

  const filteredMethods = useMemo(() => {
    return methods.filter(m => {
      if (filterPurpose !== 'all' && m.purpose !== filterPurpose) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.number.includes(q) && !(m.network_name || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [methods, filterPurpose, search]);

  const purposePills = [
    { key: 'all', label: 'All Channels' },
    { key: 'general', label: 'General / Fallback' },
    { key: 'subscriptions', label: 'Subscriptions' },
    { key: 'commissions', label: 'Commissions' },
    { key: 'logistics', label: 'Logistics' },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeaderSkeleton />
        <CardGridSkeleton count={4} cols={2} />
      </div>
    );
  }

  const getPurposeBadge = (purpose: string) => {
    switch (purpose) {
      case 'subscriptions':
        return { label: 'Subscriptions', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' };
      case 'commissions':
        return { label: 'Commissions', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dot: 'bg-amber-500' };
      case 'logistics':
        return { label: 'Logistics', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', dot: 'bg-purple-500' };
      default:
        return { label: 'General', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', dot: 'bg-blue-500' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Official Payment Channels</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage Lipa na M-Pesa / Airtel Money / Tigo Pesa numbers used by sellers to pay platform dues.
          </p>
        </div>
      </header>

      {/* Editor / Creator Card */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            {isEditing ? <Edit2 size={16} className="text-brand-500" /> : <Plus size={16} className="text-brand-500" />}
            {isEditing ? 'Edit Payment Method' : 'Add System Payment Channel'}
          </h3>
          {isEditing && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(null);
                setFormData({ network: networks[0]?.id || '', number: '', name: '', purpose: 'general', is_system: true });
              }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <X size={14} /> Cancel Editing
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mobile Network</label>
              <select
                required
                value={formData.network}
                onChange={e => setFormData({ ...formData, network: e.target.value })}
                className="input text-xs"
              >
                {networks.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Account / Till Number</label>
              <input
                required
                type="text"
                placeholder="e.g. 5493021 or 0700..."
                value={formData.number}
                onChange={e => setFormData({ ...formData, number: e.target.value })}
                className="input text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Account Holder Name</label>
              <input
                required
                type="text"
                placeholder="e.g. SOKONIMAX LTD"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Channel Purpose</label>
              <select
                required
                value={formData.purpose}
                onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                className="input text-xs"
              >
                <option value="general">General (Fallback)</option>
                <option value="subscriptions">Tier Subscriptions</option>
                <option value="commissions">Commission Payments</option>
                <option value="logistics">Logistics & Delivery Fees</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" variant="default" size="sm" className="flex items-center gap-1.5 font-medium">
              {isEditing ? <Save size={14} /> : <Plus size={14} />}
              {isEditing ? 'Save Changes' : 'Register Channel'}
            </Button>
          </div>
        </form>
      </div>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {purposePills.map((tab) => {
            const isActive = filterPurpose === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterPurpose(tab.key)}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channel number, name..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Channels List */}
      {filteredMethods.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No Payment Channels Found"
          description="There are currently no active system payment channels in this category."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMethods.map((method) => (
            <div key={method.id} className="card p-5 flex flex-col justify-between space-y-4 hover:border-gray-900/20 dark:hover:border-white/20 transition">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {method.network_logo ? (
                      <img src={method.network_logo} alt={method.network_name} className="h-8 max-w-[64px] object-contain shrink-0" />
                    ) : (
                      <CreditCard size={22} className="text-gray-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{method.network_name || 'Network'}</h4>
                    </div>
                  </div>
                  {(() => {
                    const badge = getPurposeBadge(method.purpose);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${badge.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Clean Unboxed Metadata */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-gray-400 dark:text-gray-500 font-sans font-normal">Account / Number</span>
                    <span className="font-bold text-gray-900 dark:text-white">{method.number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 dark:text-gray-500 font-normal">Account Name</span>
                    <span className="font-medium text-gray-900 dark:text-gray-200">{method.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border/40">
                <Button
                  size="sm"
                  variant="outline"
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
                  className="py-1 px-2.5 text-3xs flex items-center gap-1"
                >
                  <Edit2 size={12} /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(method.id)}
                  className="py-1 px-2.5 text-3xs flex items-center gap-1"
                >
                  <Trash2 size={12} /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SystemPaymentMethodsManager;
