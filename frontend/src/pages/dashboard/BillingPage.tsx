import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Receipt, Smartphone, Upload, CheckCircle2, X, Wallet, ArrowDownRight, Truck, Shield, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../../components/ui/Dialogs';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { KpiCard } from '../../components/ui/KpiCard';
import { CardGridSkeleton } from '../../components/Skeleton';

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
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
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
      setInitialLoading(false);
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
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full capitalize">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Paid
          </span>
        );
      case 'PENDING_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full capitalize">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending Review
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-full capitalize">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 rounded-full capitalize">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Unpaid
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('billing_commission', 'Billing & Commission')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('billing_desc', 'Manage your subscriptions, monthly invoices, commission ledger, and logistics payouts.')}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 pt-2">
        {[
          { key: 'subscriptions', label: 'My Subscriptions' },
          { key: 'invoices', label: 'Monthly Invoices' },
          { key: 'ledger', label: 'Commission Ledger' },
          ...(driverPayments.length > 0 ? [{ key: 'driver_payments', label: 'Logistics Costs' }] : []),
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
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

      {activeTab !== 'subscriptions' && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-3 rounded-btn bg-surface-muted/40 dark:bg-[#161616]/40 border border-surface-border dark:border-surface-dark-border">
          <div data-horizontal-scroll="true" className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <Filter size={14} className="text-gray-400 shrink-0 mr-1" />
            {[
              { key: 'all', label: 'All Time' },
              { key: 'this_month', label: 'This Month' },
              { key: 'last_month', label: 'Last Month' },
              { key: 'this_year', label: 'This Year' },
              { key: 'custom', label: 'Custom' },
            ].map((f) => {
              const isSelected = dateFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setDateFilter(f.key as any)}
                  className={`px-2.5 py-1 rounded-full text-2xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="input text-xs py-1 h-auto w-full sm:w-auto" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="input text-xs py-1 h-auto w-full sm:w-auto" />
            </div>
          )}
        </div>
      )}

      {initialLoading ? (
        <CardGridSkeleton count={3} cols={3} />
      ) : (
        <div className={`transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {activeTab === 'subscriptions' ? (
            <div className="space-y-6">
          {subscriptions.length === 0 ? (
            <div className="space-y-6">
              <EmptyState
                icon={Shield}
                title="No Active Seller Subscription"
                description="Choose one of the premium seller plans below to activate your account and access all seller capabilities."
              />

              <div className="space-y-3">
                <h3 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Available subscription plans:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tiers.filter((t: any) => t.tier_level !== 'customer').map((t: any) => (
                    <div key={t.id} className="card p-5 flex flex-col justify-between hover:border-brand-500 transition-all">
                      <div>
                        <h4 className="font-extrabold text-gray-900 dark:text-white capitalize text-sm mb-1">{t.name} Plan</h4>
                        <p className="text-2xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{t.benefits || 'Premium seller features'}</p>
                        <div className="text-lg font-extrabold text-brand-500 dark:text-brand-400 mb-1">TZS {Number(t.price).toLocaleString()}</div>
                        <p className="text-3xs text-gray-400">Duration: {t.duration} Days</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleOpenSubscriptionPayModal({ tier: t })}
                        className="mt-4 w-full font-bold"
                      >
                        Subscribe Now
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {subscriptions.map((sub: any) => (
                <div key={sub.id} className="card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-extrabold text-base text-gray-900 dark:text-white capitalize">
                        {sub.tier?.name || 'Seller'} Plan
                      </h3>
                      {sub.is_expired ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[11px] rounded-full font-medium capitalize">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] rounded-full font-medium capitalize">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                      <p>Started: <span className="font-semibold text-gray-800 dark:text-gray-200">{new Date(sub.start_date).toLocaleDateString()}</span></p>
                      <p>Expires: <span className="font-semibold text-gray-800 dark:text-gray-200">{new Date(sub.end_date).toLocaleDateString()}</span></p>
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end gap-3 w-full md:w-auto">
                    <div>
                      <div className="text-3xs text-gray-400 uppercase font-bold tracking-wider">Renewal Fee</div>
                      <div className="text-lg font-extrabold text-gray-900 dark:text-white">TZS {Number(sub.tier?.price || 0).toLocaleString()}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      {sub.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelSubscription}
                          className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                        >
                          Cancel Subscription
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleOpenSubscriptionPayModal(sub)}
                        className="font-bold"
                      >
                        {sub.is_expired ? 'Renew Now' : 'Pay Renewal Early'}
                      </Button>
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
                  <div className="space-y-3 pt-4 border-t border-surface-border dark:border-surface-dark-border">
                    <h3 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Upgrade Plan:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {availableUpgrades.map((t: any) => (
                        <div key={t.id} className="card p-5 flex flex-col justify-between hover:border-brand-500 transition-all">
                          <div>
                            <h4 className="font-extrabold text-gray-900 dark:text-white capitalize text-sm mb-1">{t.name} Plan</h4>
                            <p className="text-2xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{t.benefits || 'Premium seller features'}</p>
                            <div className="text-lg font-extrabold text-brand-500 dark:text-brand-400 mb-1">TZS {Number(t.price).toLocaleString()}</div>
                            <p className="text-3xs text-gray-400">Duration: {t.duration} Days</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleOpenSubscriptionPayModal({ tier: t })}
                            className="mt-4 w-full font-bold"
                          >
                            Choose Upgrade
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-surface-muted/40 dark:bg-[#161616]/40 border border-surface-border dark:border-surface-dark-border rounded-btn text-center">
                    <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
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
            <EmptyState
              icon={Receipt}
              title="No Invoices Generated Yet"
              description="Monthly commission invoices will appear here after orders are finalized."
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                    <tr>
                      <th className="p-3">Billing Period</th>
                      <th className="p-3 text-right">Orders Value</th>
                      <th className="p-3 text-right">Commission Due</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">
                          {formatMonth(inv.year, inv.month)}
                        </td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-300">
                          TSh {Number(inv.total_order_amount).toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-brand-600 dark:text-brand-400 font-bold">
                          TSh {Number(inv.total_commission).toLocaleString()}
                        </td>
                        <td className="p-3 text-gray-500 dark:text-gray-400">
                          {new Date(inv.due_date).toLocaleDateString()}
                        </td>
                        <td className="p-3">{getStatusBadge(inv.status)}</td>
                        <td className="p-3 text-center">
                          {(inv.status === 'UNPAID' || inv.status === 'OVERDUE') ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPayModal(inv)}
                              className="text-2xs py-0.5 px-2.5 font-bold"
                            >
                              Pay Now
                            </Button>
                          ) : (
                            <span className="text-2xs text-gray-400 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-surface-border dark:border-surface-dark-border flex items-center justify-between bg-surface-muted/30 dark:bg-[#161616]/30">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageInvoices === 1}
                  onClick={() => setPageInvoices(p => Math.max(1, p - 1))}
                  className="text-xs"
                >
                  <ChevronLeft size={14} className="mr-1" /> Previous
                </Button>
                <span className="text-2xs text-gray-400 font-bold">Page {pageInvoices}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMoreInvoices}
                  onClick={() => setPageInvoices(p => p + 1)}
                  className="text-xs"
                >
                  Next <ChevronRight size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'ledger' ? (
        <div className="space-y-4">
          {ledger.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <KpiCard
                label="Total Order Amount"
                value={`TSh ${Number(ledgerTotals?.total_order_amount || ledger.reduce((sum, entry) => sum + Number(entry.order_amount || 0), 0)).toLocaleString()}`}
                icon={Receipt}
              />
              <KpiCard
                label="Total Commission"
                value={`TSh ${Number(ledgerTotals?.total_commission || ledger.reduce((sum, entry) => sum + Number(entry.commission_amount || 0), 0)).toLocaleString()}`}
                icon={Wallet}
                color="#f97316"
              />
            </div>
          )}
          {ledger.length === 0 ? (
            <EmptyState
              icon={ArrowDownRight}
              title="No Ledger Transactions"
              description="Commission deductions and adjustments will be recorded here in real-time."
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Order Amount</th>
                      <th className="p-3 text-right">Rate</th>
                      <th className="p-3 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {ledger.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                        <td className="p-3 text-gray-500 dark:text-gray-400">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">
                          #{entry.order_id}
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-300 font-medium">
                          {entry.entry_type === 'COMMISSION' ? 'Platform Commission' : 'Cancellation Fee'}
                        </td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-300">
                          TSh {Number(entry.order_amount).toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-gray-500 dark:text-gray-400">
                          {Number(entry.commission_rate)}%
                        </td>
                        <td className="p-3 text-right font-bold text-brand-600 dark:text-brand-400">
                          TSh {Number(entry.commission_amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-surface-border dark:border-surface-dark-border flex items-center justify-between bg-surface-muted/30 dark:bg-[#161616]/30">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageLedger === 1}
                  onClick={() => setPageLedger(p => Math.max(1, p - 1))}
                  className="text-xs"
                >
                  <ChevronLeft size={14} className="mr-1" /> Previous
                </Button>
                <span className="text-2xs text-gray-400 font-bold">Page {pageLedger}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMoreLedger}
                  onClick={() => setPageLedger(p => p + 1)}
                  className="text-xs"
                >
                  Next <ChevronRight size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-3.5 rounded-btn bg-blue-500/10 border border-blue-500/20">
            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Truck size={14} /> Logistics & Delivery Costs
            </h4>
            <p className="text-2xs text-gray-600 dark:text-gray-400 leading-relaxed">
              These are the driver compensation costs SokoniMax has incurred fulfilling your orders via our fleet. Note that these delivery fees are automatically deducted from payouts.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <KpiCard
              label="Total Delivery Costs"
              value={`TSh ${Number(driverPaymentsTotals?.total_amount || driverPayments.reduce((sum, dp) => sum + Number(dp.amount), 0)).toLocaleString()}`}
              icon={Truck}
            />
            <KpiCard
              label="Paid to Drivers"
              value={`TSh ${Number(driverPaymentsTotals?.total_paid || driverPayments.filter(dp => dp.is_paid).reduce((sum, dp) => sum + Number(dp.amount), 0)).toLocaleString()}`}
              icon={CheckCircle2}
              color="#10b981"
            />
            <KpiCard
              label="Pending Delivery Costs"
              value={`TSh ${Number(driverPaymentsTotals?.total_unpaid || driverPayments.filter(dp => !dp.is_paid).reduce((sum, dp) => sum + Number(dp.amount), 0)).toLocaleString()}`}
              icon={Wallet}
              color="#f59e0b"
            />
          </div>

          {driverPayments.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No Logistics Costs"
              description="No driver delivery payouts or costs logged yet for fulfilled orders."
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Driver</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Paid At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {driverPayments.map((dp: any) => (
                      <tr key={dp.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                        <td className="p-3 text-gray-500 dark:text-gray-400">
                          {new Date(dp.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">
                          #{dp.shipment_order_id}
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-300 font-medium">
                          {dp.driver_username || 'Third-Party / None'}
                        </td>
                        <td className="p-3 text-right text-gray-900 dark:text-white font-bold">
                          TSh {Number(dp.amount).toLocaleString()}
                        </td>
                        <td className="p-3">
                          {dp.is_paid ? (
                            <span className="px-2 py-0.5 text-3xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full uppercase">Paid</span>
                          ) : (
                            <span className="px-2 py-0.5 text-3xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full uppercase">Unpaid</span>
                          )}
                        </td>
                        <td className="p-3 text-gray-500 dark:text-gray-400">
                          {dp.paid_at ? new Date(dp.paid_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-surface-border dark:border-surface-dark-border flex items-center justify-between bg-surface-muted/30 dark:bg-[#161616]/30">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageDriverPayments === 1}
                  onClick={() => setPageDriverPayments(p => Math.max(1, p - 1))}
                  className="text-xs"
                >
                  <ChevronLeft size={14} className="mr-1" /> Previous
                </Button>
                <span className="text-2xs text-gray-400 font-bold">Page {pageDriverPayments}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMoreDriverPayments}
                  onClick={() => setPageDriverPayments(p => p + 1)}
                  className="text-xs"
                >
                  Next <ChevronRight size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
      )}

      {/* Pay Invoice Modal */}
      {showPayModal && (selectedInvoice || selectedSubscription) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-[#121212] rounded-card max-w-lg w-full overflow-hidden shadow-2xl border border-surface-border dark:border-surface-dark-border animate-scale-in my-8">
            <div className="p-5 border-b border-surface-border dark:border-surface-dark-border flex justify-between items-center bg-surface-muted dark:bg-[#161616]">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wallet className="text-brand-500" size={18} />
                {selectedInvoice ? 'Pay Commission Invoice' : 'Renew Subscription'}
              </h3>
              <button
                onClick={() => { setShowPayModal(false); setSelectedInvoice(null); setSelectedSubscription(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {loadingPaymentData ? (
                <div className="flex justify-center py-12">
                  <Spinner size="md" />
                </div>
              ) : (
                <form onSubmit={handlePaySubmit} className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3.5 rounded-btn bg-brand-500/10 border border-brand-500/20">
                    {selectedInvoice ? (
                      <>
                        <div>
                          <p className="text-3xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">Invoice Period</p>
                          <h4 className="font-extrabold text-gray-900 dark:text-white capitalize text-sm mt-0.5">{formatMonth(selectedInvoice.year, selectedInvoice.month)}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-3xs text-gray-400">Commission Due</p>
                          <p className="font-extrabold text-brand-600 dark:text-brand-400 text-sm mt-0.5">TSh {Number(selectedInvoice.total_commission).toLocaleString()}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-3xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">Subscription</p>
                          <h4 className="font-extrabold text-gray-900 dark:text-white capitalize text-sm mt-0.5">{selectedSubscription?.tier?.name} Plan</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-3xs text-gray-400">Renewal Due</p>
                          <p className="font-extrabold text-brand-600 dark:text-brand-400 text-sm mt-0.5">TSh {Number(selectedSubscription?.tier?.price || 0).toLocaleString()}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <p className="text-2xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                      Pay to these numbers:
                    </p>
                    {adminLipa.length === 0 ? (
                      <p className="text-xs text-amber-500">No official payment numbers configured. Please contact support.</p>
                    ) : (
                      <div className="space-y-2">
                        {adminLipa.map((lipa: any) => (
                          <div key={lipa.id} className="flex items-center gap-3 bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border rounded-btn p-2.5">
                            <div className={`rounded-lg bg-white dark:bg-[#121212] flex items-center justify-center overflow-hidden shrink-0 border border-surface-border dark:border-surface-dark-border ${lipa.network_logo ? 'w-16 h-8' : 'w-8 h-8'}`}>
                              {lipa.network_logo ? (
                                <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                              ) : (
                                <Smartphone size={16} className="text-emerald-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-3xs font-bold text-gray-400 uppercase">{lipa.network_name}</p>
                              <p className="font-mono font-extrabold text-gray-900 dark:text-white text-xs mt-0.5">{lipa.number}</p>
                              <p className="text-3xs text-gray-500">{lipa.name}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { navigator.clipboard.writeText(lipa.number); toast.success('Copied!'); }}
                              className="ml-auto btn-ghost text-3xs py-0.5 px-2 border border-surface-border dark:border-surface-dark-border rounded"
                            >
                              Copy
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Transaction ID / Reference</label>
                      <input
                        type="text"
                        required
                        value={refId}
                        onChange={(e) => setRefId(e.target.value)}
                        placeholder="e.g. PP260618.1746"
                        className="input text-xs py-2 w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Receipt Screenshot</label>
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-surface-border dark:border-surface-dark-border rounded-btn cursor-pointer hover:bg-surface-muted/40 dark:hover:bg-[#161616]/40 transition">
                        <div className="flex flex-col items-center justify-center pt-2 pb-3">
                          <Upload size={18} className="text-gray-400 mb-1" />
                          <p className="text-2xs text-gray-500 dark:text-gray-400 text-center px-4">
                            {proofFile ? proofFile.name : 'Click to upload screenshot proof'}
                          </p>
                        </div>
                        <input type="file" required className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    <Button
                      type="submit"
                      disabled={submittingPayment}
                      className="w-full py-2.5 font-bold flex items-center justify-center gap-2 mt-2"
                    >
                      {submittingPayment ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 size={16} />}
                      Submit Payment Details
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
