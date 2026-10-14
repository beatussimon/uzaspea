import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
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
  RefreshCw,
  Eye,
  ArrowUpRight,
  Info,
  UserCheck,
  Share2,
  Edit2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
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
const location = useLocation();
  const { user } = useAuth();
  const { showConfirm, showPrompt } = useDialog();
  const formRef = useRef<HTMLFormElement>(null);

  const [activeTab, setActiveTab] = useState<'sponsored' | 'coupons' | 'referrals'>('sponsored');
  const [campaignFilter, setCampaignFilter] = useState<'approved' | 'pending' | 'expired' | 'rejected' | 'all'>('approved');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Data States
  const [promotions, setPromotions] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [adminLipa, setAdminLipa] = useState<any[]>([]);
  const [referralConversions, setReferralConversions] = useState<any[]>([]);
  const [referralSummary, setReferralSummary] = useState<any>({ total_sales: 0, total_commission_owed: 0, total_commission_paid: 0, total_orders: 0 });
  const [referralFilterStatus, setReferralFilterStatus] = useState<string>('all');
  
  // Loading States
  const [initialLoading, setInitialLoading] = useState(true);

  // Sponsored Listing Form State
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(() => (location.state as any)?.boostedProduct || null);
  const [form, setForm] = useState({ 
    product: (location.state as any)?.boostedProduct ? String((location.state as any).boostedProduct.id) : '', 
    title: (location.state as any)?.boostedProduct ? `Featured: ${(location.state as any).boostedProduct.name}` : '', 
    description: '', 
    duration_days: 7 
  });
  const [submitting, setSubmitting] = useState(false);
  const [refId, setRefId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Promo Code Form State
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
  const [promoFormType, setPromoFormType] = useState<'coupon' | 'affiliate'>('coupon');
  const [couponStatusFilter, setCouponStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [affiliateStatusFilter, setAffiliateStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const promoFormRef = useRef<HTMLFormElement>(null);
  const [promoForm, setPromoForm] = useState({
    code: '',
    affiliate_name: '',
    discount_type: 'percentage',
    value: '',
    commission_type: 'percentage',
    commission_rate: '',
    min_purchase_amount: '0',
    max_uses: '',
    max_uses_per_user: '1',
    end_date: '',
    applicable_scope: 'single_product' as 'single_product' | 'specific_products' | 'all_products',
    product_id: '',
    selected_product_ids: [] as number[],
    attribution_window_days: '7'
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
      const [sponsoredRes, promoRes, productsRes, lipaRes, referralRes] = await Promise.allSettled([
        api.get('/api/sponsored/'),
        api.get('/api/promo-codes/'),
        api.get('/api/products/?mine=true'),
        api.get('/api/lipa-numbers/?seller=admin'),
        api.get('/api/promo-codes/referral-conversions/')
      ]);

      if (sponsoredRes.status === 'fulfilled') {
        setPromotions(sponsoredRes.value.data.results || sponsoredRes.value.data || []);
      }
      if (promoRes.status === 'fulfilled') {
        setPromoCodes(promoRes.value.data.results || promoRes.value.data || []);
      }
      if (referralRes.status === 'fulfilled') {
        setReferralConversions(referralRes.value.data.results || referralRes.value.data || []);
        if (referralRes.value.data.summary) {
          setReferralSummary(referralRes.value.data.summary);
        }
      }
      if (productsRes.status === 'fulfilled') {
        const prods = productsRes.value.data.results || productsRes.value.data || [];
        setProducts(prods);
        if (prods.length > 0) {
          setPromoForm(prev => prev.product_id ? prev : { ...prev, product_id: String(prods[0].id) });
        }
        if (form.product && !selectedProduct) {
          const match = prods.find((p: any) => String(p.id) === String(form.product));
          if (match) setSelectedProduct(match);
        }
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
    } else if (tabParam === 'referrals') {
      setActiveTab('referrals');
    }

    if (newParam === 'true') {
      setShowForm(true);
      const stateProduct = (location.state as any)?.boostedProduct;
      if (stateProduct) {
        setSelectedProduct(stateProduct);
        setForm(prev => ({ 
          ...prev, 
          product: String(stateProduct.id),
          title: prev.title || `Boost: ${stateProduct.name}`
        }));
      } else if (prodParam) {
        setForm(prev => ({ ...prev, product: prodParam }));
        const match = products.find(p => String(p.id) === String(prodParam));
        if (match) {
          setSelectedProduct(match);
          setForm(prev => ({ ...prev, title: prev.title || `Boost: ${match.name}` }));
        } else {
          api.get(`/api/products/${prodParam}/`).then(res => {
            setSelectedProduct(res.data);
            setForm(prev => ({ 
              ...prev, 
              product: String(res.data.id),
              title: prev.title || `Boost: ${res.data.name}`
            }));
          }).catch(() => {});
        }
      }
    }
  }, [location.search, location.state, products]);

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

  const refreshReferralConversions = async (statusFilter?: string) => {
    try {
      const activeFilter = statusFilter !== undefined ? statusFilter : referralFilterStatus;
      const url = activeFilter && activeFilter !== 'all'
        ? `/api/promo-codes/referral-conversions/?status=${activeFilter}`
        : '/api/promo-codes/referral-conversions/';
      const res = await api.get(url);
      setReferralConversions(res.data.results || res.data || []);
      if (res.data.summary) {
        setReferralSummary(res.data.summary);
      }
    } catch {}
  };

  const handleFilterStatusChange = (newStatus: string) => {
    setReferralFilterStatus(newStatus);
    refreshReferralConversions(newStatus);
  };

  const isPromoExpired = (p: any) => {
    if (p.end_date && new Date(p.end_date).getTime() < nowTimestamp) return true;
    if (p.max_uses !== null && p.max_uses !== undefined && (p.use_count || 0) >= p.max_uses) return true;
    return false;
  };

  const affiliateCodes = useMemo(() => {
    return promoCodes.filter((p: any) => Boolean(p.affiliate_name) || (parseFloat(p.commission_rate || '0') > 0));
  }, [promoCodes]);

  const filteredAffiliateCodes = useMemo(() => {
    return affiliateCodes.filter((p: any) => {
      const expired = isPromoExpired(p);
      if (affiliateStatusFilter === 'active') return p.is_active && !expired;
      if (affiliateStatusFilter === 'expired') return expired;
      return true;
    });
  }, [affiliateCodes, affiliateStatusFilter, nowTimestamp]);


  const filteredCoupons = useMemo(() => {
    return promoCodes.filter((p: any) => {
      const expired = isPromoExpired(p);
      if (couponStatusFilter === 'active') return p.is_active && !expired;
      if (couponStatusFilter === 'expired') return expired;
      return true;
    });
  }, [promoCodes, couponStatusFilter, nowTimestamp]);

  const activeCouponsCount = useMemo(() => {
    return promoCodes.filter((c: any) => c.is_active && !isPromoExpired(c)).length;
  }, [promoCodes, nowTimestamp]);

  const handleCopyAffiliateLink = (promoOrCode: any) => {
    const origin = window.location.origin;
    const storeHandle = user?.username ? encodeURIComponent(user.username) : '';
    const targetPromo = typeof promoOrCode === 'string'
      ? promoCodes.find((p: any) => p.code === promoOrCode)
      : promoOrCode;
    const code = typeof promoOrCode === 'string' ? promoOrCode : (promoOrCode?.code || '');

    let shareUrl = '';
    if (targetPromo?.applicable_scope === 'single_product' && targetPromo?.product_slug) {
      shareUrl = `${origin}/product/${targetPromo.product_slug}?ref=${encodeURIComponent(code)}`;
    } else {
      shareUrl = storeHandle 
        ? `${origin}/browse?merchant=${storeHandle}&ref=${encodeURIComponent(code)}` 
        : `${origin}/browse?ref=${encodeURIComponent(code)}`;
    }

    navigator.clipboard.writeText(shareUrl);
    setCopiedCode(code);
    toast.success(t('affiliate_link_copied', `Affiliate link copied to clipboard!`));
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleMarkPaid = async (conversionId: number) => {
    const payoutRef = await showPrompt(
      t('mark_paid_prompt', 'Enter payment reference or transaction ID (e.g., M-Pesa / Tigo Pesa reference):'),
      'e.g. MP2409... / TG8812...',
      '',
      t('mark_paid_title', 'Settle Influencer Cut')
    );
    if (payoutRef === null) return;

    try {
      await api.post(`/api/promo-codes/conversions/${conversionId}/mark-paid/`, {
        payout_reference: payoutRef.trim()
      });
      toast.success(t('cut_marked_paid', 'Influencer cut marked as settled!'));
      refreshReferralConversions();
    } catch {
      toast.error(t('failed_mark_paid', 'Failed to update payout status'));
    }
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

  const handleStartEditPromo = (promo: any) => {
    const isAffiliate = Boolean(promo.affiliate_name) || (parseFloat(promo.commission_rate || '0') > 0) || activeTab === 'referrals';
    setPromoFormType(isAffiliate ? 'affiliate' : 'coupon');
    setEditingPromoId(promo.id);
    setPromoForm({
      code: promo.code || '',
      affiliate_name: promo.affiliate_name || '',
      discount_type: promo.discount_type || 'percentage',
      value: String(promo.value || ''),
      commission_type: promo.commission_type || 'percentage',
      commission_rate: promo.commission_rate ? String(promo.commission_rate) : '',
      min_purchase_amount: promo.min_purchase_amount ? String(promo.min_purchase_amount) : '0',
      max_uses: promo.max_uses ? String(promo.max_uses) : '',
      max_uses_per_user: promo.max_uses_per_user ? String(promo.max_uses_per_user) : '1',
      end_date: promo.end_date ? new Date(promo.end_date).toISOString().split('T')[0] : '',
      applicable_scope: (promo.applicable_scope as any) || (isAffiliate ? 'single_product' : 'all_products'),
      product_id: promo.product ? String(promo.product) : promo.product_id ? String(promo.product_id) : (products.length > 0 ? String(products[0].id) : ''),
      selected_product_ids: Array.isArray(promo.products) ? promo.products : [],
      attribution_window_days: String(promo.attribution_window_days || '7')
    });
    setShowPromoForm(true);
    setTimeout(() => {
      promoFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleOpenCreatePromo = (overrideType?: 'coupon' | 'affiliate') => {
    const targetType = overrideType || (activeTab === 'referrals' ? 'affiliate' : 'coupon');
    setPromoFormType(targetType);
    setEditingPromoId(null);
    setPromoForm({
      code: '',
      affiliate_name: '',
      discount_type: 'percentage',
      value: '',
      commission_type: 'percentage',
      commission_rate: '',
      min_purchase_amount: '0',
      max_uses: '',
      max_uses_per_user: '1',
      end_date: '',
      applicable_scope: targetType === 'affiliate' ? 'single_product' : 'all_products',
      product_id: products.length > 0 ? String(products[0].id) : '',
      selected_product_ids: [],
      attribution_window_days: '7'
    });
    setShowPromoForm(true);
    setTimeout(() => {
      promoFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handlePromoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPromoForm({ ...promoForm, [e.target.name]: e.target.value });
  };

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoForm.code.trim().toUpperCase();
    if (!cleanCode) {
      toast.error(t('enter_promo_code', 'Please enter a promo code'));
      return;
    }
    const isAffiliate = promoFormType === 'affiliate';
    const hasCommission = isAffiliate && promoForm.commission_rate && parseFloat(promoForm.commission_rate) > 0;
    const discountVal = parseFloat(promoForm.value || '0');

    if (!isAffiliate && discountVal <= 0) {
      toast.error(t('enter_valid_discount', 'Please enter a valid discount amount'));
      return;
    }

    if (isAffiliate && !hasCommission && discountVal <= 0) {
      toast.error(t('enter_valid_discount_or_commission', 'Please enter a discount amount or influencer commission cut'));
      return;
    }

    if (promoForm.applicable_scope === 'single_product' && !promoForm.product_id) {
      toast.error(t('select_product_required', 'Please select a product for this promotion'));
      return;
    }

    if (promoForm.applicable_scope === 'specific_products' && promoForm.selected_product_ids.length === 0) {
      toast.error(t('select_products_required', 'Please select at least one product'));
      return;
    }

    setSubmittingPromo(true);
    try {
      const data: any = {
        code: cleanCode,
        discount_type: promoForm.discount_type,
        value: discountVal,
        min_purchase_amount: parseFloat(promoForm.min_purchase_amount || '0'),
        applicable_scope: promoForm.applicable_scope,
      };

      if (promoForm.applicable_scope === 'single_product') {
        data.product = parseInt(promoForm.product_id, 10);
      } else if (promoForm.applicable_scope === 'specific_products') {
        data.products = promoForm.selected_product_ids;
      }

      if (isAffiliate) {
        if (promoForm.affiliate_name.trim()) {
          data.affiliate_name = promoForm.affiliate_name.trim();
        }
        if (promoForm.commission_rate) {
          data.commission_type = promoForm.commission_type;
          data.commission_rate = parseFloat(promoForm.commission_rate);
        }
        data.attribution_window_days = parseInt(promoForm.attribution_window_days || '7', 10);
      } else {
        data.affiliate_name = '';
        data.commission_rate = 0;
        data.commission_type = 'percentage';
        data.attribution_window_days = 7;
      }

      if (promoForm.max_uses) {
        data.max_uses = parseInt(promoForm.max_uses, 10);
      }
      if (promoForm.max_uses_per_user) {
        data.max_uses_per_user = parseInt(promoForm.max_uses_per_user, 10);
      }
      if (promoForm.end_date) {
        data.end_date = new Date(promoForm.end_date).toISOString();
      }

      if (editingPromoId) {
        await api.patch(`/api/promo-codes/${editingPromoId}/`, data);
        toast.success(isAffiliate ? t('affiliate_updated_success', 'Affiliate referral code updated!') : t('promo_updated_success', 'Promo code updated successfully!'));
      } else {
        await api.post('/api/promo-codes/', data);
        toast.success(isAffiliate ? t('affiliate_created_success', 'Affiliate referral code created!') : t('promo_created_success', 'Promo code created successfully!'));
      }
      setShowPromoForm(false);
      setEditingPromoId(null);
      setPromoForm({
        code: '',
        affiliate_name: '',
        discount_type: 'percentage',
        value: '',
        commission_type: 'percentage',
        commission_rate: '',
        min_purchase_amount: '0',
        max_uses: '',
        max_uses_per_user: '1',
        end_date: '',
        applicable_scope: isAffiliate ? 'single_product' : 'all_products',
        product_id: products.length > 0 ? String(products[0].id) : '',
        selected_product_ids: [],
        attribution_window_days: '7'
      });
      refreshPromoCodes();
      refreshReferralConversions();
    } catch (err: any) {
      let detail = t('failed_to_create_promo', 'Failed to create promo code');
      if (err.response?.data) {
        const d = err.response.data;
        if (typeof d === 'object') {
          detail = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
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
    const promo = promoCodes.find(p => p.id === id);
    if (promo && isPromoExpired(promo)) {
      toast.error(t('cannot_toggle_expired', 'This promo code has expired. Edit the expiry date to reactivate it.'));
      return;
    }

    setPromoCodes(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentActive } : p));
    try {
      await api.patch(`/api/promo-codes/${id}/`, { is_active: !currentActive });
      toast.success(
        !currentActive
          ? t('promo_code_enabled', 'Promo code enabled')
          : t('promo_code_disabled', 'Promo code disabled')
      );
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

  const isAffiliate = promoFormType === 'affiliate';

  const promoFormJsx = showPromoForm && (
    <form ref={promoFormRef} onSubmit={handlePromoSubmit} className="card p-5 space-y-4 animate-scale-in text-xs border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A]">
      <div className="border-b border-surface-border dark:border-surface-dark-border pb-3 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            {editingPromoId
              ? (isAffiliate ? t('edit_affiliate_code', 'Edit Affiliate Referral Code') : t('edit_store_coupon', 'Edit Promo Code'))
              : (isAffiliate ? t('create_affiliate_code', 'Create Affiliate Referral Code') : t('create_store_coupon', 'Create Promo Code'))}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {editingPromoId
              ? (isAffiliate ? t('edit_affiliate_desc', 'Modify promoter settings, commission cut, qualifying products, and campaign rules.') : t('edit_coupon_desc', 'Update discount amount, qualifying products, and usage rules.'))
              : (isAffiliate
                  ? t('affiliate_form_desc', 'Assign a code or link to an influencer and define their commission cut.')
                  : t('coupon_form_desc', 'Generate percentage or fixed discounts for buyers to apply during checkout.'))}
          </p>
        </div>
        <button 
          type="button" 
          onClick={() => { setShowPromoForm(false); setEditingPromoId(null); }} 
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Row 1: Code (and Influencer Name ONLY if affiliate) */}
      <div className={isAffiliate ? "grid grid-cols-1 md:grid-cols-2 gap-3" : ""}>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
            <Ticket size={12} /> {isAffiliate ? t('referral_code', 'Referral Code') : t('promo_code', 'Promo Code')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="code"
            required
            value={promoForm.code}
            onChange={handlePromoChange}
            placeholder={isAffiliate ? "e.g. SARAH10, JUMA5" : "e.g. FLASH20, WELCOME10"}
            className="input py-2 text-xs w-full font-mono uppercase bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
          />
        </div>
        {isAffiliate && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <UserCheck size={12} /> {t('influencer_partner_name', 'Influencer / Promoter Name')}
            </label>
            <input
              type="text"
              name="affiliate_name"
              value={promoForm.affiliate_name}
              onChange={handlePromoChange}
              placeholder="e.g. @sarah_tz or Juma Kimaro (Optional)"
              className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
            />
          </div>
        )}
      </div>

      {/* Row 2: Buyer Discount Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
            <Percent size={12} /> {isAffiliate ? t('buyer_discount_type', 'Buyer Discount Type') : t('discount_type', 'Discount Type')}
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
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {isAffiliate ? t('buyer_discount_value', 'Buyer Discount Amount') : t('discount_value', 'Discount Value')} {!isAffiliate && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            name="value"
            min="0"
            step="any"
            required={!isAffiliate}
            value={promoForm.value}
            onChange={handlePromoChange}
            placeholder={promoForm.discount_type === 'percentage' ? (isAffiliate ? 'e.g. 10 (or 0 for cut only)' : 'e.g. 15 (for 15% off)') : 'e.g. 5000 (for TSh 5,000 off)'}
            className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
          />
        </div>
      </div>

      {/* Promoter Commission Cut Settings (ONLY visible in Affiliate mode) */}
      {isAffiliate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-brand-500/5 dark:bg-brand-500/10 border border-brand-500/20">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Percent size={12} /> {t('influencer_cut_type', 'Promoter Commission Type')}
            </label>
            <select
              name="commission_type"
              value={promoForm.commission_type}
              onChange={handlePromoChange}
              className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
            >
              <option value="percentage">{t('cut_percentage_label', 'Percentage of Sale (%)')}</option>
              <option value="fixed">{t('cut_fixed_label', 'Fixed Bounty per Order (TZS)')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('influencer_cut_rate', 'Promoter Commission Amount')}
            </label>
            <input
              type="number"
              name="commission_rate"
              min="0"
              step="any"
              value={promoForm.commission_rate}
              onChange={handlePromoChange}
              placeholder={promoForm.commission_type === 'percentage' ? 'e.g. 10 (for 10% cut per sale)' : 'e.g. 3000 (for TSh 3,000 bounty)'}
              className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
            />
          </div>
        </div>
      )}

      {/* Product Applicability Scope */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          {t('product_scope', 'Product Applicability Scope')} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { id: 'all_products', label: t('scope_all', 'Storewide'), desc: t('scope_all_desc', 'All store inventory') },
            { id: 'single_product', label: t('scope_single', 'Single Product'), desc: t('scope_single_desc', 'Direct link to 1 product') },
            { id: 'specific_products', label: t('scope_specific', 'Selected Products'), desc: t('scope_specific_desc', 'Selected collection') }
          ].map(scope => {
            const isSelected = promoForm.applicable_scope === scope.id;
            return (
              <button
                key={scope.id}
                type="button"
                onClick={() => setPromoForm(prev => ({ ...prev, applicable_scope: scope.id as any }))}
                className={`p-2.5 rounded-xl text-left transition flex flex-col justify-between cursor-pointer select-none bg-surface-muted/60 dark:bg-neutral-900/60 ${
                  isSelected
                    ? 'border-2 border-brand-500 text-gray-900 dark:text-white'
                    : 'border-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span className="font-semibold text-xs">{scope.label}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">{scope.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic selector based on scope */}
        {promoForm.applicable_scope === 'single_product' && (
          <div className="pt-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('select_target_product', 'Target Product')} <span className="text-red-500">*</span>
            </label>
            {products.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('no_products_inventory', 'No products listed yet. Please add a product first.')}</p>
            ) : (
              <select
                name="product_id"
                value={promoForm.product_id}
                onChange={handlePromoChange}
                required
                className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
              >
                <option value="">-- {t('select_a_product', 'Select a product')} --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — TSh {parseInt(p.price || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {isAffiliate
                ? t('single_product_link_hint', 'Generates a direct link to this product page with attribution auto-captured at checkout.')
                : t('single_product_coupon_hint', 'This discount code will only apply to this selected item.')}
            </p>
          </div>
        )}

        {promoForm.applicable_scope === 'specific_products' && (
          <div className="pt-1 space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('choose_qualifying_products', 'Select Qualifying Products')} ({promoForm.selected_product_ids.length} selected) <span className="text-red-500">*</span>
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl bg-surface-muted/40 dark:bg-neutral-900/40 border border-surface-border dark:border-surface-dark-border">
              {products.map(p => {
                const isChecked = promoForm.selected_product_ids.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded transition">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setPromoForm(prev => ({
                          ...prev,
                          selected_product_ids: isChecked
                            ? prev.selected_product_ids.filter(id => id !== p.id)
                            : [...prev.selected_product_ids, p.id]
                        }));
                      }}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="truncate flex-1 text-gray-900 dark:text-white">{p.name}</span>
                    <span className="text-gray-400 font-mono text-[11px]">TSh {parseInt(p.price || 0).toLocaleString()}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {promoForm.applicable_scope === 'all_products' && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 pt-1">
            {t('all_products_hint', 'This promo applies to all items across your store catalog.')}
          </p>
        )}
      </div>

      {/* Usage Limits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            placeholder="0 for no min"
            className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('uses_per_customer', 'Uses per Customer')}
          </label>
          <input
            type="number"
            name="max_uses_per_user"
            min="1"
            value={promoForm.max_uses_per_user}
            onChange={handlePromoChange}
            placeholder="1 (default 1 use)"
            className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('total_usage_limit', 'Total Campaign Uses')}
          </label>
          <input
            type="number"
            name="max_uses"
            min="1"
            value={promoForm.max_uses}
            onChange={handlePromoChange}
            placeholder="Leave blank for unlimited"
            className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
          />
        </div>
      </div>

      {/* Expiration Date (and Attribution Window ONLY if affiliate) */}
      <div className={isAffiliate ? "grid grid-cols-1 md:grid-cols-2 gap-3" : ""}>
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
        {isAffiliate && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Clock size={12} /> {t('attribution_window_label', 'Attribution Window (Days)')}
            </label>
            <input
              type="number"
              name="attribution_window_days"
              min="1"
              max="90"
              value={promoForm.attribution_window_days}
              onChange={handlePromoChange}
              placeholder="7"
              className="input py-2 text-xs w-full bg-white dark:bg-[#121212] border-surface-border dark:border-surface-dark-border"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              {t('attribution_window_help', 'How many days after clicking the referral remains active for customer (default: 7).')}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-surface-border dark:border-surface-dark-border">
        <Button type="button" variant="outline" size="sm" onClick={() => { setShowPromoForm(false); setEditingPromoId(null); }}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button 
          type="submit" 
          size="sm" 
          disabled={submittingPromo} 
          className="font-semibold bg-brand-500 hover:bg-brand-600 text-black shadow-xs"
        >
          {submittingPromo 
            ? t('saving', 'Saving...') 
            : editingPromoId
            ? t('save_changes', 'Save Changes')
            : (isAffiliate ? t('create_affiliate_btn', 'Create Referral Code') : t('create_code_btn', 'Create Promo Code'))}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('promotions', 'Promotions')}
            </h1>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'sponsored' && (
              <Button
                size="sm"
                onClick={() => setShowForm(!showForm)}
                className="font-semibold whitespace-nowrap flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-black shadow-xs text-xs px-3 py-1.5 shrink-0"
              >
                {showForm ? <X size={14} /> : <Plus size={14} />}
                {showForm ? t('close', 'Close') : t('new_promotion', 'New Promotion')}
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
        activeTab === 'referrals' ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label={t('referral_sales', 'Referral Sales')}
              value={`TSh ${Math.round(referralSummary.total_sales || 0).toLocaleString()}`}
              icon={TrendingUp}
            />
            <KpiCard
              label={t('commission_owed', 'Commission Owed')}
              value={`TSh ${Math.round(referralSummary.total_commission_owed || 0).toLocaleString()}`}
              icon={Ticket}
            />
            <KpiCard
              label={t('commission_paid', 'Commission Paid')}
              value={`TSh ${Math.round(referralSummary.total_commission_paid || 0).toLocaleString()}`}
              icon={CheckCircle2}
            />
            <KpiCard
              label={t('referral_orders', 'Referral Orders')}
              value={referralSummary.total_orders || referralConversions.length}
              icon={Package}
            />
          </div>
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
        )
      )}

      {/* Main Tab Bar */}
      <div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-none">
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
        <button
          type="button"
          onClick={() => setActiveTab('referrals')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'referrals'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-surface-muted dark:bg-neutral-900 border border-surface-border dark:border-surface-dark-border'
          }`}
        >
          <UserCheck size={13} className="shrink-0" />
          <span className="whitespace-nowrap">{t('affiliates_referrals', 'Affiliates & Referrals')}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
            activeTab === 'referrals' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
          }`}>
            {referralConversions.length}
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
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('select_product_to_promote', 'Select Product')} <span className="text-red-500">*</span>
                </label>
                {selectedProduct ? (
                  <div className="flex items-center gap-3.5 p-3.5 rounded-xl border border-brand-500/40 bg-brand-500/5 dark:bg-brand-500/10 transition">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
                      <SafeImage
                        src={selectedProduct.images?.[0]?.image || selectedProduct.image}
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded">
                          Item Selected for Boost
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                        {selectedProduct.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        TSh {parseInt(selectedProduct.price || 0).toLocaleString()} • {selectedProduct.category_name || selectedProduct.category || 'Product'} • Stock: {selectedProduct.stock}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setForm(prev => ({ ...prev, product: '' }));
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white bg-white dark:bg-neutral-800 hover:bg-gray-100 border border-neutral-200 dark:border-neutral-700 rounded-lg transition shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : products.length === 0 ? (
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
                    onChange={(e) => {
                      handleChange(e);
                      const found = products.find(p => String(p.id) === e.target.value);
                      if (found) {
                        setSelectedProduct(found);
                        setForm(prev => ({ ...prev, title: prev.title || `Boost: ${found.name}` }));
                      }
                    }} 
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
                  {t('choose_duration_plan', 'Placement Duration & Rate')} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BOOST_PLANS.map(plan => {
                    const isSelected = Number(form.duration_days) === plan.days;
                    return (
                      <button
                        key={plan.days}
                        type="button"
                        onClick={() => setForm({ ...form, duration_days: plan.days })}
                        className={`p-3 rounded-xl text-left transition flex flex-col justify-between cursor-pointer select-none bg-surface-muted/60 dark:bg-neutral-900/60 ${
                          isSelected
                            ? 'border-2 border-brand-500 text-gray-900 dark:text-white'
                            : 'border-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-xs text-gray-900 dark:text-white">
                            {plan.days} {t('days', 'Days')}
                          </span>
                          {plan.badge && (
                            <span className="text-3xs text-brand-600 dark:text-brand-400 font-medium uppercase tracking-wider">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-1 leading-snug">
                          {plan.description}
                        </p>
                        <div className="mt-2.5 pt-1.5 flex items-baseline justify-between w-full">
                          <span className="text-3xs text-gray-400 uppercase font-medium">{t('rate', 'Rate')}</span>
                          <span className="font-semibold font-mono text-xs text-gray-900 dark:text-white">
                            TSh {plan.price.toLocaleString()}
                          </span>
                        </div>
                      </button>
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
                      <div key={lipa.id} className="flex items-center gap-2.5 bg-surface-muted/50 dark:bg-neutral-900/50 rounded-xl p-2.5">
                        <div className={`rounded flex items-center justify-center overflow-hidden shrink-0 ${lipa.network_logo ? 'w-10 h-5' : 'w-5 h-5'}`}>
                          {lipa.network_logo ? (
                            <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                          ) : (
                            <Smartphone size={12} className="text-emerald-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-3xs text-gray-400 uppercase leading-none font-medium">{lipa.network_name}</p>
                          <p className="font-mono font-bold text-gray-900 dark:text-white text-xs mt-0.5">{lipa.number}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleCopy(lipa.number)}
                          className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition px-2 py-1 cursor-pointer font-medium"
                        >
                          {copiedCode === lipa.number ? <Check size={12} className="text-emerald-500" /> : t('copy', 'Copy')}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 bg-surface-muted/50 dark:bg-neutral-900/50 rounded-xl text-xs text-gray-500">
                    {t('pay_via_admin_number', 'Pay via the official platform merchant Lipa number and input your transaction code.')}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('transaction_ref_code', 'Transaction Reference Code')} <span className="text-red-500">*</span>
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
                      {t('payment_receipt_proof', 'Payment Receipt Screenshot')} <span className="text-red-500">*</span>
                    </label>
                    {proofPreview ? (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-surface-muted/50 dark:bg-neutral-900/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={proofPreview} alt="Receipt preview" className="w-6 h-6 object-cover rounded shrink-0" />
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
                      <label className="flex items-center justify-between w-full h-9 rounded-xl cursor-pointer bg-surface-muted/50 dark:bg-neutral-900/50 hover:bg-surface-muted dark:hover:bg-neutral-900 transition px-3">
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
              {(['approved', 'pending', 'expired', 'rejected', 'all'] as const).map(f => {
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
                    {f === 'approved' && t('live_active', 'Active')}
                    {f === 'pending' && t('pending_review', 'Under Review')}
                    {f === 'expired' && t('completed', 'Completed')}
                    {f === 'rejected' && t('rejected', 'Rejected')}
                    {f === 'all' && t('all_campaigns', 'All Placements')}
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
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {t('active', 'Active')}
                          </span>
                        )}
                        {status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <Clock size={12} />
                            {t('under_review', 'Under Review')}
                          </span>
                        )}
                        {status === 'expired' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            <CheckCircle2 size={12} />
                            {t('completed', 'Completed')}
                          </span>
                        )}
                        {status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                            <AlertCircle size={12} />
                            {t('rejected', 'Rejected')}
                          </span>
                        )}

                        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-normal">
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Product Snippet Header - Clickable Product */}
                      {p.product_slug ? (
                        <a
                          href={`/product/${p.product_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 mb-3 group select-none"
                          title={t('view_product_page', 'View Product Page')}
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800/80">
                            {productImg ? (
                              <SafeImage src={productImg} alt={p.product_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Package size={16} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white text-xs truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                              {p.product_name || 'Product'}
                            </h4>
                            <p className="font-mono text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">
                              {product.price ? `TSh ${parseInt(product.price).toLocaleString()}` : ''}
                            </p>
                          </div>
                        </a>
                      ) : (
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800/80">
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
                        </div>
                      )}

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
                    <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="text-gray-500 dark:text-gray-400 font-normal">
                          {p.duration_days || 7} {t('days_duration', 'Days')}
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
                          <button
                            type="button"
                            onClick={() => handleStartReboost(p.product)}
                            className="w-full py-2 px-3 text-xs font-medium rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition flex items-center justify-center cursor-pointer active:scale-[0.98]"
                          >
                            <span>{t('renew', 'Renew')}</span>
                          </button>
                        )}
                        {status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCampaign(p.id)}
                            className="w-full py-2 px-3 text-xs font-medium rounded-xl text-red-500 hover:bg-red-500/10 transition flex items-center justify-center cursor-pointer active:scale-[0.98]"
                          >
                            <span>{t('cancel', 'Cancel')}</span>
                          </button>
                        )}
                        {status === 'approved' && p.product_slug && (
                          <a
                            href={`/product/${p.product_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2 px-3 text-xs font-medium rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition flex items-center justify-center"
                          >
                            <span>{t('view_live_item', 'View Listing')}</span>
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
          {promoFormJsx}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {t('store_coupons_title', 'Store Promo Codes & Coupons')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('store_coupons_desc', 'Discount codes for your customers to apply during checkout.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCouponStatusFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    couponStatusFilter === 'all'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {t('all', 'All')}
                </button>
                <button
                  type="button"
                  onClick={() => setCouponStatusFilter('active')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    couponStatusFilter === 'active'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {t('active', 'Active')}
                </button>
                <button
                  type="button"
                  onClick={() => setCouponStatusFilter('expired')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    couponStatusFilter === 'expired'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {t('expired', 'Expired')}
                </button>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenCreatePromo('coupon')}
                className="text-xs flex items-center gap-1.5"
              >
                <Plus size={13} />
                {t('new_coupon', 'New Promo Code')}
              </Button>
            </div>
          </div>

          {initialLoading ? (
            <TableSkeleton rows={3} cols={5} />
          ) : promoCodes.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title={t('no_coupons_title', 'No Store Promo Codes Created')}
              description={t('no_coupons_desc', 'Create custom discount codes to reward returning buyers or boost seasonal campaign sales.')}
              action={{
                label: t('create_first_coupon', 'Create First Promo Code'),
                onClick: () => handleOpenCreatePromo('coupon')
              }}
            />
          ) : filteredCoupons.length === 0 ? (
            <div className="card p-6 text-center border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A] text-xs text-gray-500 dark:text-gray-400">
              {couponStatusFilter === 'expired'
                ? t('no_expired_coupons', 'No expired promo codes found.')
                : t('no_active_coupons', 'No active promo codes found.')}
            </div>
          ) : (
            <div className="card overflow-hidden !border-none !rounded-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold border-b border-surface-border dark:border-surface-dark-border">
                    <tr>
                      <th className="p-3">{t('coupon_code', 'Promo Code')}</th>
                      <th className="p-3">{t('discount', 'Discount')}</th>
                      <th className="p-3 text-right">{t('min_spend', 'Min Order')}</th>
                      <th className="p-3 text-center">{t('redemptions', 'Redemptions')}</th>
                      <th className="p-3">{t('expiry_date', 'Expiry Date')}</th>
                      <th className="p-3 text-center">{t('status', 'Status')}</th>
                      <th className="p-3 text-center">{t('action', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                  {filteredCoupons.map((promo: any) => {
                    const isExpired = isPromoExpired(promo);
                    return (
                      <tr key={promo.id} className="hover:bg-surface-muted/40 dark:hover:bg-[#141414] transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-gray-900 dark:text-white text-xs bg-surface-muted dark:bg-[#161616] px-2 py-0.5 rounded">
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
                            <button
                              type="button"
                              onClick={() => handleCopyAffiliateLink(promo)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer p-1 rounded hover:bg-surface-muted dark:hover:bg-[#161616]"
                              title={t('copy_affiliate_link', 'Copy shareable link')}
                            >
                              <Share2 size={13} />
                            </button>
                          </div>
                          {promo.affiliate_name && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {t('partner', 'Partner')}: {promo.affiliate_name}
                            </div>
                          )}
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
                          ) : promo.max_uses && (promo.use_count || 0) >= promo.max_uses ? (
                            <span className="text-red-500 font-medium">{t('limit_reached', 'Limit Reached')}</span>
                          ) : (
                            t('never', 'Never')
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isExpired ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 uppercase tracking-tight">
                              {t('expired', 'Expired')}
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              {promo.is_active ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-tight">
                                  {t('active', 'Active')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/20 uppercase tracking-tight">
                                  {t('paused', 'Paused')}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleTogglePromoActive(promo.id, promo.is_active)}
                                className="transition inline-flex cursor-pointer mt-0.5"
                                title={promo.is_active ? t('deactivate', 'Deactivate') : t('activate', 'Activate')}
                              >
                                {promo.is_active ? (
                                  <ToggleRight size={22} className="text-brand-500" />
                                ) : (
                                  <ToggleLeft size={22} className="text-gray-300 dark:text-gray-600" />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditPromo(promo)}
                              className="p-1 text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 rounded transition cursor-pointer"
                              title={t('edit_coupon', 'Edit Promo Code')}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePromo(promo.id)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                              title={t('delete', 'Delete')}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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

      {/* Tab 3: Influencer Referrals & Conversions Ledger */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          {promoFormJsx}

          {/* Section 1: Active Affiliate Links */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>{t('active_affiliate_codes', 'Affiliate & Partner Codes')}</span>
                  <span className="text-xs font-normal text-gray-400">
                    ({affiliateCodes.length})
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('active_affiliate_desc', 'Trackable codes and share links configured for influencers with custom commission cuts.')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setAffiliateStatusFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                      affiliateStatusFilter === 'all'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold'
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                  >
                    {t('all', 'All')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAffiliateStatusFilter('active')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                      affiliateStatusFilter === 'active'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold'
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                  >
                    {t('active', 'Active')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAffiliateStatusFilter('expired')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                      affiliateStatusFilter === 'expired'
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold'
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                  >
                    {t('expired', 'Expired')}
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenCreatePromo('affiliate')}
                  className="text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Plus size={13} />
                  {t('add_influencer_code', 'Add Influencer Code')}
                </Button>
              </div>
            </div>

            {affiliateCodes.length === 0 ? (
              <div className="card p-6 text-center border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A] space-y-3">
                <UserCheck size={32} className="mx-auto text-gray-400" />
                <div className="max-w-md mx-auto">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                    {t('no_influencer_codes_yet', 'No Influencer Codes Configured Yet')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('create_first_influencer_desc', 'Create a promo code with an assigned promoter name and commission cut. Influencers can share links to earn a cut on every sale.')}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleOpenCreatePromo('affiliate')}
                  className="font-semibold bg-brand-500 hover:bg-brand-600 text-black shadow-xs text-xs"
                >
                  <Plus size={13} className="mr-1 inline" />
                  {t('create_influencer_code', 'Create Influencer Code')}
                </Button>
              </div>
            ) : filteredAffiliateCodes.length === 0 ? (
              <div className="card p-6 text-center border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A] text-xs text-gray-500 dark:text-gray-400">
                {affiliateStatusFilter === 'expired'
                  ? t('no_expired_affiliates', 'No expired affiliate or partner codes found.')
                  : t('no_active_affiliates', 'No active affiliate or partner codes found.')}
              </div>
            ) : (
              <div className="card overflow-hidden !border-none !rounded-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold border-b border-surface-border dark:border-surface-dark-border">
                      <tr>
                        <th className="p-3 min-w-[240px]">{t('code_and_link', 'Code & Share Link')}</th>
                        <th className="p-3">{t('scope_product', 'Scope / Target')}</th>
                        <th className="p-3">{t('influencer_partner', 'Influencer / Partner')}</th>
                        <th className="p-3">{t('influencer_cut', 'Promoter Cut')}</th>
                        <th className="p-3">{t('buyer_discount', 'Buyer Discount')}</th>
                        <th className="p-3 text-center">{t('redemptions', 'Sales')}</th>
                        <th className="p-3">{t('expiry_date', 'Expiry Date')}</th>
                        <th className="p-3 text-center">{t('status', 'Status')}</th>
                        <th className="p-3 text-center">{t('actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {filteredAffiliateCodes.map((promo: any) => {
                      const isExpired = isPromoExpired(promo);
                      return (
                      <tr key={promo.id} className="hover:bg-surface-muted/40 dark:hover:bg-[#141414] transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-mono font-semibold text-gray-900 dark:text-white text-xs bg-surface-muted dark:bg-[#161616] px-2.5 py-1 rounded w-36 truncate text-center shrink-0 border border-surface-border dark:border-surface-dark-border"
                              title={promo.code}
                            >
                              {promo.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyAffiliateLink(promo)}
                              className="text-brand-600 dark:text-brand-400 hover:text-brand-500 flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 hover:underline px-1 py-0.5 rounded transition"
                              title={t('copy_affiliate_link', 'Copy shareable affiliate link')}
                            >
                              <Share2 size={12} className="shrink-0" />
                              <span>{copiedCode === promo.code ? t('copied', 'Copied!') : t('copy_link', 'Copy Link')}</span>
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          {promo.applicable_scope === 'single_product' ? (
                            <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                              <Package size={12} className="text-brand-500 shrink-0" />
                              <span className="font-medium truncate max-w-[150px]" title={promo.product_name}>
                                {promo.product_name || t('single_product', 'Single Product')}
                              </span>
                              {promo.product_slug && (
                                <a
                                  href={`/product/${promo.product_slug}?ref=${encodeURIComponent(promo.code)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-gray-400 hover:text-brand-500 inline-flex items-center"
                                  title={t('view_product', 'View Product')}
                                >
                                  <ArrowUpRight size={11} />
                                </a>
                              )}
                            </div>
                          ) : promo.applicable_scope === 'specific_products' ? (
                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                              <Package size={12} className="shrink-0" />
                              <span>{promo.products?.length || 0} {t('selected_products', 'Products')}</span>
                            </div>
                          ) : (
                            <span className="text-gray-600 dark:text-gray-400">{t('storewide', 'Storewide')}</span>
                          )}
                        </td>
                        <td className="p-3 font-medium text-gray-900 dark:text-white">
                          {promo.affiliate_name || t('unspecified', 'Unspecified')}
                        </td>
                        <td className="p-3 font-semibold text-brand-600 dark:text-brand-400 font-mono">
                          {promo.commission_type === 'percentage'
                            ? `${parseFloat(promo.commission_rate || '0')}% of Sale`
                            : `TSh ${parseInt(promo.commission_rate || '0', 10).toLocaleString()} / Order`}
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-300 font-mono">
                          {parseFloat(promo.value) > 0 ? (
                            promo.discount_type === 'percentage'
                              ? `${parseFloat(promo.value)}% Off`
                              : `TSh ${parseInt(promo.value, 10).toLocaleString()} Off`
                          ) : (
                            <span className="text-gray-400 font-sans">{t('no_buyer_discount', '0% (Cut only)')}</span>
                          )}
                        </td>
                        <td className="p-3 text-center text-gray-500 dark:text-gray-400">
                          <span className="font-mono">{promo.use_count}</span>
                          <span className="text-[10px] text-gray-400"> / {promo.max_uses || '∞'}</span>
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-300 text-[11px]">
                          {promo.end_date ? (
                            <span className={isExpired ? 'text-red-500 font-semibold' : ''}>
                              {new Date(promo.end_date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">{t('no_expiry', 'No expiry')}</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isExpired ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                              {t('expired', 'Expired')}
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              {promo.is_active ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  {t('active', 'Active')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                  {t('paused', 'Paused')}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleTogglePromoActive(promo.id, promo.is_active)}
                                className="transition inline-flex cursor-pointer mt-0.5"
                                title={promo.is_active ? t('deactivate', 'Deactivate') : t('activate', 'Activate')}
                              >
                                {promo.is_active ? (
                                  <ToggleRight size={22} className="text-brand-500" />
                                ) : (
                                  <ToggleLeft size={22} className="text-gray-300 dark:text-gray-600" />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditPromo(promo)}
                                className="p-1 text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 rounded transition cursor-pointer"
                                title={t('edit_code', 'Edit Code & Settings')}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(promo.code)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition cursor-pointer"
                                title={t('copy_code', 'Copy Code')}
                              >
                                {copiedCode === promo.code ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePromo(promo.id)}
                                className="p-1 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                                title={t('delete', 'Delete')}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
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

          {/* Section 2: Referral Conversions Ledger */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>{t('customer_referrals_ledger', 'Customer Referral Conversions Ledger')}</span>
                  <span className="text-xs font-normal text-gray-400">
                    ({referralConversions.length} {t('conversions', 'conversions')})
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('referrals_ledger_desc', 'Track incoming customers, matching influencer codes, and settle owed promoter cuts.')}
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { key: 'all', label: t('all', 'All') },
                  { key: 'PENDING', label: t('pending', 'Pending') },
                  { key: 'APPROVED', label: t('approved', 'Approved') },
                  { key: 'PAID_OUT', label: t('settled', 'Settled') },
                  { key: 'EXPIRED', label: t('expired', 'Expired') },
                  { key: 'CANCELLED', label: t('cancelled', 'Cancelled') }
                ].map(filter => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => handleFilterStatusChange(filter.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                      referralFilterStatus === filter.key
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold'
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {initialLoading ? (
              <TableSkeleton rows={4} cols={7} />
            ) : referralConversions.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title={t('no_referrals_found', 'No Referral Orders Found')}
                description={
                  referralFilterStatus !== 'all'
                    ? t('no_filtered_referrals', 'No referral conversions match the selected status filter.')
                    : t('no_referrals_yet', 'When customers place orders using influencer codes or links, they will be listed here with calculated commission cuts.')
                }
              />
            ) : (
              <div className="card overflow-hidden !border-none !rounded-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold border-b border-surface-border dark:border-surface-dark-border">
                      <tr>
                        <th className="p-3">{t('customer', 'Customer')}</th>
                        <th className="p-3">{t('influencer_code', 'Influencer / Code')}</th>
                        <th className="p-3">{t('order_ref', 'Order # / Date')}</th>
                        <th className="p-3 text-right">{t('subtotal', 'Order Subtotal')}</th>
                        <th className="p-3 text-right">{t('discount', 'Discount Given')}</th>
                        <th className="p-3 text-right">{t('promoter_cut', 'Promoter Cut')}</th>
                        <th className="p-3 text-center">{t('order_status', 'Order Status')}</th>
                        <th className="p-3 text-center">{t('cut_status', 'Cut Status')}</th>
                        <th className="p-3 text-center">{t('action', 'Action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                      {referralConversions.map((conv: any) => {
                        const isPending = conv.status === 'PENDING';
                        const isApproved = conv.status === 'APPROVED';
                        const isPaid = conv.status === 'PAID_OUT';
                        const isExpired = conv.status === 'EXPIRED' || conv.order_status === 'EXPIRED';
                        const isCancelled = conv.status === 'CANCELLED' && !isExpired;

                        return (
                          <tr key={conv.id} className="hover:bg-surface-muted/40 dark:hover:bg-[#141414] transition-colors">
                            {/* Customer */}
                            <td className="p-3">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {conv.customer_name || conv.customer_username}
                              </div>
                              {conv.customer_phone && (
                                <div className="text-[11px] text-gray-400 font-mono">
                                  {conv.customer_phone}
                                </div>
                              )}
                            </td>

                            {/* Influencer / Code */}
                            <td className="p-3">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {conv.affiliate_name || t('unnamed_affiliate', 'Promoter')}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="font-mono text-[10px] bg-surface-muted dark:bg-[#161616] px-1.5 py-0.2 rounded text-gray-500 dark:text-gray-400">
                                  {conv.promo_code_str}
                                </span>
                              </div>
                            </td>

                            {/* Order # / Date */}
                            <td className="p-3">
                              <div className="font-mono font-medium text-gray-900 dark:text-white">
                                #{conv.order_id}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {new Date(conv.order_date || conv.created_at).toLocaleDateString()}
                              </div>
                            </td>

                            {/* Subtotal */}
                            <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">
                              TSh {Math.round(conv.order_subtotal || 0).toLocaleString()}
                            </td>

                            {/* Discount */}
                            <td className="p-3 text-right font-mono text-gray-500 dark:text-gray-400">
                              {parseFloat(conv.discount_given) > 0
                                ? `TSh ${Math.round(conv.discount_given).toLocaleString()}`
                                : '-'}
                            </td>

                            {/* Promoter Cut */}
                            <td className="p-3 text-right font-mono font-semibold text-brand-600 dark:text-brand-400">
                              TSh {Math.round(conv.commission_earned || 0).toLocaleString()}
                            </td>

                            {/* Order Status */}
                            <td className="p-3 text-center">
                              <span className="font-mono text-[10px] uppercase bg-surface-muted dark:bg-[#161616] px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                {conv.order_status || 'UNKNOWN'}
                              </span>
                            </td>

                            {/* Cut Status */}
                            <td className="p-3 text-center">
                              {isExpired ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  {t('expired', 'Expired')}
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  {t('pending', 'Pending')}
                                </span>
                              ) : isApproved ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  {t('approved', 'Approved')}
                                </span>
                              ) : isPaid ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  {t('settled', 'Settled')}
                                </span>
                              ) : isCancelled ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-500/10 text-neutral-500 border border-neutral-500/20">
                                  {t('cancelled', 'Cancelled')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-500/10 text-neutral-500 border border-neutral-500/20">
                                  {conv.status || 'UNKNOWN'}
                                </span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="p-3 text-center">
                              {!isExpired && (isApproved || isPending) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarkPaid(conv.id)}
                                  className="text-xs h-7 px-2.5 inline-flex items-center gap-1"
                                >
                                  <CheckCircle2 size={12} className="text-emerald-500" />
                                  <span>{t('settle_cut', 'Settle Cut')}</span>
                                </Button>
                              )}
                              {isPaid && (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                                  {conv.payout_reference ? `Ref: ${conv.payout_reference}` : t('settled', 'Settled')}
                                </div>
                              )}
                              {(isCancelled || isExpired) && (
                                <span className="text-[11px] text-gray-400">-</span>
                              )}
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


