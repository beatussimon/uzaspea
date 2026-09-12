import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Search, Plus, Trash2, Edit3, CheckCircle2, XCircle,
  AlertTriangle, Check, RefreshCw, Sparkles, ShieldCheck,
  Building2, Lock
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';

interface ReservedUsernameItem {
  id: number;
  username: string;
  category: 'system' | 'staff_official' | 'brand_trademark' | 'vip_premium' | 'banned';
  category_display: string;
  reason: string;
  is_active: boolean;
  reserved_for: number | null;
  reserved_for_username: string | null;
  created_at: string;
  updated_at: string;
}

interface StatsData {
  total: number;
  active: number;
  inactive: number;
  by_category: Record<string, number>;
}

interface TestResult {
  candidate: string;
  canonical: string;
  available: boolean;
  detail: string;
  code: string;
  metadata?: Record<string, any>;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  brand_trademark: { label: 'Brand & Trademark', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800', icon: Building2 },
  staff_official: { label: 'Staff & Security', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800', icon: ShieldCheck },
  system: { label: 'System & Routing', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800', icon: Lock },
  vip_premium: { label: 'VIP & Premium Word', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800', icon: Sparkles },
  banned: { label: 'Banned / Offensive', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800', icon: AlertTriangle },
};

export const ReservedUsernamesManager: React.FC = () => {
  const [items, setItems] = useState<ReservedUsernameItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Interactive Sandbox
  const [testInput, setTestInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReservedUsernameItem | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    category: 'brand_trademark',
    reason: '',
    is_active: true,
    reserved_for_username: '',
  });
  const [saving, setSaving] = useState(false);

  // Fetch items & stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (statusFilter === 'active') params.is_active = 'true';
      if (statusFilter === 'inactive') params.is_active = 'false';
      if (search.trim()) params.search = search.trim();

      const [resItems, resStats] = await Promise.all([
        api.get('/api/staff-admin/reserved-usernames/', { params }),
        api.get('/api/staff-admin/reserved-usernames/stats/')
      ]);
      
      const results = Array.isArray(resItems.data) ? resItems.data : (resItems.data?.results || []);
      setItems(results);
      setStats(resStats.data);
    } catch (err: any) {
      toast.error('Failed to load reserved usernames');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, statusFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Run live test in sandbox
  const handleTestUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;
    setTesting(true);
    try {
      const res = await api.post('/api/staff-admin/reserved-usernames/test/', {
        username: testInput.trim()
      });
      setTestResult(res.data);
    } catch (err: any) {
      toast.error('Failed to test username');
    } finally {
      setTesting(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (item: ReservedUsernameItem) => {
    try {
      const res = await api.patch(`/api/staff-admin/reserved-usernames/${item.id}/`, {
        is_active: !item.is_active
      });
      setItems(prev => prev.map(i => i.id === item.id ? res.data : i));
      toast.success(`'${item.username}' is now ${!item.is_active ? 'Active' : 'Inactive'}`);
      // Refresh stats
      const statsRes = await api.get('/api/staff-admin/reserved-usernames/stats/');
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Failed to toggle status');
    }
  };

  // Delete item
  const handleDelete = async (item: ReservedUsernameItem) => {
    if (!window.confirm(`Are you sure you want to remove reservation for '${item.username}'?`)) return;
    try {
      await api.delete(`/api/staff-admin/reserved-usernames/${item.id}/`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(`Removed reservation for '${item.username}'`);
      const statsRes = await api.get('/api/staff-admin/reserved-usernames/stats/');
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  // Open modal for Create or Edit
  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      username: '',
      category: 'brand_trademark',
      reason: '',
      is_active: true,
      reserved_for_username: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (item: ReservedUsernameItem) => {
    setEditingItem(item);
    setFormData({
      username: item.username,
      category: item.category,
      reason: item.reason || '',
      is_active: item.is_active,
      reserved_for_username: item.reserved_for_username || '',
    });
    setModalOpen(true);
  };

  // Submit Modal Form
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      return toast.error('Username is required');
    }
    setSaving(true);
    try {
      if (editingItem) {
        // Update
        const res = await api.patch(`/api/staff-admin/reserved-usernames/${editingItem.id}/`, {
          category: formData.category,
          reason: formData.reason,
          is_active: formData.is_active,
        });
        setItems(prev => prev.map(i => i.id === editingItem.id ? res.data : i));
        toast.success(`Updated '${editingItem.username}'`);
      } else {
        // Create
        const res = await api.post('/api/staff-admin/reserved-usernames/', {
          username: formData.username.trim().toLowerCase(),
          category: formData.category,
          reason: formData.reason,
          is_active: formData.is_active,
        });
        setItems(prev => [res.data, ...prev]);
        toast.success(`Added reserved username '${res.data.username}'`);
      }
      setModalOpen(false);
      const statsRes = await api.get('/api/staff-admin/reserved-usernames/stats/');
      setStats(statsRes.data);
    } catch (err: any) {
      const msg = err.response?.data?.username?.[0] || err.response?.data?.detail || 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#0A0A0A] p-6 rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-500/10 text-brand-500">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Reserved Usernames Registry
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Protect core system routes, popular automotive/tech brands, and prevent staff impersonation.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2"
        >
          <Plus size={16} />
          Add Reserved Name
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Reserved</span>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            {stats?.total ?? '...'}
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">In database registry</span>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Active Enforcements</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats?.active ?? '...'}
          </div>
          <span className="text-[11px] text-emerald-600/80 mt-1 block">Blocking public registrations</span>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Brands & Trademarks</span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {stats?.by_category?.brand_trademark ?? 0}
          </div>
          <span className="text-[11px] text-purple-600/80 mt-1 block">OEMs, Parts, Telcos & Banks</span>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">VIP & Dictionary</span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats?.by_category?.vip_premium ?? 0}
          </div>
          <span className="text-[11px] text-amber-600/80 mt-1 block">High-value words e.g. "one"</span>
        </div>
      </div>

      {/* Interactive Sandbox: Test a Username */}
      <div className="bg-gradient-to-br from-gray-50 to-white dark:from-neutral-900/60 dark:to-[#0A0A0A] p-5 rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-brand-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Live Testing Sandbox
          </h2>
          <span className="text-xs text-gray-400">(Test any candidate handle against rules engine, leetspeak detection, & DB)</span>
        </div>

        <form onSubmit={handleTestUsername} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="e.g. t0y0ta, adm1n, one, my_spare_parts"
              className="w-full pl-3 pr-4 py-2.5 text-sm bg-white dark:bg-neutral-950 border border-surface-border dark:border-surface-dark-border rounded-btn focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <Button
            type="submit"
            disabled={testing || !testInput.trim()}
            variant="outline"
            className="shrink-0 flex items-center justify-center gap-2"
          >
            {testing ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            Evaluate Rule
          </Button>
        </form>

        {testResult && (
          <div className={`p-4 rounded-lg border text-sm transition-all ${
            testResult.available
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {testResult.available ? (
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <span>Candidate: <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">{testResult.candidate}</code></span>
                  <span>—</span>
                  <span>{testResult.available ? 'AVAILABLE' : 'BLOCKED / RESERVED'}</span>
                </div>
                <p className="text-xs opacity-90">{testResult.detail}</p>
                {testResult.metadata && (
                  <div className="text-[11px] opacity-75 mt-1 flex flex-wrap gap-2">
                    <span className="bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
                      Tier: <strong>{testResult.metadata.tier || 'none'}</strong>
                    </span>
                    {testResult.metadata.matched && (
                      <span className="bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
                        Triggered rule: <strong>{testResult.metadata.matched}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username, brand reason, or assigned user..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-surface-muted/30 dark:bg-neutral-900 border border-surface-border dark:border-surface-dark-border rounded-btn focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-surface-border dark:border-surface-dark-border rounded-btn focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-border dark:border-surface-dark-border">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              selectedCategory === 'all'
                ? 'bg-brand-500 text-white'
                : 'bg-surface-muted/50 dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-surface-muted'
            }`}
          >
            All ({stats?.total ?? 0})
          </button>
          {Object.entries(CATEGORY_LABELS).map(([catKey, config]) => {
            const count = stats?.by_category?.[catKey] ?? 0;
            const isSel = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${
                  isSel
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-muted/50 dark:bg-neutral-900 text-gray-600 dark:text-gray-400 hover:bg-surface-muted'
                }`}
              >
                <span>{config.label}</span>
                <span className="opacity-70 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reserved Usernames Table */}
      <div className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading reserved usernames...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ShieldAlert size={36} className="mx-auto text-gray-400 opacity-60" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">No reserved usernames found</h3>
            <p className="text-xs text-gray-500">Try adjusting your search or category filters, or add a new reserved handle.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted/30 dark:bg-neutral-900/50 text-xs font-semibold text-gray-500 uppercase border-b border-surface-border dark:border-surface-dark-border">
                <tr>
                  <th className="py-3 px-4">Reserved Username</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                {items.map((item) => {
                  const catConfig = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.brand_trademark;
                  const Icon = catConfig.icon;
                  return (
                    <tr key={item.id} className="hover:bg-surface-muted/20 dark:hover:bg-neutral-900/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-gray-900 dark:text-white bg-surface-muted/50 dark:bg-neutral-900 px-2 py-1 rounded text-xs border border-surface-border dark:border-surface-dark-border">
                          @{item.username}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${catConfig.bg} ${catConfig.color}`}>
                          <Icon size={12} />
                          {item.category_display || catConfig.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {item.reason || <span className="text-gray-400 italic">No notes</span>}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {item.reserved_for_username ? (
                          <span className="font-medium text-brand-500">
                            @{item.reserved_for_username}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Public block</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition ${
                            item.is_active
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-gray-500/10 text-gray-500 dark:text-gray-400 hover:bg-gray-500/20'
                          }`}
                          title="Click to toggle active enforcement"
                        >
                          {item.is_active ? <Check size={12} /> : <XCircle size={12} />}
                          {item.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-neutral-900 rounded"
                            title="Edit"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {editingItem ? `Edit Reserved Username: @${editingItem.username}` : 'Add Reserved Username'}
            </h3>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Username Handle *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">@</span>
                  <input
                    type="text"
                    disabled={!!editingItem}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. toyota, mpesa, admin_custom"
                    className="w-full pl-8 pr-4 py-2 text-sm bg-white dark:bg-neutral-950 border border-surface-border dark:border-surface-dark-border rounded-btn focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono disabled:opacity-50"
                    required
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Will be automatically lowercased. Must be 3-30 alphanumeric characters or underscores.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-950 border border-surface-border dark:border-surface-dark-border rounded-btn focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="brand_trademark">Brand & Trademark (Auto OEM, Parts, Telco, Bank)</option>
                  <option value="staff_official">Staff & Platform Security (Impersonation Defense)</option>
                  <option value="system">System & Routing (Vanity URL Protection)</option>
                  <option value="vip_premium">VIP & Premium Word (Short / Generic Words)</option>
                  <option value="banned">Banned / Inappropriate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g. Registered trademark of Toyota Motor Corporation"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-950 border border-surface-border dark:border-surface-dark-border rounded-btn focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="modal_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-brand-500 focus:ring-brand-500 h-4 w-4"
                />
                <label htmlFor="modal_is_active" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Enforce Active Reservation (prevent regular users from signing up with this name)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-surface-border dark:border-surface-dark-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : (editingItem ? 'Save Changes' : 'Create Reserved Name')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservedUsernamesManager;
