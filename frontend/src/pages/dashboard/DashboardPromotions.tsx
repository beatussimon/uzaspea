import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Plus, Megaphone, Upload, Smartphone, Trash2, Ticket, Percent, Calendar, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../../components/ui/Dialogs';

// ============ Dashboard Promotions ============
const DashboardPromotions: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useDialog();
  const [activeTab, setActiveTab] = useState<'sponsored' | 'coupons'>('sponsored');

  // Sponsored Listing State
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product: '', title: '', description: '', duration_days: 7 });
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Sponsored Payment State
  const [refId, setRefId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [adminLipa, setAdminLipa] = useState<any[]>([]);
  const [loadingLipa, setLoadingLipa] = useState(false);

  // Promo Code State
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [loadingPromo, setLoadingPromo] = useState(false);
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

  // Fetch functions
  const fetchPromotions = () => {
    setLoading(true);
    api.get('/api/sponsored/')
      .then(res => setPromotions(res.data.results || res.data))
      .catch(() => toast.error('Failed to load promotions'))
      .finally(() => setLoading(false));
  };

  const fetchPromoCodes = () => {
    setLoadingPromo(true);
    api.get('/api/promo-codes/')
      .then(res => setPromoCodes(res.data.results || res.data))
      .catch(() => toast.error('Failed to load promo codes'))
      .finally(() => setLoadingPromo(false));
  };

  useEffect(() => {
    api.get('/api/products/').then(res => setProducts(res.data.results || res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'sponsored') {
      fetchPromotions();
    } else {
      fetchPromoCodes();
    }
  }, [activeTab]);

  useEffect(() => {
    if (showForm) {
      setLoadingLipa(true);
      api.get('/api/lipa-numbers/?is_system=true&purpose=subscriptions') // or general system numbers
        .then(res => {
          let numbers = res.data.results || res.data || [];
          if (numbers.length === 0) {
            return api.get('/api/lipa-numbers/?is_system=true&purpose=general').then(r => r.data.results || r.data || []);
          }
          return numbers;
        })
        .then(numbers => setAdminLipa(numbers))
        .catch(() => {})
        .finally(() => setLoadingLipa(false));
    }
  }, [showForm]);

  // Sponsored listing handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
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
      fetchPromotions();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to submit promotion request');
    } finally {
      setSubmitting(false);
    }
  };

  // Promo Code handlers
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
      fetchPromoCodes();
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
    try {
      await api.patch(`/api/promo-codes/${id}/`, { is_active: !currentActive });
      toast.success(`Promo code ${!currentActive ? 'enabled' : 'disabled'} successfully.`);
      fetchPromoCodes();
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const handleDeletePromo = async (id: number) => {
    const confirmed = await showConfirm(
      t('delete_promo_confirm', 'Are you sure you want to delete this promo code? This action cannot be undone.'),
      t('delete_promo_title', 'Delete Promo Code')
    );
    if (!confirmed) return;
    try {
      await api.delete(`/api/promo-codes/${id}/`);
      toast.success('Promo code deleted successfully.');
      fetchPromoCodes();
    } catch {
      toast.error('Failed to delete promo code.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Megaphone className="text-brand-600" size={24} /> Promotions & Campaigns
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Grow your sales using sponsored product ads or create promotional discount codes.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('sponsored')}
            className={`py-3.5 border-b-2 text-sm font-bold transition-all ${
              activeTab === 'sponsored'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Sponsored Products
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`py-3.5 border-b-2 text-sm font-bold transition-all ${
              activeTab === 'coupons'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Promo Codes
          </button>
        </nav>

        {activeTab === 'sponsored' ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition text-xs font-bold shadow-sm"
          >
            <Plus size={14} />
            {showForm ? 'Cancel' : 'Request Ad Placement'}
          </button>
        ) : (
          <button
            onClick={() => setShowPromoForm(!showPromoForm)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition text-xs font-bold shadow-sm"
          >
            <Plus size={14} />
            {showPromoForm ? 'Cancel' : 'New Promo Code'}
          </button>
        )}
      </div>

      {/* Sponsored Products Tab */}
      {activeTab === 'sponsored' && (
        <div className="space-y-6">
          {showForm && (
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Product to Promote</label>
                <select name="product" value={form.product} onChange={handleChange} required className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Campaign Title</label>
                <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. 20% Off Clearance Sale" className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Ad Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} placeholder="Write a catchy line for buyers..." rows={2} className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Duration & Pricing</label>
                <select name="duration_days" value={form.duration_days} onChange={handleChange} required className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500">
                  <option value={3}>3 Days - 3,000 TSh</option>
                  <option value={7}>7 Days - 7,000 TSh</option>
                  <option value={14}>14 Days - 14,000 TSh</option>
                  <option value={30}>30 Days - 30,000 TSh</option>
                </select>
              </div>

              <div className="bg-brand-50 dark:bg-brand-900/20 p-3 rounded-lg border border-brand-100 dark:border-brand-900/30">
                <p className="text-sm font-bold text-brand-800 dark:text-brand-300">
                  Total Cost: {(Number(form.duration_days) * 1000).toLocaleString()} TSh
                </p>
                <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
                  Transfer the amount to one of our mobile numbers below to complete the request.
                </p>
              </div>

              {loadingLipa ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Pay to these numbers:</p>
                  {adminLipa.length === 0 ? (
                    <p className="text-xs text-yellow-600">No official payment numbers configured. Please contact support.</p>
                  ) : (
                    <div className="space-y-2">
                      {adminLipa.map((lipa: any) => (
                        <div key={lipa.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5">
                          <div className={`rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 ${lipa.network?.image ? 'w-16 h-8' : 'w-8 h-8'}`}>
                            {lipa.network?.image ? (
                              <img src={lipa.network.image} alt={lipa.network.name} className="w-full h-full object-contain" />
                            ) : (
                              <Smartphone size={16} className="text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">{lipa.network?.name}</p>
                            <p className="font-mono font-black text-gray-900 dark:text-white text-xs mt-0.5">{lipa.number}</p>
                            <p className="text-[10px] text-gray-500 leading-none">{lipa.name}</p>
                          </div>
                          <button type="button" onClick={() => { navigator.clipboard.writeText(lipa.number); toast.success('Copied!'); }}
                              className="ml-auto btn-ghost text-[10px] py-0.5 px-1.5 border border-gray-300 dark:border-gray-600 rounded">Copy</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Transaction ID / Reference</label>
                  <input type="text" required value={refId} onChange={(e) => setRefId(e.target.value)} placeholder="e.g. PP260618.1746" className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Receipt Screenshot (Required)</label>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                    <div className="flex flex-col items-center justify-center pt-3 pb-4">
                      <Upload size={20} className="text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-4">
                        {proofFile ? proofFile.name : 'Click to upload screenshot proof'}
                      </p>
                    </div>
                    <input type="file" required className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold rounded-lg transition font-bold shadow-md">
                {submitting ? 'Submitting...' : 'Submit Promotion Request'}
              </button>
            </form>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
          ) : promotions.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
              <Megaphone size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3 animate-pulse" />
              <p className="text-gray-500 font-medium">No active ad placements. Boost your listings now!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promotions.map((p: any) => (
                <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 border-l-4 border-l-brand-600 shadow-sm animate-fade-in">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${p.approved ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {p.approved ? 'Live' : 'Pending Verification'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{p.title || `${p.product_name || 'Product'} Ad`}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{p.description || 'No description provided.'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Promo Codes Tab */}
      {activeTab === 'coupons' && (
        <div className="space-y-6">
          {showPromoForm && (
            <form onSubmit={handlePromoSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1"><Ticket size={12} /> Promo Code (Alphanumeric)</label>
                  <input
                    type="text"
                    name="code"
                    required
                    value={promoForm.code}
                    onChange={handlePromoChange}
                    placeholder="e.g. INFLUENCER20"
                    className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-mono uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1"><Percent size={12} /> Discount Type</label>
                  <select
                    name="discount_type"
                    value={promoForm.discount_type}
                    onChange={handlePromoChange}
                    className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (TZS)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Discount Value</label>
                  <input
                    type="number"
                    name="value"
                    required
                    min="0.01"
                    step="any"
                    value={promoForm.value}
                    onChange={handlePromoChange}
                    placeholder={promoForm.discount_type === 'percentage' ? 'e.g. 15 (for 15%)' : 'e.g. 5000 (for TSh 5,000)'}
                    className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Min Purchase Spend (TZS)</label>
                  <input
                    type="number"
                    name="min_purchase_amount"
                    min="0"
                    step="any"
                    value={promoForm.min_purchase_amount}
                    onChange={handlePromoChange}
                    placeholder="e.g. 10000 (0 for none)"
                    className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Max Usage Limit (Optional)</label>
                  <input
                    type="number"
                    name="max_uses"
                    min="1"
                    value={promoForm.max_uses}
                    onChange={handlePromoChange}
                    placeholder="e.g. 100 (blank for unlimited)"
                    className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1"><Calendar size={12} /> Expiration Date (Optional)</label>
                  <input
                    type="date"
                    name="end_date"
                    value={promoForm.end_date}
                    onChange={handlePromoChange}
                    className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <button type="submit" disabled={submittingPromo} className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-bold rounded-lg transition shadow-md shadow-brand-600/10">
                {submittingPromo ? 'Creating Promo...' : 'Create Promo Code'}
              </button>
            </form>
          )}

          {loadingPromo ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
          ) : promoCodes.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
              <Ticket size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3 animate-pulse" />
              <p className="text-gray-500 font-medium">No promo codes created yet.</p>
              <p className="text-xs text-gray-400 mt-1">Generate a code to start a social media campaign or offer customer loyalty discounts!</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">
                      <th className="p-4">Code</th>
                      <th className="p-4">Discount</th>
                      <th className="p-4 text-right">Min Spend</th>
                      <th className="p-4 text-center">Usage Count</th>
                      <th className="p-4">Expiry</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {promoCodes.map((promo: any) => (
                      <tr key={promo.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                        <td className="p-4 font-mono font-black text-gray-900 dark:text-white text-sm">
                          {promo.code}
                        </td>
                        <td className="p-4 font-bold text-brand-600 dark:text-brand-400">
                          {promo.discount_type === 'percentage'
                            ? `${parseFloat(promo.value)}% Off`
                            : `TSh ${parseInt(promo.value, 10).toLocaleString()} Off`}
                        </td>
                        <td className="p-4 text-right text-gray-600 dark:text-gray-300 font-medium">
                          TSh {parseFloat(promo.min_purchase_amount).toLocaleString()}
                        </td>
                        <td className="p-4 text-center text-gray-500 dark:text-gray-400 font-bold">
                          {promo.use_count} / {promo.max_uses || '∞'}
                        </td>
                        <td className="p-4 text-gray-500 dark:text-gray-400">
                          {promo.end_date ? new Date(promo.end_date).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleTogglePromoActive(promo.id, promo.is_active)}
                            className="transition inline-flex"
                            title={promo.is_active ? 'Deactivate code' : 'Activate code'}
                          >
                            {promo.is_active ? (
                              <ToggleRight size={32} className="text-brand-600" />
                            ) : (
                              <ToggleLeft size={32} className="text-gray-300 dark:text-gray-600" />
                            )}
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeletePromo(promo.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition"
                            title="Delete promo code"
                          >
                            <Trash2 size={16} />
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
