import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Receipt, Smartphone, Upload, CheckCircle2, X, Wallet, ArrowDownRight, Truck, Shield, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../../components/ui/Dialogs';

const TIER_RANKS: Record<string, number> = {
  'customer': 1,
  'seller_pro': 2,
  'business': 3
};

const BillingPage: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useDialog();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [driverPayments, setDriverPayments] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices' | 'ledger' | 'driver_payments'>('subscriptions');

  // Filters and Pagination
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const [pageLedger, setPageLedger] = useState(1);
  const [pageInvoices, setPageInvoices] = useState(1);
  const [pageDriverPayments, setPageDriverPayments] = useState(1);
  
  const [hasMoreLedger, setHasMoreLedger] = useState(false);
  const [hasMoreInvoices, setHasMoreInvoices] = useState(false);
  const [hasMoreDriverPayments, setHasMoreDriverPayments] = useState(false);
  
  const [ledgerTotals, setLedgerTotals] = useState<any>(null);
  const [driverPaymentsTotals, setDriverPaymentsTotals] = useState<any>(null);

  // Pay Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [adminLipa, setAdminLipa] = useState<any[]>([]);
  const [loadingPaymentData, setLoadingPaymentData] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [refId, setRefId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const getDatesForPreset = (preset: string) => {
    const now = new Date();
    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    }
    if (preset === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start, end };
    }
    return { start: null, end: null };
  };

  const buildQueryParams = (page: number) => {
    let params = `?page=${page}`;
    let start: Date | null = null;
    let end: Date | null = null;
    
    if (dateFilter === 'custom') {
      if (customStartDate) start = new Date(customStartDate);
      if (customEndDate) end = new Date(customEndDate);
    } else if (dateFilter !== 'all') {
      const dates = getDatesForPreset(dateFilter);
      start = dates.start;
      end = dates.end;
    }

    if (start) {
      params += `&start_date=${start.toISOString().split('T')[0]}`;
    }
    if (end) {
      params += `&end_date=${end.toISOString().split('T')[0]}T23:59:59Z`;
    }
    return params;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const invParams = buildQueryParams(pageInvoices);
      const ledParams = buildQueryParams(pageLedger);
      const dpParams = buildQueryParams(pageDriverPayments) + '&seller_view=true';

      const [invRes, ledRes, dpRes, subRes, tierRes] = await Promise.all([
        api.get(`/api/billing/invoices/${invParams}`),
        api.get(`/api/billing/ledger/${ledParams}`),
        api.get(`/api/logistics/driver-payments/${dpParams}`),
        api.get('/api/subscriptions/me/'),
        api.get('/api/subscription-tiers/').catch(() => ({ data: [] }))
      ]);
      
      setInvoices(invRes.data.results || invRes.data || []);
      setHasMoreInvoices(!!invRes.data.next);

      setLedger(ledRes.data.results || ledRes.data || []);
      setLedgerTotals(ledRes.data.totals || null);
      setHasMoreLedger(!!ledRes.data.next);

      if (subRes.data && subRes.data.status !== 'none') {
        setSubscriptions([subRes.data]);
      } else {
        setSubscriptions([]);
      }
      setTiers(tierRes.data.results || tierRes.data || []);

      const paymentsList = dpRes.data.results || dpRes.data || [];
      setDriverPayments(paymentsList);
      setDriverPaymentsTotals(dpRes.data.totals || null);
      setHasMoreDriverPayments(!!dpRes.data.next);

    } catch {
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }, [pageInvoices, pageLedger, pageDriverPayments, dateFilter, customStartDate, customEndDate]);

  // When filters change, reset all pages to 1
  useEffect(() => {
    setPageInvoices(1);
    setPageLedger(1);
    setPageDriverPayments(1);
  }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenPayModal = async (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowPayModal(true);
    setLoadingPaymentData(true);
    try {
      const res = await api.get('/api/lipa-numbers/?is_system=true&purpose=commissions');
      let numbers = res.data.results || res.data || [];
      if (numbers.length === 0) {
        const fallbackRes = await api.get('/api/lipa-numbers/?is_system=true&purpose=general');
        numbers = fallbackRes.data.results || fallbackRes.data || [];
      }
      setAdminLipa(numbers);
    } catch {
      toast.error('Failed to load payment options');
    } finally {
      setLoadingPaymentData(false);
    }
  };

  const handleOpenSubscriptionPayModal = async (subOrTier: any) => {
    setSelectedSubscription(subOrTier);
    setShowPayModal(true);
    setLoadingPaymentData(true);
    try {
      const res = await api.get('/api/lipa-numbers/?is_system=true&purpose=subscriptions');
      let numbers = res.data.results || res.data || [];
      if (numbers.length === 0) {
        const fallbackRes = await api.get('/api/lipa-numbers/?is_system=true&purpose=general');
        numbers = fallbackRes.data.results || fallbackRes.data || [];
      }
      setAdminLipa(numbers);
    } catch {
      toast.error('Failed to load payment options');
    } finally {
      setLoadingPaymentData(false);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice && !selectedSubscription) return;
    if (!refId) return toast.error('Please enter the transaction reference');
    if (!proofFile) return toast.error('Please upload proof of payment screenshot');

    setSubmittingPayment(true);
    const fd = new FormData();

    try {
      if (selectedInvoice) {
        fd.append('amount', selectedInvoice.total_commission);
        fd.append('transaction_id', refId);
        fd.append('receipt_screenshot', proofFile);
        await api.post(`/api/billing/${selectedInvoice.id}/pay_invoice/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Commission payment submitted successfully! Staff will verify it shortly.');
      } else if (selectedSubscription) {
        fd.append('amount', selectedSubscription.tier.price);
        fd.append('reference', refId);
        fd.append('proof', proofFile);
        fd.append('tier', selectedSubscription.tier.id);
        await api.post(`/api/subscription-payments/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Subscription renewal payment submitted successfully! Staff will verify it shortly.');
      }
      
      setShowPayModal(false);
      setRefId('');
      setProofFile(null);
      setSelectedInvoice(null);
      setSelectedSubscription(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit payment details');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = await showConfirm(
      t('cancel_sub_confirm', 'Are you sure you want to cancel your subscription? You will lose seller access immediately.'),
      t('cancel_sub_title', 'Cancel Subscription')
    );
    if (!confirmed) {
      return;
    }
    try {
      await api.post('/api/subscriptions/cancel/');
      toast.success("Subscription cancelled successfully.");
      localStorage.setItem('tier', 'customer');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || "Failed to cancel subscription.");
    }
  };

  const formatMonth = (year: number, month: number) => {
    const date = new Date(year, month - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full uppercase">Paid</span>;
      case 'PENDING_REVIEW':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full uppercase">Pending Review</span>;
      case 'OVERDUE':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full uppercase">Overdue</span>;
      default:
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full uppercase">Unpaid</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="text-brand-600" size={24} /> Billing & Commission
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage your platform fees, commission ledger, and monthly payouts.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`py-3.5 border-b-2 text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'subscriptions'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            My Subscriptions
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-3.5 border-b-2 text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'invoices'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Monthly Invoices
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`py-3.5 border-b-2 text-sm font-bold transition-all ${
              activeTab === 'ledger'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Commission Ledger
          </button>
          {driverPayments.length > 0 && (
            <button
              onClick={() => setActiveTab('driver_payments')}
              className={`py-3.5 border-b-2 text-sm font-bold transition-all ${
                activeTab === 'driver_payments'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Logistics Costs
            </button>
          )}
        </nav>
      </div>

      {activeTab !== 'subscriptions' && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
            <Filter size={16} className="text-gray-400 shrink-0" />
            <button onClick={() => setDateFilter('all')} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${dateFilter === 'all' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}>All Time</button>
            <button onClick={() => setDateFilter('this_month')} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${dateFilter === 'this_month' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}>This Month</button>
            <button onClick={() => setDateFilter('last_month')} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${dateFilter === 'last_month' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}>Last Month</button>
            <button onClick={() => setDateFilter('this_year')} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${dateFilter === 'this_year' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}>This Year</button>
            <button onClick={() => setDateFilter('custom')} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${dateFilter === 'custom' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}>Custom</button>
          </div>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="input text-xs py-1.5 h-auto w-full sm:w-auto" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="input text-xs py-1.5 h-auto w-full sm:w-auto" />
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : activeTab === 'subscriptions' ? (
        <div className="space-y-4">
          {subscriptions.length === 0 ? (
            <div className="space-y-6">
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm">
                <Shield size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 font-medium mb-1">You don't have an active seller subscription.</p>
                <p className="text-xs text-gray-400">Choose one of the premium plans below to activate your account and start selling.</p>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Available subscription plans:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tiers.filter((t: any) => t.tier_level !== 'customer').map((t: any) => (
                    <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:border-brand-500 transition-all flex flex-col justify-between">
                      <div>
                        <h4 className="font-black text-gray-900 dark:text-white capitalize text-sm mb-1">{t.name} Plan</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{t.benefits || 'Premium seller features'}</p>
                        <div className="text-lg font-black text-brand-600 dark:text-brand-400 mb-1">TZS {Number(t.price).toLocaleString()}</div>
                        <p className="text-[10px] text-gray-400">Duration: {t.duration} Days</p>
                      </div>
                      <button
                        onClick={() => handleOpenSubscriptionPayModal({ tier: t })}
                        className="btn-primary py-2 px-4 mt-4 w-full rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                      >
                        Subscribe Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {subscriptions.map((sub: any) => (
                <div key={sub.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                      <span className="capitalize">{sub.tier?.name || 'Unknown Tier'}</span> Plan
                      {sub.is_expired ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs rounded-full uppercase tracking-wider font-bold">Expired</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs rounded-full uppercase tracking-wider font-bold">Active</span>
                      )}
                    </h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                      <p>Started: <span className="font-semibold text-gray-900 dark:text-gray-300">{new Date(sub.start_date).toLocaleDateString()}</span></p>
                      <p>Expires: <span className="font-semibold text-gray-900 dark:text-gray-300">{new Date(sub.end_date).toLocaleDateString()}</span></p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 text-right w-full md:w-auto">
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Renewal Due</div>
                      <div className="text-xl font-black text-gray-900 dark:text-white">TZS {Number(sub.tier?.price || 0).toLocaleString()}</div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto justify-end">
                      {sub.is_active && (
                        <button
                          onClick={handleCancelSubscription}
                          className="py-2 px-4 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                        >
                          Cancel Subscription
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenSubscriptionPayModal(sub)}
                        className={`btn-primary py-2 px-6 rounded-lg text-xs font-bold shadow-md w-full md:w-auto ${
                          sub.is_expired ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20' : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20'
                        }`}
                      >
                        {sub.is_expired ? 'Renew Now' : 'Pay Renewal Early'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {(() => {
                const activeSub = subscriptions.find(sub => !sub.is_expired && sub.is_active);
                const currentTierLevel = activeSub?.tier?.tier_level || 'customer';
                const currentRank = TIER_RANKS[currentTierLevel] || 1;

                const availableUpgrades = tiers.filter((t: any) => {
                  const rank = TIER_RANKS[t.tier_level] || 1;
                  return rank > currentRank && t.tier_level !== 'customer';
                });

                return availableUpgrades.length > 0 ? (
                  <div className="space-y-3 pt-4 border-t dark:border-gray-700">
                    <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Upgrade Plan:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {availableUpgrades.map((t: any) => (
                        <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:border-brand-500 transition-all flex flex-col justify-between">
                          <div>
                            <h4 className="font-black text-gray-900 dark:text-white capitalize text-sm mb-1">{t.name} Plan</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{t.benefits || 'Premium seller features'}</p>
                            <div className="text-lg font-black text-brand-600 dark:text-brand-400 mb-1">TZS {Number(t.price).toLocaleString()}</div>
                            <p className="text-[10px] text-gray-400">Duration: {t.duration} Days</p>
                          </div>
                          <button
                            onClick={() => handleOpenSubscriptionPayModal({ tier: t })}
                            className="btn-primary py-2 px-4 mt-4 w-full rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                          >
                            Choose Upgrade
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/30 rounded-xl text-center">
                    <p className="text-sm font-semibold text-brand-800 dark:text-brand-400">
                      You are subscribed to our highest tier plan (Business). Thank you for being a premium partner!
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : activeTab === 'invoices' ? (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
              <Receipt size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">No invoices generated yet.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">
                      <th className="p-4">Billing Period</th>
                      <th className="p-4 text-right">Orders Value</th>
                      <th className="p-4 text-right">Commission Due</th>
                      <th className="p-4">Due Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                        <td className="p-4 font-bold text-gray-900 dark:text-white">
                          {formatMonth(inv.year, inv.month)}
                        </td>
                        <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                          TSh {Number(inv.total_order_amount).toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-brand-600 font-bold">
                          TSh {Number(inv.total_commission).toLocaleString()}
                        </td>
                        <td className="p-4 text-gray-500 dark:text-gray-400">
                          {new Date(inv.due_date).toLocaleDateString()}
                        </td>
                        <td className="p-4">{getStatusBadge(inv.status)}</td>
                        <td className="p-4 text-center">
                          {(inv.status === 'UNPAID' || inv.status === 'OVERDUE') ? (
                            <button
                              onClick={() => handleOpenPayModal(inv)}
                              className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded font-bold transition text-[11px]"
                            >
                              Pay Now
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <button
                  disabled={pageInvoices === 1}
                  onClick={() => setPageInvoices(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">Page {pageInvoices}</span>
                <button
                  disabled={!hasMoreInvoices}
                  onClick={() => setPageInvoices(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'ledger' ? (
        <div className="space-y-4">
          {ledger.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                  <Receipt size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Order Amount</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white mt-1">
                    TSh {Number(ledgerTotals?.total_order_amount || ledger.reduce((sum, entry) => sum + Number(entry.order_amount || 0), 0)).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-lg">
                  <Wallet size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Commission</p>
                  <p className="text-xl font-black text-brand-600 mt-1">
                    TSh {Number(ledgerTotals?.total_commission || ledger.reduce((sum, entry) => sum + Number(entry.commission_amount || 0), 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          {ledger.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
              <ArrowDownRight size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">No ledger transactions recorded.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">
                      <th className="p-4">Date</th>
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Type</th>
                      <th className="p-4 text-right">Order Amount</th>
                      <th className="p-4 text-right">Rate</th>
                      <th className="p-4 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {ledger.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                        <td className="p-4 text-gray-500 dark:text-gray-400">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 font-bold text-gray-900 dark:text-white">
                          #{entry.order_id}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">
                          {entry.entry_type === 'COMMISSION' ? 'Platform Commission' : 'Cancellation Fee'}
                        </td>
                        <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                          TSh {Number(entry.order_amount).toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-gray-500 dark:text-gray-400">
                          {Number(entry.commission_rate)}%
                        </td>
                        <td className="p-4 text-right font-bold text-brand-600">
                          TSh {Number(entry.commission_amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <button
                  disabled={pageLedger === 1}
                  onClick={() => setPageLedger(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">Page {pageLedger}</span>
                <button
                  disabled={!hasMoreLedger}
                  onClick={() => setPageLedger(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-50/50 dark:bg-blue-950/15 border border-blue-100/50 dark:border-blue-900/30 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Truck size={14} /> Logistics & Delivery Costs
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              These are the driver compensation costs SokoniMax has incurred fulfilling your orders via our fleet. Note that these delivery fees are automatically deducted from the payout or charged to your account.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-lg">
                <Truck size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Delivery Costs</p>
                <p className="text-xl font-black text-gray-900 dark:text-white mt-1">TSh {Number(driverPaymentsTotals?.total_amount || driverPayments.reduce((sum, dp) => sum + Number(dp.amount), 0)).toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Paid to Drivers</p>
                <p className="text-xl font-black text-green-600 mt-1">TSh {Number(driverPaymentsTotals?.total_paid || driverPayments.filter(dp => dp.is_paid).reduce((sum, dp) => sum + Number(dp.amount), 0)).toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg">
                <Wallet size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pending Delivery Costs</p>
                <p className="text-xl font-black text-amber-600 mt-1">TSh {Number(driverPaymentsTotals?.total_unpaid || driverPayments.filter(dp => !dp.is_paid).reduce((sum, dp) => sum + Number(dp.amount), 0)).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {driverPayments.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
              <Truck size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3 animate-pulse" />
              <p className="text-gray-500">No delivery costs or driver payments logged yet.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">
                      <th className="p-4">Date</th>
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Driver</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Paid At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {driverPayments.map((dp: any) => (
                      <tr key={dp.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                        <td className="p-4 text-gray-500 dark:text-gray-400">
                          {new Date(dp.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 font-bold text-gray-900 dark:text-white">
                          #{dp.shipment_order_id}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">
                          {dp.driver_username || 'Third-Party / None'}
                        </td>
                        <td className="p-4 text-right text-gray-900 dark:text-white font-bold">
                          TSh {Number(dp.amount).toLocaleString()}
                        </td>
                        <td className="p-4">
                          {dp.is_paid ? (
                            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full uppercase">Paid</span>
                          ) : (
                            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full uppercase">Unpaid</span>
                          )}
                        </td>
                        <td className="p-4 text-gray-500 dark:text-gray-400">
                          {dp.paid_at ? new Date(dp.paid_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <button
                  disabled={pageDriverPayments === 1}
                  onClick={() => setPageDriverPayments(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">Page {pageDriverPayments}</span>
                <button
                  disabled={!hasMoreDriverPayments}
                  onClick={() => setPageDriverPayments(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pay Invoice Modal */}
      {showPayModal && (selectedInvoice || selectedSubscription) && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border dark:border-gray-700 animate-scale-in my-8">
            <button
              onClick={() => { setShowPayModal(false); setSelectedInvoice(null); setSelectedSubscription(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">
              {selectedInvoice ? 'Pay Commission Invoice' : 'Renew Subscription'}
            </h3>

            {loadingPaymentData ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
              </div>
            ) : (
              <form onSubmit={handlePaySubmit} className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30 rounded-xl">
                  {selectedInvoice ? (
                    <>
                      <div>
                        <p className="text-xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider leading-none">Invoice Period</p>
                        <h4 className="font-black text-gray-900 dark:text-white capitalize text-sm mt-1">{formatMonth(selectedInvoice.year, selectedInvoice.month)}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 leading-none">Commission Due</p>
                        <p className="font-black text-brand-600 text-sm mt-1">TSh {Number(selectedInvoice.total_commission).toLocaleString()}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider leading-none">Subscription</p>
                        <h4 className="font-black text-gray-900 dark:text-white capitalize text-sm mt-1">{selectedSubscription?.tier?.name} Plan</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 leading-none">Renewal Due</p>
                        <p className="font-black text-brand-600 text-sm mt-1">TSh {Number(selectedSubscription?.tier?.price || 0).toLocaleString()}</p>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                    Pay to these numbers:
                  </p>
                  {adminLipa.length === 0 ? (
                    <p className="text-xs text-yellow-600">No official payment numbers configured. Please contact support.</p>
                  ) : (
                    <div className="space-y-2">
                      {adminLipa.map((lipa: any) => (
                        <div key={lipa.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5">
                          <div className={`rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 ${lipa.network_logo ? 'w-16 h-8' : 'w-8 h-8'}`}>
                            {lipa.network_logo ? (
                              <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                            ) : (
                              <Smartphone size={16} className="text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">{lipa.network_name}</p>
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

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Transaction ID / Reference</label>
                    <input
                      type="text"
                      required
                      value={refId}
                      onChange={(e) => setRefId(e.target.value)}
                      placeholder="e.g. PP260618.1746"
                      className="input text-sm h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Receipt Screenshot</label>
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
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                  >
                    {submittingPayment ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 size={18} />}
                    Submit Payment Details
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
