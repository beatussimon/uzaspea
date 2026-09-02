import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
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
  Clock, 
  Package, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Eye,
  Tag,
  ArrowUpRight,
  Info,
  ChevronLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../../components/ui/Dialogs';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { KpiCard } from '../../components/ui/KpiCard';
import SafeImage from '../../components/SafeImage';
import { KpiGridSkeleton, TableSkeleton, CardGridSkeleton } from '../../components/Skeleton';

interface BoostPlan {
  days: number;
  label: string;
  price: number;
  badge?: string;
  description: string;
  popular?: boolean;
}

const BOOST_PLANS: BoostPlan[] = [
  { 
    days: 3, 
    label: '3 Days', 
    price: 3000, 
    description: 'Short-term feature for quick stock clearance or flash deals.' 
  },
  { 
    days: 7, 
    label: '7 Days', 
    price: 7000, 
    popular: true, 
    badge: 'Popular', 
    description: 'One full week of priority placement in search and category feeds.' 
  },
  { 
    days: 14, 
    label: '14 Days', 
    price: 14000, 
    description: 'Two weeks of sustained visibility across category listings.' 
  },
  { 
    days: 30, 
    label: '30 Days', 
    price: 30000, 
    badge: 'Monthly', 
    description: 'Full monthly featured placement for high-value inventory.' 
  },
];

export const DashboardPromotions: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showConfirm } = useDialog();
  const formRef = useRef<HTMLFormElement>(null);

  const [activeTab, setActiveTab] = useState<'sponsored' | 'coupons'>('sponsored');
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'approved' | 'pending' | 'expired' | 'rejected'>('all');
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
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

  // Live timestamp ticker (ticks every 10 seconds)
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTimestamp(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all initial data
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
      toast.error(t('failed_to_load_promotions', 'Failed to load promotions data'));
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle URL query parameters (?tab=sponsored|coupons, ?new=true, ?product=<id>)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const newParam = params.get('new');
    const prodParam = params.get('product');

    if (tabParam === 'coupons') {
      setActiveTab('coupons');
    } else if (tabParam === 'sponsored') {
      setActiveTab('sponsored');
    }

    if (newParam === 'true') {
      setShowForm(true);
      if (prodParam) {
        setForm(prev => ({ ...prev, product: prodParam }));
      }
    }
  }, [location.search]);

  // Silent refresh helpers
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

  // Determine current lifecycle status of a sponsored listing
  const getCampaignStatus = (p: any): 'approved' | 'pending' | 'rejected' | 'expired' => {
    if (p.status === 'rejected') return 'rejected';
    if (p.status === 'pending') return 'pending';
    if (p.status === 'expired') return 'expired';
    if (p.status === 'approved') {
      if (p.expires_at) {
        const exp = new Date(p.expires_at).getTime();
        if (exp <= nowTimestamp) return 'expired';
      }
      return 'approved';
    }
    return p.status || 'pending';
  };

  // KPIs
  const activeCampaignsCount = useMemo(() => {
    return promotions.filter(p => getCampaignStatus(p) === 'approved').length;
  }, [promotions, nowTimestamp]);

  const pendingCampaignsCount = useMemo(() => {
    return promotions.filter(p => getCampaignStatus(p) === 'pending').length;
  }, [promotions]);

  const activeCouponsCount = useMemo(() => promoCodes.filter(c => c.is_active).length, [promoCodes]);
  const totalRedemptions = useMemo(() => promoCodes.reduce((sum, c) => sum + (c.use_count || 0), 0), [promoCodes]);

  // Filtered campaigns
  const filteredPromotions = useMemo(() => {
    if (campaignFilter === 'all') return promotions;
    return promotions.filter(p => getCampaignStatus(p) === campaignFilter);
  }, [promotions, campaignFilter, nowTimestamp]);

  // Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('file_too_large', 'File size exceeds 5MB. Please upload a smaller image.'));
        return;
      }
      setProofFile(file);
      const url = URL.createObjectURL(file);
      setProofPreview(url);
    } else {
      setProofFile(null);
      setProofPreview(null);
    }
  };

  const handleClearProof = () => {
    setProofFile(null);
    setProofPreview(null);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(t('copied_to_clipboard', `Copied "${code}" to clipboard`));
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleStartReboost = (productId: number | string) => {
    setForm({
      product: String(productId),
      title: '',
      description: '',
      duration_days: 7
    });
    setRefId('');
    setProofFile(null);
    setProofPreview(null);
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleDeleteCampaign = async (id: number) => {
    const confirmed = await showConfirm(
      t('delete_campaign_confirm', 'Are you sure you want to cancel this promotion request?'),
      t('delete_campaign_title', 'Cancel Promotion')
    );
    if (!confirmed) return;
    try {
      await api.delete(`/api/sponsored/${id}/`);
      toast.success(t('promotion_removed', 'Promotion request removed'));
      refreshPromotions();
    } catch {
      toast.error(t('failed_to_remove_promotion', 'Failed to remove promotion request'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product) {
      toast.error(t('select_product_required', 'Please select a product from your inventory'));
      return;
    }
    const cleanRef = refId.trim().toUpperCase();
    if (!cleanRef || cleanRef.length < 3) {
      toast.error(t('enter_valid_txn_ref', 'Please enter a valid payment transaction reference'));
      return;
    }
    if (!proofFile) {
      toast.error(t('upload_proof_required', 'Please upload your payment screenshot receipt'));
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append('product', form.product);
    fd.append('title', form.title.trim());
    fd.append('description', form.description.trim());
    fd.append('duration_days', String(form.duration_days));
    fd.append('transaction_reference', cleanRef);
    fd.append('payment_proof', proofFile);

    try {
      await api.post('/api/sponsored/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(t('promotion_submitted_success', 'Promotion request submitted. Staff will review and activate your placement.'));
      setShowForm(false);
      setForm({ product: '', title: '', description: '', duration_days: 7 });
      setRefId('');
      setProofFile(null);
      setProofPreview(null);
      refreshPromotions();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('submission_failed', 'Failed to submit promotion request'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPromoForm({ ...promoForm, [e.target.name]: e.target.value });
  };

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoForm.code.trim().toUpperCase();
    if (!cleanCode) {
      toast.error(t('enter_promo_code', 'Please enter a coupon code'));
      return;
    }
    if (!promoForm.value || parseFloat(promoForm.value) <= 0) {
      toast.error(t('enter_valid_discount', 'Please enter a valid discount amount'));
      return;
    }

    setSubmittingPromo(true);
    try {
      const data: any = {
        code: cleanCode,
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
      toast.success(t('promo_created_success', 'Promo code created successfully'));
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
      let detail = t('failed_to_create_promo', 'Failed to create promo code');
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
      toast.success(t('promo_status_updated', `Promo code ${!currentActive ? 'enabled' : 'disabled'}`));
    } catch {
      toast.error(t('failed_to_update_status', 'Failed to update promo status'));
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
      toast.success(t('promo_deleted', 'Promo code deleted'));
    } catch {
      toast.error(t('failed_to_delete_promo', 'Failed to delete promo code'));
      refreshPromoCodes();
    }
  };

  // Format remaining time cleanly
  const formatTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - nowTimestamp;
    if (diff <= 0) return t('expired', 'Expired');

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h ${t('remaining', 'left')}`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m ${t('remaining', 'left')}`;
    }
    return `${mins}m ${t('remaining', 'left')}`;
  };

  // Calculate elapsed progress percentage
  const calculateProgress = (createdAt: string, expiresAt: string | null) => {
    if (!expiresAt) return 0;
    const start = new Date(createdAt).getTime();
    const end = new Date(expiresAt).getTime();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = nowTimestamp - start;
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    return Math.round(pct);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition -ml-1.5 p-0.5 rounded-lg inline-flex items-center"
              title="Back"
            >
              <ChevronLeft size={22} />
            </button>
            <span>{t('promotions', 'Promotions')}</span>
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'sponsored' ? (
              <Button
                size="sm"
                onClick={() => setShowForm(!showForm)}
                className="font-semibold whitespace-nowrap flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-black shadow-xs text-xs px-3 py-1.5 shrink-0"
              >
                {showForm ? <X size={14} /> : <Plus size={14} />}
                {showForm ? t('close', 'Close') : t('new_promotion', 'New Promotion')}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowPromoForm(!showPromoForm)}
                className="font-semibold whitespace-nowrap flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-black shadow-xs text-xs px-3 py-1.5 shrink-0"
              >
                {showPromoForm ? <X size={14} /> : <Plus size={14} />}
                {showPromoForm ? t('close', 'Close') : t('new_coupon', 'New Coupon')}
              </Button>
            )}
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
          {t('promotions_subtitle', 'Manage sponsored product placements and store coupons.')}
        </p>
      </header>

      {/* KPI Metrics Row */}
      {initialLoading ? (
        <KpiGridSkeleton count={4} cols={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label={t('active_placements', 'Active Placements')}
            value={activeCampaignsCount}
            sub={pendingCampaignsCount > 0 ? `${pendingCampaignsCount} ${t('pending', 'pending review')}` : undefined}
            icon={Megaphone}
          />
          <KpiCard
            label={t('active_coupons', 'Active Coupons')}
            value={activeCouponsCount}
            icon={Ticket}
          />
          <KpiCard
            label={t('total_redemptions', 'Coupon Uses')}
            value={totalRedemptions}
            icon={TrendingUp}
          />
          <KpiCard
            label={t('total_inventory', 'Store Products')}
            value={products.length}
            icon={Package}
          />
        </div>
      )}

      {/* Main Tab Bar */}
      <div className="flex items-center gap-2 border-b border-surface-border dark:border-surface-dark-border pb-3 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('sponsored')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'sponsored'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-surface-muted dark:bg-neutral-900 border border-surface-border dark:border-surface-dark-border'
          }`}
        >
          <Megaphone size={13} className="shrink-0" />
          <span className="whitespace-nowrap">{t('sponsored_listings', 'Sponsored Products')}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
            activeTab === 'sponsored' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
          }`}>
            {promotions.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('coupons')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'coupons'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-surface-muted dark:bg-neutral-900 border border-surface-border dark:border-surface-dark-border'
          }`}
        >
          <Ticket size={13} className="shrink-0" />
          <span className="whitespace-nowrap">{t('promo_coupons', 'Promo Codes')}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
            activeTab === 'coupons' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
          }`}>
            {promoCodes.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Sponsored Listings */}
      {activeTab === 'sponsored' && (
        <div className="space-y-6">
          {/* Creation Form */}
          {showForm && (
            <form 
              ref={formRef} 
              onSubmit={handleSubmit} 
              className="card p-5 space-y-4 animate-scale-in text-xs border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A]"
            >
              <div className="border-b border-surface-border dark:border-surface-dark-border pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {t('create_sponsored_listing', 'Create Sponsored Listing')}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('sponsored_form_desc', 'Feature your product with priority placement in search and category feeds.')}
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('select_product_to_promote', 'Select Product *')}
                </label>
                {products.length === 0 ? (
                  <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                    <div className="flex items-center gap-2">
                      <Info size={15} className="shrink-0" />
                      <span>{t('no_products_yet', 'You do not have any active products listed yet.')}</span>
                    </div>
                    <Link to="/dashboard/products" className="font-semibold underline flex items-center gap-1">
                      {t('add_product_first', 'Add Product First')} <ArrowUpRight size={12} />
                    </Link>
                  </div>
                ) : (
                  <select 
                    name="product" 
                    value={form.product} 
                    onChange={handleChange} 
                    required 
                    className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
                  >
                    <option value="">-- {t('choose_from_inventory', 'Choose from your listed inventory')} --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — TSh {parseInt(p.price || 0).toLocaleString()} ({p.condition || 'Used'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tiered Duration Package Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('choose_duration_plan', 'Placement Duration & Rate *')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {BOOST_PLANS.map(plan => {
                    const isSelected = Number(form.duration_days) === plan.days;
                    return (
                      <div
                        key={plan.days}
                        onClick={() => setForm({ ...form, duration_days: plan.days })}
                        className={`relative rounded-card p-3 border cursor-pointer transition-colors flex flex-col justify-between ${
                          isSelected
                            ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500'
                            : 'border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#121212] hover:border-neutral-400 dark:hover:border-neutral-700'
                        }`}
                      >
                        {plan.badge && (
                          <span className={`absolute -top-2 right-2.5 px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase tracking-wider ${
                            plan.popular 
                              ? 'bg-brand-500 text-black' 
                              : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                          }`}>
                            {plan.badge}
                          </span>
                        )}
                        <div>
                          <p className="font-semibold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                            <Clock size={12} className={isSelected ? 'text-brand-500' : 'text-gray-400'} />
                            {plan.days} {t('days', 'Days')}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                            {plan.description}
                          </p>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-surface-border dark:border-surface-dark-border/60 flex items-baseline justify-between">
                          <span className="text-[10px] text-gray-400 uppercase font-medium">{t('rate', 'Rate')}</span>
                          <span className="font-semibold font-mono text-xs text-gray-900 dark:text-white">
                            TSh {plan.price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Customization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('headline_optional', 'Campaign Headline (Optional)')}
                  </label>
                  <input 
                    name="title" 
                    value={form.title} 
                    onChange={handleChange} 
                    placeholder="e.g. Genuine OEM Quality • Limited Stock Available" 
                    className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('pitch_optional', 'Pitch / Highlight (Optional)')}
                  </label>
                  <input 
                    name="description" 
                    value={form.description} 
                    onChange={handleChange} 
                    placeholder="e.g. Fast delivery in Dar es Salaam. Guaranteed fitment." 
                    className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border" 
                  />
                </div>
              </div>

              {/* Payment Verification Box */}
              <div className="pt-3 border-t border-surface-border/40 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white text-xs flex items-center gap-1.5">
                      <Smartphone size={13} className="text-emerald-500" />
                      {t('payment_verification', 'Payment Verification')}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('send_exact_amount', 'Send exactly')}{' '}
                      <strong className="text-brand-600 dark:text-brand-400 font-semibold">
                        TSh {(Number(form.duration_days) * 1000).toLocaleString()}
                      </strong>{' '}
                      {t('to_official_number', 'to an official platform merchant number below:')}
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">
                    TSh {(Number(form.duration_days) * 1000).toLocaleString()}
                  </div>
                </div>

                {adminLipa.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {adminLipa.map((lipa: any) => (
                      <div key={lipa.id} className="flex items-center gap-2.5 bg-white dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border rounded p-2">
                        <div className={`rounded bg-surface-muted dark:bg-[#121212] flex items-center justify-center overflow-hidden shrink-0 border border-surface-border dark:border-surface-dark-border ${lipa.network_logo ? 'w-10 h-5' : 'w-5 h-5'}`}>
                          {lipa.network_logo ? (
                            <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                          ) : (
                            <Smartphone size={12} className="text-emerald-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-gray-400 uppercase leading-none font-medium">{lipa.network_name}</p>
                          <p className="font-mono font-bold text-gray-900 dark:text-white text-xs mt-0.5">{lipa.number}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleCopy(lipa.number)}
                          className="text-[10px] py-1 px-2 border border-surface-border dark:border-surface-dark-border rounded hover:border-brand-500 transition cursor-pointer text-gray-600 dark:text-gray-300"
                        >
                          {copiedCode === lipa.number ? <Check size={11} className="text-emerald-500" /> : t('copy', 'Copy')}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 bg-white dark:bg-[#161616] rounded text-xs text-gray-500">
                    {t('pay_via_admin_number', 'Pay via the official platform merchant Lipa number and input your transaction code.')}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('transaction_ref_code', 'Transaction Reference Code *')}
                    </label>
                    <input
                      type="text"
                      required
                      value={refId}
                      onChange={(e) => setRefId(e.target.value)}
                      placeholder="e.g. PP260618.1746 or MPESA / TIGO REF"
                      className="input py-2 text-xs w-full font-mono uppercase bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('payment_receipt_proof', 'Payment Receipt Screenshot *')}
                    </label>
                    {proofPreview ? (
                      <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-[#121212] border border-surface-border dark:border-surface-dark-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={proofPreview} alt="Receipt preview" className="w-6 h-6 object-cover rounded shrink-0 border" />
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate font-mono">
                            {proofFile?.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearProof}
                          className="p-1 text-gray-400 hover:text-red-500 transition cursor-pointer"
                          title={t('remove_receipt', 'Remove receipt')}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-between w-full h-9 border border-dashed border-surface-border dark:border-surface-dark-border rounded cursor-pointer bg-white dark:bg-[#121212] hover:border-neutral-400 dark:hover:border-neutral-600 transition px-3">
                        <div className="flex items-center gap-2 truncate">
                          <Upload size={13} className="text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {t('upload_receipt_screenshot', 'Upload payment receipt screenshot')}
                          </span>
                        </div>
                        <input type="file" required className="hidden" accept="image/*" onChange={handleProofChange} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  {t('cancel', 'Cancel')}
                </Button>
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={submitting} 
                  className="font-semibold bg-brand-500 hover:bg-brand-600 text-black shadow-xs"
                >
                  {submitting ? t('submitting', 'Submitting...') : t('submit_request', 'Submit Request')}
                </Button>
              </div>
            </form>
          )}

          {/* Campaign Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div data-horizontal-scroll="true" className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(['all', 'approved', 'pending', 'expired', 'rejected'] as const).map(f => {
                const count = f === 'all' 
                  ? promotions.length 
                  : promotions.filter(p => getCampaignStatus(p) === f).length;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setCampaignFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      campaignFilter === f
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-surface-muted dark:bg-[#121212] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                    }`}
                  >
                    {f === 'all' && t('all_campaigns', 'All Placements')}
                    {f === 'approved' && t('live_active', 'Active')}
                    {f === 'pending' && t('pending_review', 'Under Review')}
                    {f === 'expired' && t('completed', 'Completed')}
                    {f === 'rejected' && t('rejected', 'Rejected')}
                    <span className="opacity-60 text-[11px]">({count})</span>
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshPromotions}
              className="text-xs py-1 px-2.5 h-7 flex items-center gap-1 border-surface-border dark:border-surface-dark-border"
              title={t('refresh', 'Refresh')}
            >
              <RefreshCw size={11} /> {t('refresh', 'Refresh')}
            </Button>
          </div>

          {/* Campaign List Grid */}
          {initialLoading ? (
            <CardGridSkeleton count={3} cols={3} />
          ) : filteredPromotions.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title={campaignFilter === 'all' ? t('no_promotions_title', "No Sponsored Placements") : `${t('no_campaigns_status', 'No')} ${campaignFilter} ${t('placements', 'placements')}`}
              description={t('no_promotions_desc', 'Promote your inventory to appear at the top of category feeds and search results across Tanzania.')}
              action={{
                label: t('create_first_boost', 'Promote a Product'),
                onClick: () => setShowForm(true)
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPromotions.map((p: any) => {
                const status = getCampaignStatus(p);
                const timeRemaining = formatTimeRemaining(p.expires_at);
                const progress = calculateProgress(p.created_at, p.expires_at);
                const product = p.product_details || {};
                const productImg = product.images?.[0]?.image || null;

                return (
                  <div 
                    key={p.id} 
                    className="card p-4 flex flex-col justify-between bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border hover:border-neutral-400 dark:hover:border-neutral-700 transition-colors"
                  >
                    <div>
                      {/* Top Status & Date */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        {status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {t('active', 'Active')}
                          </span>
                        )}
                        {status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock size={11} />
                            {t('under_review', 'Under Review')}
                          </span>
                        )}
                        {status === 'expired' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                            <CheckCircle2 size={11} />
                            {t('completed', 'Completed')}
                          </span>
                        )}
                        {status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                            <AlertCircle size={11} />
                            {t('rejected', 'Rejected')}
                          </span>
                        )}

                        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-normal">
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Product Snippet Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800 border border-surface-border/40">
                          {productImg ? (
                            <SafeImage src={productImg} alt={p.product_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Package size={16} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-xs truncate">
                            {p.product_name || 'Product'}
                          </h4>
                          <p className="font-mono text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">
                            {product.price ? `TSh ${parseInt(product.price).toLocaleString()}` : ''}
                          </p>
                        </div>
                        {p.product_slug && (
                          <a
                            href={`/product/${p.product_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                            title={t('view_product_page', 'View Product Page')}
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>

                      {/* Campaign Title & Description */}
                      {p.title && (
                        <h5 className="font-medium text-gray-900 dark:text-white text-xs mb-0.5">
                          {p.title}
                        </h5>
                      )}
                      {p.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                          {p.description}
                        </p>
                      )}

                      {/* Rejection Note if Rejected */}
                      {status === 'rejected' && p.admin_notes && (
                        <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs mb-3 space-y-0.5">
                          <p className="font-medium text-[11px] uppercase tracking-wider">
                            {t('rejection_reason', 'Staff Note:')}
                          </p>
                          <p className="leading-relaxed">{p.admin_notes}</p>
                        </div>
                      )}

                      {/* Active Timeline & Countdown */}
                      {status === 'approved' && p.expires_at && (
                        <div className="mb-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400">
                              {t('time_remaining', 'Time Remaining')}:
                            </span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                              {timeRemaining}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1 rounded-full overflow-hidden">
                            <div 
                              className="bg-brand-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-400">
                            <span>{t('expires', 'Expires')} {new Date(p.expires_at).toLocaleDateString()}</span>
                            <span>{progress}% {t('elapsed', 'elapsed')}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer & Actions */}
                    <div className="pt-3 border-t border-surface-border dark:border-surface-dark-border space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1 font-normal">
                          <Tag size={11} /> {p.duration_days || 7} {t('days_duration', 'Days')}
                        </div>
                        <div className="font-mono font-medium text-gray-900 dark:text-white">
                          TSh {((p.duration_days || 7) * 1000).toLocaleString()}
                        </div>
                      </div>

                      {p.transaction_reference && (
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span className="font-mono">Ref: {p.transaction_reference}</span>
                          {p.payment_proof && (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(p.payment_proof)}
                              className="text-brand-600 dark:text-brand-400 hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                            >
                              <Eye size={11} /> {t('view_proof', 'Receipt')}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="pt-1 flex items-center gap-2">
                        {(status === 'expired' || status === 'rejected') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartReboost(p.product)}
                            className="flex-1 text-xs py-1 hover:border-brand-500 hover:text-brand-500 transition-colors cursor-pointer"
                          >
                            <RefreshCw size={12} className="mr-1.5" /> {t('renew', 'Renew')}
                          </Button>
                        )}
                        {status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCampaign(p.id)}
                            className="flex-1 text-xs py-1 text-red-500 border-red-500/20 hover:bg-red-500/10 cursor-pointer"
                          >
                            {t('cancel', 'Cancel')}
                          </Button>
                        )}
                        {status === 'approved' && p.product_slug && (
                          <a
                            href={`/product/${p.product_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-outline flex-1 text-center text-xs py-1 font-medium text-gray-700 dark:text-gray-300 border-surface-border dark:border-surface-dark-border hover:border-brand-500 flex items-center justify-center gap-1 rounded-btn"
                          >
                            {t('view_live_item', 'View Listing')} <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Promo Codes */}
      {activeTab === 'coupons' && (
        <div className="space-y-6">
          {showPromoForm && (
            <form onSubmit={handlePromoSubmit} className="card p-5 space-y-4 animate-scale-in text-xs border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A]">
              <div className="border-b border-surface-border dark:border-surface-dark-border pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {t('create_store_coupon', 'Create Store Coupon Code')}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('coupon_form_desc', 'Generate percentage or fixed discounts for buyers to apply during checkout.')}
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowPromoForm(false)} 
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <Ticket size={12} /> {t('coupon_code', 'Coupon Code *')}
                  </label>
                  <input
                    type="text"
                    name="code"
                    required
                    value={promoForm.code}
                    onChange={handlePromoChange}
                    placeholder="e.g. KARIBU10, FLASH20"
                    className="input py-2 text-xs w-full font-mono uppercase bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <Percent size={12} /> {t('discount_type', 'Discount Type')}
                  </label>
                  <select
                    name="discount_type"
                    value={promoForm.discount_type}
                    onChange={handlePromoChange}
                    className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
                  >
                    <option value="percentage">{t('percentage_off', 'Percentage Off (%)')}</option>
                    <option value="fixed">{t('fixed_amount_off', 'Fixed Amount Off (TZS)')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('discount_value', 'Discount Value *')}
                  </label>
                  <input
                    type="number"
                    name="value"
                    required
                    min="0.01"
                    step="any"
                    value={promoForm.value}
                    onChange={handlePromoChange}
                    placeholder={promoForm.discount_type === 'percentage' ? 'e.g. 15 (for 15% off)' : 'e.g. 5000 (for TSh 5,000 off)'}
                    className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('min_order_req', 'Minimum Order (TZS)')}
                  </label>
                  <input
                    type="number"
                    name="min_purchase_amount"
                    min="0"
                    step="any"
                    value={promoForm.min_purchase_amount}
                    onChange={handlePromoChange}
                    placeholder="e.g. 10000 (0 for no minimum)"
                    className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('max_usage_limit', 'Usage Limit')}
                  </label>
                  <input
                    type="number"
                    name="max_uses"
                    min="1"
                    value={promoForm.max_uses}
                    onChange={handlePromoChange}
                    placeholder="e.g. 50 (leave blank for unlimited)"
                    className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <Calendar size={12} /> {t('expiration_date_optional', 'Expiration Date (Optional)')}
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={promoForm.end_date}
                    onChange={handlePromoChange}
                    className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPromoForm(false)}>
                  {t('cancel', 'Cancel')}
                </Button>
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={submittingPromo} 
                  className="font-semibold bg-brand-500 hover:bg-brand-600 text-black shadow-xs"
                >
                  {submittingPromo ? t('creating_code', 'Creating...') : t('create_code_btn', 'Create Coupon')}
                </Button>
              </div>
            </form>
          )}

          {initialLoading ? (
            <TableSkeleton rows={3} cols={5} />
          ) : promoCodes.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title={t('no_coupons_title', 'No Store Coupons Created')}
              description={t('no_coupons_desc', 'Create custom discount codes to reward returning buyers or boost seasonal campaign sales.')}
              action={{
                label: t('create_first_coupon', 'Create First Coupon'),
                onClick: () => setShowPromoForm(true)
              }}
            />
          ) : (
            <div className="card overflow-hidden bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted dark:bg-[#161616] text-[11px] uppercase tracking-wider text-gray-400 font-semibold border-b border-surface-border dark:border-surface-dark-border">
                    <tr>
                      <th className="p-3">{t('coupon_code', 'Coupon Code')}</th>
                      <th className="p-3">{t('discount', 'Discount')}</th>
                      <th className="p-3 text-right">{t('min_spend', 'Min Order')}</th>
                      <th className="p-3 text-center">{t('redemptions', 'Redemptions')}</th>
                      <th className="p-3">{t('expiry_date', 'Expiry Date')}</th>
                      <th className="p-3 text-center">{t('status', 'Status')}</th>
                      <th className="p-3 text-center">{t('action', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {promoCodes.map((promo: any) => {
                      const isExpired = promo.end_date && new Date(promo.end_date).getTime() < nowTimestamp;
                      return (
                        <tr key={promo.id} className="hover:bg-surface-muted/40 dark:hover:bg-[#141414] transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-gray-900 dark:text-white text-xs bg-surface-muted dark:bg-[#161616] px-2 py-0.5 rounded border border-surface-border dark:border-surface-dark-border">
                                {promo.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(promo.code)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer p-1 rounded hover:bg-surface-muted dark:hover:bg-[#161616]"
                                title={t('copy_code', 'Copy code')}
                              >
                                {copiedCode === promo.code ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-brand-600 dark:text-brand-400 font-mono">
                            {promo.discount_type === 'percentage'
                              ? `${parseFloat(promo.value)}% Off`
                              : `TSh ${parseInt(promo.value, 10).toLocaleString()} Off`}
                          </td>
                          <td className="p-3 text-right text-gray-600 dark:text-gray-300">
                            {parseFloat(promo.min_purchase_amount) > 0 ? `TSh ${parseFloat(promo.min_purchase_amount).toLocaleString()}` : t('none', 'None')}
                          </td>
                          <td className="p-3 text-center text-gray-500 dark:text-gray-400">
                            <span className="font-mono">{promo.use_count}</span>
                            <span className="text-[10px] text-gray-400"> / {promo.max_uses || '∞'}</span>
                          </td>
                          <td className="p-3 text-gray-500 dark:text-gray-400">
                            {promo.end_date ? (
                              <span className={isExpired ? 'text-red-500 font-medium' : ''}>
                                {new Date(promo.end_date).toLocaleDateString()}
                                {isExpired && ` (${t('expired', 'Expired')})`}
                              </span>
                            ) : (
                              t('never', 'Never')
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleTogglePromoActive(promo.id, promo.is_active)}
                              className="transition inline-flex cursor-pointer"
                              title={promo.is_active ? t('deactivate', 'Deactivate') : t('activate', 'Activate')}
                            >
                              {promo.is_active ? (
                                <ToggleRight size={26} className="text-brand-500" />
                              ) : (
                                <ToggleLeft size={26} className="text-gray-300 dark:text-gray-600" />
                              )}
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePromo(promo.id)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                              title={t('delete', 'Delete')}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Proof Lightbox Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-white dark:bg-[#121212] rounded-card p-2 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition cursor-pointer"
            >
              <X size={16} />
            </button>
            <img src={previewImage} alt="Payment Proof" className="max-h-[80vh] w-auto object-contain rounded" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPromotions;


