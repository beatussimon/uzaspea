import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  Check, 
  Upload, 
  X, 
  Clock, 
  Copy, 
  CheckCircle2,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import { useAuth } from '../../context/AuthContext';

export const SubscriptionExpiredView: React.FC = () => {
  const { user, logout } = useAuth();

  const [tiers, setTiers] = useState<any[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [showPlansAnyway, setShowPlansAnyway] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal payment state
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [adminLipa, setAdminLipa] = useState<any[]>([]);
  const [loadingPaymentData, setLoadingPaymentData] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [refId, setRefId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    toast.success('Number copied to clipboard');
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tiersRes, invoicesRes, paymentsRes] = await Promise.allSettled([
        api.get('/api/subscription-tiers/'),
        api.get('/api/billing/invoices/?status=unpaid'),
        api.get('/api/subscription-payments/')
      ]);

      if (tiersRes.status === 'fulfilled') {
        const rawTiers = tiersRes.value.data.results || tiersRes.value.data || [];
        setTiers(rawTiers.filter((t: any) => t.is_active && ['seller_pro', 'business'].includes(t.tier_level)));
      }

      if (invoicesRes.status === 'fulfilled') {
        const rawInvoices = invoicesRes.value.data.results || invoicesRes.value.data || [];
        setUnpaidInvoices(rawInvoices);
      }

      if (paymentsRes.status === 'fulfilled') {
        const rawPayments = paymentsRes.value.data.results || paymentsRes.value.data || [];
        const pending = rawPayments.find((p: any) => p.status === 'pending');
        setPendingPayment(pending || null);
      }
    } catch {
      toast.error('Failed to load renewal options');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCheckStatus = async () => {
    setRefreshingStatus(true);
    try {
      await fetchData();
      const profileRes = await api.get('/api/users/profile/').catch(() => null);
      if (profileRes && profileRes.data && profileRes.data.subscription_active) {
        toast.success('Your subscription is active! Reloading...');
        setTimeout(() => {
          window.location.reload();
        }, 600);
        return;
      }
      toast.success('Status updated');
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleOpenTierPayModal = async (tier: any) => {
    setSelectedTier(tier);
    setSelectedInvoice(null);
    setShowPayModal(true);
    setLoadingPaymentData(true);
    try {
      const res = await api.get('/api/lipa-numbers/?is_system=true&purpose=subscriptions');
      let numbers = res.data.results || res.data || [];
      if (numbers.length === 0) {
        const fallbackRes = await api.get('/api/lipa-numbers/?is_system=true&purpose=general');
        numbers = fallbackRes.data.results || fallbackRes.data || [];
      }
      if (numbers.length === 0) {
        const fallbackAll = await api.get('/api/lipa-numbers/?is_system=true');
        numbers = fallbackAll.data.results || fallbackAll.data || [];
      }
      setAdminLipa(numbers);
    } catch {
      toast.error('Failed to load payment numbers');
    } finally {
      setLoadingPaymentData(false);
    }
  };

  const handleOpenInvoicePayModal = async (inv: any) => {
    setSelectedInvoice(inv);
    setSelectedTier(null);
    setShowPayModal(true);
    setLoadingPaymentData(true);
    try {
      const res = await api.get('/api/lipa-numbers/?is_system=true&purpose=commissions');
      let numbers = res.data.results || res.data || [];
      if (numbers.length === 0) {
        const fallbackRes = await api.get('/api/lipa-numbers/?is_system=true&purpose=general');
        numbers = fallbackRes.data.results || fallbackRes.data || [];
      }
      if (numbers.length === 0) {
        const fallbackAll = await api.get('/api/lipa-numbers/?is_system=true');
        numbers = fallbackAll.data.results || fallbackAll.data || [];
      }
      setAdminLipa(numbers);
    } catch {
      toast.error('Failed to load payment numbers');
    } finally {
      setLoadingPaymentData(false);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier && !selectedInvoice) return;
    if (!refId.trim()) return toast.error('Please enter the transaction reference');
    if (!proofFile) return toast.error('Please upload proof of payment screenshot');

    setSubmittingPayment(true);
    const fd = new FormData();

    try {
      if (selectedTier) {
        fd.append('amount', selectedTier.price);
        fd.append('reference', refId.trim().toUpperCase());
        fd.append('proof', proofFile);
        fd.append('tier', selectedTier.id);
        await api.post('/api/subscription-payments/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Payment submitted! Awaiting verification.');
      } else if (selectedInvoice) {
        fd.append('amount', selectedInvoice.total_commission);
        fd.append('transaction_id', refId.trim().toUpperCase());
        fd.append('receipt_screenshot', proofFile);
        await api.post(`/api/billing/${selectedInvoice.id}/pay_invoice/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Invoice payment submitted successfully!');
      }

      setShowPayModal(false);
      setRefId('');
      setProofFile(null);
      setSelectedTier(null);
      setSelectedInvoice(null);
      setShowPlansAnyway(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit payment details');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const totalUnpaidAmount = unpaidInvoices.reduce(
    (sum, inv) => sum + (parseFloat(inv.total_commission) || 0), 
    0
  );

  const previousTierLevel = user?.last_tier || 'seller_pro';

  // State 1: Seller has already submitted payment proof and is waiting for review
  if (pendingPayment && !showPlansAnyway) {
    return (
      <div className="w-full flex flex-col items-center pt-6 sm:pt-10 pb-16 px-4">
        <div className="w-full max-w-md mx-auto flex flex-col items-center">

          {/* Giant Clock Waiting Icon */}
          <Clock size={52} className="text-neutral-500 dark:text-neutral-300 stroke-[1.5] mb-4" />

          {/* Title & Description */}
          <div className="text-center space-y-2 mb-6">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Your payment is being verified
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
              We have received your payment submission. Staff are verifying the transaction to restore your seller dashboard.
            </p>
          </div>

          {/* Summary Card */}
          <div className="w-full p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800/80">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Plan
              </span>
              <span className="text-xs font-bold text-neutral-900 dark:text-white">
                {pendingPayment.tier_name || 'Seller Plan'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800/80">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Amount Paid
              </span>
              <span className="text-xs font-bold text-neutral-900 dark:text-white">
                TZS {Number(pendingPayment.amount).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800/80">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Reference ID
              </span>
              <span className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200 select-all">
                {pendingPayment.reference}
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Status
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Awaiting Verification
              </span>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={refreshingStatus}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <RefreshCw size={13} className={refreshingStatus ? 'animate-spin' : ''} />
                <span>{refreshingStatus ? 'Checking Status...' : 'Check Status'}</span>
              </button>
            </div>
          </div>

          {/* Option to change plan if needed */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowPlansAnyway(true)}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition underline underline-offset-4"
            >
              Submit another payment or change plan
            </button>
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between w-full pt-8 mt-4 text-xs">
            <Link 
              to="/" 
              className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              ← Return to Marketplace
            </Link>
            <button 
              type="button"
              onClick={logout} 
              className="text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 transition-colors font-medium"
            >
              Sign Out
            </button>
          </div>

        </div>
      </div>
    );
  }

  // State 2: Seller needs to choose and pay for a plan
  return (
    <div className="w-full flex flex-col items-center pt-4 sm:pt-6 pb-16 px-4">
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center">

        {/* Back to pending button (if user chose to view plans while pending) */}
        {pendingPayment && showPlansAnyway && (
          <div className="w-full mb-4 flex justify-start">
            <button
              type="button"
              onClick={() => setShowPlansAnyway(false)}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition"
            >
              <ArrowLeft size={13} />
              <span>Back to pending verification</span>
            </button>
          </div>
        )}

        {/* Top Expired Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 mb-3">
          <Clock size={13} className="text-neutral-400" />
          <span>Subscription Expired</span>
        </div>

        {/* Header */}
        <div className="text-center space-y-1.5 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Renew your seller plan
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            Your product listings and orders are preserved. Choose a plan to restore full access to your seller dashboard.
          </p>
        </div>

        {/* Unpaid Invoice Notice (If Any) */}
        {unpaidInvoices.length > 0 && (
          <div className="w-full mb-4 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] flex items-center justify-between gap-4 text-xs">
            <div>
              <span className="font-semibold text-neutral-900 dark:text-white">
                Pending Invoices ({unpaidInvoices.length})
              </span>
              <span className="text-neutral-400 ml-2">
                TZS {totalUnpaidAmount.toLocaleString()}
              </span>
            </div>
            <button 
              type="button"
              onClick={() => handleOpenInvoicePayModal(unpaidInvoices[0])}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white transition"
            >
              Pay Invoice
            </button>
          </div>
        )}

        {/* Plan Cards Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="w-full p-8 text-center text-xs text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900">
            No seller plans available at this time. Please contact support.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {tiers.map((tier) => {
              const isPro = tier.tier_level === 'seller_pro';
              const isPreviousPlan = tier.tier_level === previousTierLevel;

              return (
                <div 
                  key={tier.id} 
                  className={`rounded-2xl p-6 flex flex-col justify-between transition-all ${
                    isPreviousPlan
                      ? 'bg-white dark:bg-neutral-900/90 border-2 border-neutral-900 dark:border-white'
                      : 'bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                        {tier.name}
                      </h3>
                      {isPreviousPlan ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-200">
                          Previous Plan
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-400">
                          {tier.duration || 30} days
                        </span>
                      )}
                    </div>

                    <div className="mt-3 mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                          TZS {Number(tier.price).toLocaleString()}
                        </span>
                        <span className="text-xs text-neutral-400 font-normal">/ 30 days</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400 mb-6">
                      {isPro ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-neutral-900 dark:text-neutral-200 shrink-0" />
                            <span>Marketplace product listings</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-neutral-900 dark:text-neutral-200 shrink-0" />
                            <span>Order tracking & customer management</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-neutral-900 dark:text-neutral-200 shrink-0" />
                            <span>Storefront QR & seller analytics</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-neutral-900 dark:text-neutral-200 shrink-0" />
                            <span>All Seller Pro features</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-neutral-900 dark:text-neutral-200 shrink-0" />
                            <span>Point of Sale (POS) receipt printing</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check size={14} className="text-neutral-900 dark:text-neutral-200 shrink-0" />
                            <span>Multi-user team & worker roles</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => handleOpenTierPayModal(tier)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold tracking-wide transition-all active:scale-[0.98] ${
                        isPreviousPlan
                          ? 'bg-neutral-900 hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900'
                          : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-white'
                      }`}
                    >
                      Renew {tier.name}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between w-full pt-8 mt-2 text-xs">
          <Link 
            to="/" 
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            ← Return to Marketplace
          </Link>
          <button 
            type="button"
            onClick={logout} 
            className="text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>

      </div>

      {/* Direct Lipa Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 w-full max-w-md p-6 rounded-2xl shadow-2xl relative">
            <button 
              type="button"
              onClick={() => {
                setShowPayModal(false);
                setSelectedTier(null);
                setSelectedInvoice(null);
              }}
              className="absolute top-4 right-4 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-white rounded-lg transition"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              {selectedTier ? `Renew ${selectedTier.name}` : `Pay Invoice #${selectedInvoice?.invoice_number || selectedInvoice?.id}`}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Amount Due:{' '}
              <span className="font-bold text-neutral-900 dark:text-white">
                TZS {Number(selectedTier?.price || selectedInvoice?.total_commission || 0).toLocaleString()}
              </span>
            </p>            
            
            {/* Lipa Accounts */}
            <div className="mt-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                OFFICIAL PAYMENT ACCOUNTS
              </span>
              {loadingPaymentData ? (
                <div className="py-3 flex justify-center"><Spinner size="sm" /></div>
              ) : adminLipa.length === 0 ? (
                <span className="text-xs text-neutral-400 py-1 block">No payment accounts configured. Please contact support.</span>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                  {adminLipa.map((lipa) => (
                    <div key={lipa.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {lipa.network_logo && (
                          <img src={lipa.network_logo} alt={lipa.network_name} className="w-6 h-6 object-contain rounded shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="font-semibold text-xs block text-neutral-900 dark:text-white truncate">
                            {lipa.name || lipa.network_name || 'Mobile Money'}
                          </span>
                          <span className="text-[10px] text-neutral-400 uppercase">
                            {lipa.network_name || 'Mobile Money'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyNumber(lipa.number)}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200 hover:text-neutral-500 transition shrink-0"
                        title="Click to copy"
                      >
                        <span>{lipa.number}</span>
                        {copiedNumber === lipa.number ? (
                          <CheckCircle2 size={13} className="text-emerald-500" />
                        ) : (
                          <Copy size={13} className="text-neutral-400" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handlePaySubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Transaction Reference ID / SMS Code *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 9JA76XTR12"
                  value={refId}
                  onChange={(e) => setRefId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono uppercase bg-neutral-50 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:outline-none focus:ring-0 focus:border-neutral-500 text-neutral-900 dark:text-white placeholder:normal-case placeholder:font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Proof of Payment Screenshot *
                </label>
                <label className="flex items-center justify-between px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#1a1a1a] hover:border-neutral-300 dark:hover:border-neutral-700 cursor-pointer transition text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Upload size={14} className="text-neutral-400 shrink-0" />
                    <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                      {proofFile ? proofFile.name : 'Upload Screenshot (PNG, JPG)'}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase shrink-0 ml-2">Browse</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    required
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)} 
                    className="hidden" 
                  />
                </label>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button" 
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition" 
                  onClick={() => {
                    setShowPayModal(false);
                    setSelectedTier(null);
                    setSelectedInvoice(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submittingPayment || !refId.trim() || !proofFile} 
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5"
                >
                  {submittingPayment ? <Spinner size="sm" /> : 'Submit Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SubscriptionExpiredView;
