import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Megaphone, 
  Upload, 
  Smartphone, 
  Trash2, 
  Ticket, 
  Percent, 
  Calendar, 
  ToggleLeft, 
  ToggleRight, 
  X, 
  Copy, 
  Check, 
  Sparkles, 
  Clock, 
  Package, 
  TrendingUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../../components/ui/Dialogs';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';

export const DashboardPromotions: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useDialog();
  const [activeTab, setActiveTab] = useState<'sponsored' | 'coupons'>('sponsored');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Data States
  const [promotions, setPromotions] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [adminLipa, setAdminLipa] = useState<any[]>([]);
  
  // Loading States
  const [initialLoading, setInitialLoading] = useState(true);

  // Sponsored Listing Form State
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product: '', title: '', description: '', duration_days: 7 });
  const [submitting, setSubmitting] = useState(false);
  const [refId, setRefId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Promo Code Form State
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '',
    discount_type: 'percentage',
    value: '',
    min_purchase_amount: '0',
    max_uses: '',
    end_date: ''
  });
  const [submittingPromo, setSubmittingPromo] = useState(false);

  // Fetch all data in parallel on initial load
  const loadAllData = async () => {
    try {
      const [sponsoredRes, promoRes, productsRes, lipaRes] = await Promise.allSettled([
        api.get('/api/sponsored/'),
        api.get('/api/promo-codes/'),
        api.get('/api/products/?mine=true'),
        api.get('/api/lipa-numbers/?seller=admin')
      ]);

      if (sponsoredRes.status === 'fulfilled') {
        setPromotions(sponsoredRes.value.data.results || sponsoredRes.value.data || []);
      }
      if (promoRes.status === 'fulfilled') {
        setPromoCodes(promoRes.value.data.results || promoRes.value.data || []);
      }
      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value.data.results || productsRes.value.data || []);
      }
      if (lipaRes.status === 'fulfilled') {
        const numbers = lipaRes.value.data.results || lipaRes.value.data || [];
        if (numbers.length > 0) {
          setAdminLipa(numbers);
        } else {
          api.get('/api/lipa-numbers/?is_system=true')
            .then(r => setAdminLipa(r.data.results || r.data || []))
            .catch(() => {});
        }
      }
    } catch {
      toast.error('Failed to load promotions data');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Quick refresh individual datasets silently
  const refreshPromotions = async () => {
    try {
      const res = await api.get('/api/sponsored/');
      setPromotions(res.data.results || res.data || []);
    } catch {}
  };

  const refreshPromoCodes = async () => {
    try {
      const res = await api.get('/api/promo-codes/');
      setPromoCodes(res.data.results || res.data || []);
    } catch {}
  };

  // KPIs
  const activeCampaignsCount = useMemo(() => promotions.filter(p => p.approved).length, [promotions]);
  const activeCouponsCount = useMemo(() => promoCodes.filter(c => c.is_active).length, [promoCodes]);
  const totalRedemptions = useMemo(() => promoCodes.reduce((sum, c) => sum + (c.use_count || 0), 0), [promoCodes]);

  // Form Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied "${code}" to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product) return toast.error('Please select a product');
    if (!refId) return toast.error('Please enter the transaction reference');
    if (!proofFile) return toast.error('Please upload your payment screenshot proof');

    setSubmitting(true);
    const fd = new FormData();
    fd.append('product', form.product);
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('duration_days', String(form.duration_days));
    fd.append('transaction_reference', refId);
    fd.append('payment_proof', proofFile);

    try {
      await api.post('/api/sponsored/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Promotion requested and payment submitted successfully!');
      setShowForm(false);
      setForm({ product: '', title: '', description: '', duration_days: 7 });
      setRefId('');
      setProofFile(null);
      refreshPromotions();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to submit promotion request');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPromoForm({ ...promoForm, [e.target.name]: e.target.value });
  };

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.code.trim()) return toast.error('Please enter a promo code');
    if (!promoForm.value) return toast.error('Please enter a discount value');

    setSubmittingPromo(true);
    try {
      const data: any = {
        code: promoForm.code.trim().toUpperCase(),
        discount_type: promoForm.discount_type,
        value: parseFloat(promoForm.value),
        min_purchase_amount: parseFloat(promoForm.min_purchase_amount || '0')
      };
      if (promoForm.max_uses) {
        data.max_uses = parseInt(promoForm.max_uses, 10);
      }
      if (promoForm.end_date) {
        data.end_date = new Date(promoForm.end_date).toISOString();
      }

      await api.post('/api/promo-codes/', data);
      toast.success('Promo code created successfully!');
      setShowPromoForm(false);
      setPromoForm({
        code: '',
        discount_type: 'percentage',
        value: '',
        min_purchase_amount: '0',
        max_uses: '',
        end_date: ''
      });
      refreshPromoCodes();
    } catch (err: any) {
      let detail = 'Failed to create promo code';
      if (err.response?.data) {
        const d = err.response.data;
        if (typeof d === 'object') {
          detail = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' | ');
        } else if (typeof d === 'string') {
          detail = d;
        }
      }
      toast.error(detail);
    } finally {
      setSubmittingPromo(false);
    }
  };

  const handleTogglePromoActive = async (id: number, currentActive: boolean) => {
    setPromoCodes(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentActive } : p));
    try {
      await api.patch(`/api/promo-codes/${id}/`, { is_active: !currentActive });
      toast.success(`Promo code ${!currentActive ? 'enabled' : 'disabled'} successfully.`);
    } catch {
      toast.error('Failed to update status.');
      refreshPromoCodes();
    }
  };

  const handleDeletePromo = async (id: number) => {
    const confirmed = await showConfirm(
      t('delete_promo_confirm', 'Are you sure you want to delete this promo code? This action cannot be undone.'),
      t('delete_promo_title', 'Delete Promo Code')
    );
    if (!confirmed) return;
    setPromoCodes(prev => prev.filter(p => p.id !== id));
    try {
      await api.delete(`/api/promo-codes/${id}/`);
      toast.success('Promo code deleted successfully.');
    } catch {
      toast.error('Failed to delete promo code.');
      refreshPromoCodes();
    }
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="text-brand-500" size={24} />
            Promotions & Campaigns
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Grow your sales using sponsored product ads or create promotional discount codes for your customers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'sponsored' ? (
            <Button
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="font-bold flex items-center gap-1.5"
            >
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? 'Close Form' : 'Request Ad Placement'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowPromoForm(!showPromoForm)}
              className="font-bold flex items-center gap-1.5"
            >
              {showPromoForm ? <X size={14} /> : <Plus size={14} />}
              {showPromoForm ? 'Close Form' : 'New Promo Code'}
            </Button>
          )}
        </div>
      </header>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Live Ad Campaigns</span>
            <div className="p-2 rounded-btn bg-emerald-500/10 text-emerald-500">
              <Megaphone size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">{activeCampaignsCount}</p>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Active Coupons</span>
            <div className="p-2 rounded-btn bg-brand-500/10 text-brand-500">
              <Ticket size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">{activeCouponsCount}</p>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Total Redemptions</span>
            <div className="p-2 rounded-btn bg-purple-500/10 text-purple-500">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">{totalRedemptions}</p>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Your Products</span>
            <div className="p-2 rounded-btn bg-blue-500/10 text-blue-500">
              <Package size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-gray-900 dark:text-white">{products.length}</p>
          </div>
        </div>
      </div>

      {/* Pill Tabs (0ms Instant Switch) */}
      <div data-horizontal-scroll="true" className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('sponsored')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'sponsored'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
              : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
          }`}
        >
          <Megaphone size={14} /> Sponsored Products
          <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black ${
            activeTab === 'sponsored' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-surface-border dark:bg-surface-dark-border text-gray-400'
          }`}>
            {promotions.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('coupons')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'coupons'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
              : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
          }`}
        >
          <Ticket size={14} /> Promo Codes
          <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black ${
            activeTab === 'coupons' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-surface-border dark:bg-surface-dark-border text-gray-400'
          }`}>
            {promoCodes.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Sponsored Products */}
      {activeTab === 'sponsored' && (
        <div className="space-y-6">
          {showForm && (
            <form onSubmit={handleSubmit} className="card p-5 space-y-4 animate-scale-in text-xs">
              <div className="border-b border-surface-border dark:border-surface-dark-border pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Create Sponsored Ad Campaign</h3>
                  <p className="text-2xs text-gray-400">Promote your product to the top of category feeds and search results</p>
                </div>
                <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Product to Promote *</label>
                  <select name="product" value={form.product} onChange={handleChange} required className="input py-2 text-xs w-full font-bold">
                    <option value="">-- Select Your Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (TSh {parseInt(p.price || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Duration & Pricing</label>
                  <select name="duration_days" value={form.duration_days} onChange={handleChange} required className="input py-2 text-xs w-full font-bold">
                    <option value={3}>3 Days - 3,000 TSh</option>
                    <option value={7}>7 Days - 7,000 TSh</option>
                    <option value={14}>14 Days - 14,000 TSh</option>
                    <option value={30}>30 Days - 30,000 TSh</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Campaign Headline / Title</label>
                <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. 20% Off Clearance Sale - Limited Stock!" className="input py-2 text-xs w-full" />
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Ad Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} placeholder="Write a catchy message for buyers..." rows={2} className="input py-2 text-xs w-full resize-none" />
              </div>

              {/* Payment Section */}
              <div className="pt-2 border-t border-surface-border dark:border-surface-dark-border space-y-3">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs">Payment Verification</h4>
                  <p className="text-2xs text-gray-400">
                    Send <strong className="text-brand-600 dark:text-brand-400 font-bold">TSh {(form.duration_days * 1000).toLocaleString()}</strong> to any official Lipa number below:
                  </p>
                </div>

                {adminLipa.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {adminLipa.map((lipa: any) => (
                      <div key={lipa.id} className="flex items-center gap-3 bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border rounded-btn p-2">
                        <div className={`rounded-lg bg-white dark:bg-[#121212] flex items-center justify-center overflow-hidden shrink-0 border border-surface-border dark:border-surface-dark-border ${lipa.network_logo ? 'w-12 h-6' : 'w-6 h-6'}`}>
                          {lipa.network_logo ? (
                            <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                          ) : (
                            <Smartphone size={14} className="text-emerald-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-3xs font-bold text-gray-400 uppercase leading-none">{lipa.network_name}</p>
                          <p className="font-mono font-extrabold text-gray-900 dark:text-white text-xs mt-0.5">{lipa.number}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleCopy(lipa.number)}
                          className="ml-auto btn-ghost text-3xs py-0.5 px-2 border border-surface-border dark:border-surface-dark-border rounded"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-surface-muted dark:bg-[#161616] rounded-btn text-2xs text-gray-500">
                    Pay via official platform merchant number and enter your transaction ID.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Transaction Reference ID *</label>
                    <input
                      type="text"
                      required
                      value={refId}
                      onChange={(e) => setRefId(e.target.value)}
                      placeholder="e.g. PP260618.1746"
                      className="input py-2 text-xs w-full font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Proof of Payment *</label>
                    <label className="flex items-center justify-center w-full h-9 border border-dashed border-surface-border dark:border-surface-dark-border rounded-btn cursor-pointer hover:bg-surface-muted/50 transition px-3">
                      <Upload size={14} className="text-gray-400 mr-2 shrink-0" />
                      <span className="text-2xs text-gray-500 dark:text-gray-400 truncate">
                        {proofFile ? proofFile.name : 'Upload Screenshot Proof'}
                      </span>
                      <input type="file" required className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting} className="font-bold">
                  {submitting ? 'Submitting...' : 'Submit Promotion Request'}
                </Button>
              </div>
            </form>
          )}

          {promotions.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No Active Ad Placements"
              description="Boost your listings to appear at the top of category feeds and search results."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {promotions.map((p: any) => (
                <div key={p.id} className="card p-4 hover:shadow-xs transition flex flex-col justify-between border-l-4 border-l-brand-500">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-3xs font-black px-2 py-0.5 rounded-full uppercase ${
                        p.approved 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {p.approved ? 'Live Active Ad' : 'Pending Review'}
                      </span>
                      <span className="text-3xs text-gray-400 font-medium">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-xs mb-1">
                      {p.title || `${p.product_name || 'Product'} Ad`}
                    </h4>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                      {p.description || 'Boosted category banner ad'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-surface-border dark:border-surface-dark-border flex items-center justify-between text-2xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {p.duration_days || 7} Days Duration
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      TSh {((p.duration_days || 7) * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Promo Codes */}
      {activeTab === 'coupons' && (
        <div className="space-y-6">
          {showPromoForm && (
            <form onSubmit={handlePromoSubmit} className="card p-5 space-y-4 animate-scale-in text-xs">
              <div className="border-b border-surface-border dark:border-surface-dark-border pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Create New Promo Code</h3>
                  <p className="text-2xs text-gray-400">Offer percentage or fixed discounts to your customers at checkout</p>
                </div>
                <button type="button" onClick={() => setShowPromoForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Ticket size={12} /> Promo Coupon Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    required
                    value={promoForm.code}
                    onChange={handlePromoChange}
                    placeholder="e.g. SUMMER25"
                    className="input py-2 text-xs w-full font-mono uppercase font-black tracking-wider"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Percent size={12} /> Discount Type
                  </label>
                  <select
                    name="discount_type"
                    value={promoForm.discount_type}
                    onChange={handlePromoChange}
                    className="input py-2 text-xs w-full font-bold"
                  >
                    <option value="percentage">Percentage Off (%)</option>
                    <option value="fixed">Fixed Amount Off (TZS)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Discount Value *</label>
                  <input
                    type="number"
                    name="value"
                    required
                    min="0.01"
                    step="any"
                    value={promoForm.value}
                    onChange={handlePromoChange}
                    placeholder={promoForm.discount_type === 'percentage' ? 'e.g. 15 (for 15% off)' : 'e.g. 5000 (for TSh 5,000 off)'}
                    className="input py-2 text-xs w-full"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Min Purchase Required (TZS)</label>
                  <input
                    type="number"
                    name="min_purchase_amount"
                    min="0"
                    step="any"
                    value={promoForm.min_purchase_amount}
                    onChange={handlePromoChange}
                    placeholder="e.g. 10000 (0 for none)"
                    className="input py-2 text-xs w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Max Usage Limit</label>
                  <input
                    type="number"
                    name="max_uses"
                    min="1"
                    value={promoForm.max_uses}
                    onChange={handlePromoChange}
                    placeholder="e.g. 50 (leave empty for unlimited)"
                    className="input py-2 text-xs w-full"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={12} /> Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={promoForm.end_date}
                    onChange={handlePromoChange}
                    className="input py-2 text-xs w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPromoForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submittingPromo} className="font-bold">
                  {submittingPromo ? 'Creating Code...' : 'Create Promo Code'}
                </Button>
              </div>
            </form>
          )}

          {promoCodes.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="No Promo Codes Created"
              description="Generate a discount code to start a campaign or offer customer loyalty rewards."
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                    <tr>
                      <th className="p-3">Coupon Code</th>
                      <th className="p-3">Discount</th>
                      <th className="p-3 text-right">Min Spend</th>
                      <th className="p-3 text-center">Uses</th>
                      <th className="p-3">Expiry</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {promoCodes.map((promo: any) => (
                      <tr key={promo.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-gray-900 dark:text-white text-xs bg-surface-muted dark:bg-[#161616] px-2 py-1 rounded-btn border border-surface-border dark:border-surface-dark-border">
                              {promo.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(promo.code)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
                              title="Copy code"
                            >
                              {copiedCode === promo.code ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </td>
                        <td className="p-3 font-extrabold text-brand-600 dark:text-brand-400">
                          {promo.discount_type === 'percentage'
                            ? `${parseFloat(promo.value)}% Off`
                            : `TSh ${parseInt(promo.value, 10).toLocaleString()} Off`}
                        </td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                          {parseFloat(promo.min_purchase_amount) > 0 ? `TSh ${parseFloat(promo.min_purchase_amount).toLocaleString()}` : 'None'}
                        </td>
                        <td className="p-3 text-center text-gray-500 dark:text-gray-400 font-bold">
                          {promo.use_count} / {promo.max_uses || '∞'}
                        </td>
                        <td className="p-3 text-gray-500 dark:text-gray-400">
                          {promo.end_date ? new Date(promo.end_date).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleTogglePromoActive(promo.id, promo.is_active)}
                            className="transition inline-flex cursor-pointer"
                            title={promo.is_active ? 'Deactivate code' : 'Activate code'}
                          >
                            {promo.is_active ? (
                              <ToggleRight size={28} className="text-brand-500" />
                            ) : (
                              <ToggleLeft size={28} className="text-gray-300 dark:text-gray-600" />
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeletePromo(promo.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                            title="Delete promo code"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPromotions;
