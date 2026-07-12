import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { ShieldCheck, ArrowRight, Upload, AlertCircle, Clock, CheckCircle, RefreshCw, Phone, MessageCircle, Mail } from 'lucide-react';

const SellerUpgradePage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  
  const [selectedTier, setSelectedTier] = useState<'seller_pro' | 'business'>('seller_pro');
  const [businessName, setBusinessName] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessRegion, setBusinessRegion] = useState('');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [businessDocument, setBusinessDocument] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  
  const [application, setApplication] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [siteSettings, setSiteSettings] = useState<any>({});
  const [subscription, setSubscription] = useState<any>(null);
  const [lipaNumbers, setLipaNumbers] = useState<any[]>([]);
  const [paymentConfirmations, setPaymentConfirmations] = useState<any[]>([]);
  const [refId, setRefId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);


  const fetchSiteSettings = async () => {
    try {
      const res = await api.get('/api/site-settings/');
      setSiteSettings(res.data);
    } catch (err) {
      console.error('Failed to load site settings', err);
    }
  };

  const fetchTiers = async () => {
    setIsLoadingTiers(true);
    try {
      const res = await api.get('/api/subscription-tiers/');
      setTiers(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load subscription tiers', err);
    } finally {
      setIsLoadingTiers(false);
    }
  };

  const getTierPrice = (tierLevel: string, defaultPrice: string | null) => {
    const tier = tiers.find(t => t.tier_level === tierLevel);
    if (!tier) return defaultPrice;
    return `TZS ${Number(tier.price).toLocaleString()}`;
  };

  const getTierCommission = (tierLevel: string, defaultCommission: string) => {
    const tier = tiers.find(t => t.tier_level === tierLevel);
    if (!tier) return defaultCommission;
    return `${parseFloat(tier.commission_rate)}%`;
  };

  const fetchApplicationStatus = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.get('/api/seller-applications/me/');
      if (res.data && res.data.status === 'none') {
        setApplication(null);
      } else {
        setApplication(res.data);
      }
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        setApplication(null);
      } else {
        toast.error('Failed to load application status');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionStatus = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/api/subscriptions/me/');
      if (res.data && res.data.status !== 'none') {
        setSubscription(res.data);
        if (!res.data.is_active) {
          fetchLipaNumbers();
          fetchPaymentConfirmations();
        }
      } else {
        setSubscription(null);
      }
    } catch (err) {
      console.error('Failed to load subscription status', err);
    }
  };

  const fetchLipaNumbers = async () => {
    try {
      const res = await api.get('/api/lipa-numbers/?system=true&purpose=subscriptions');
      setLipaNumbers(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load Lipa numbers', err);
    }
  };

  const fetchPaymentConfirmations = async () => {
    try {
      const res = await api.get('/api/subscription-payments/');
      setPaymentConfirmations(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load payment confirmations', err);
    }
  };

  useEffect(() => {
    fetchApplicationStatus();
    fetchTiers();
    fetchSiteSettings();
    fetchSubscriptionStatus();
  }, [isAuthenticated]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please log in to apply.');
      return;
    }
    if (!idDocument) {
      toast.error('ID Document image is required.');
      return;
    }

    const targetTier = tiers.find(t => t.tier_level === selectedTier);
    if (!targetTier) {
      toast.error('Selected subscription tier is not available.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('requested_tier', targetTier.id.toString());
    formData.append('business_name', businessName);
    formData.append('business_registration_number', businessRegNumber);
    formData.append('tin_number', tinNumber);
    formData.append('business_address', businessAddress);
    formData.append('business_region', businessRegion);
    formData.append('id_document', idDocument);
    if (businessDocument) {
      formData.append('business_document', businessDocument);
    }

    try {
      await api.post('/api/seller-applications/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Application submitted successfully!');
      fetchApplicationStatus();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to submit application';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReapply = () => {
    setApplication(null);
    setBusinessName('');
    setIdDocument(null);
    setBusinessDocument(null);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeRenewalTier = tiers.find(t => t.tier_level === selectedTier) || (subscription && subscription.tier);
    if (!activeRenewalTier) {
      toast.error('Could not determine plan details');
      return;
    }
    if (!refId.trim()) return toast.error('Please enter transaction reference ID');
    if (!proofFile) return toast.error('Please upload a screenshot proof of payment');

    setSubmittingPayment(true);
    const fd = new FormData();
    fd.append('amount', activeRenewalTier.price);
    fd.append('reference', refId);
    fd.append('proof', proofFile);
    fd.append('tier', activeRenewalTier.id.toString());

    try {
      await api.post('/api/subscription-payments/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Subscription renewal submitted successfully!');
      setRefId('');
      setProofFile(null);
      fetchSubscriptionStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit payment details');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const isAlreadySeller = user && (user.tier === 'seller_pro' || user.tier === 'business' || user.is_staff || user.is_superuser);
  const isSubscriptionExpired = subscription && !subscription.is_active;
  const pendingConfirmation = paymentConfirmations.find(c => c.status === 'pending');
  const activeRenewalTier = tiers.find(t => t.tier_level === selectedTier) || (subscription && subscription.tier);


  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Elevate Your Business with <span className="text-brand-600">SokoniMax</span>
        </h1>
        <p className="max-w-2xl mx-auto text-gray-500 dark:text-gray-400">
          Join our managed-commerce platform. We handle warehouses and logistics while you scale your sales.
        </p>
      </div>

      {/* Tier Cards comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Customer / Free */}
        <div className="card p-8 flex flex-col justify-between border-gray-100 dark:border-neutral-800">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Customer Tier</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Ideal for buyers looking to inspect and purchase premium listings.</p>
            <div className="text-3xl font-black text-gray-900 dark:text-white">Free</div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 pt-4 border-t dark:border-neutral-800">
              <li className="flex items-center gap-2">✓ Browse all categories</li>
              <li className="flex items-center gap-2">✓ Message sellers</li>
              <li className="flex items-center gap-2">✓ Place and track orders</li>
              <li className="flex items-center gap-2">✓ Request pre-purchase inspections</li>
            </ul>
          </div>
          <div className="pt-6">
            <span className="block w-full py-2.5 text-center text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-neutral-900 rounded-xl">
              Default Tier
            </span>
          </div>
        </div>

        {/* Seller Pro */}
        <div className={`card p-8 flex flex-col justify-between relative overflow-hidden border-brand-500/50 ${selectedTier === 'seller_pro' ? 'ring-2 ring-brand-500' : ''}`}>
          <div className="absolute top-0 right-0 bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">Popular</div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Seller Pro</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Unlock the seller dashboard, list products, and let us manage shipping.</p>
            {isLoadingTiers ? (
              <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-black text-gray-900 dark:text-white">
                {getTierPrice('seller_pro', null) || 'Contact us for pricing'} <span className="text-xs text-gray-400 font-normal">/ month</span>
              </div>
            )}
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 pt-4 border-t dark:border-neutral-800">
              <li className="flex items-center gap-2">✓ Create product listings</li>
              <li className="flex items-center gap-2">✓ Manage inventory</li>
              <li className="flex items-center gap-2">✓ Complete seller dashboard</li>
              <li className="flex items-center gap-2">✓ Managed-commerce logistics</li>
              <li className="flex items-center gap-2">✓ {getTierCommission('seller_pro', '10%')} platform commission</li>
            </ul>
          </div>
          <div className="pt-6">
            <button 
              onClick={() => setSelectedTier('seller_pro')}
              className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                selectedTier === 'seller_pro' 
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' 
                  : 'bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Select Seller Pro
            </button>
          </div>
        </div>

        {/* Business */}
        <div className={`card p-8 flex flex-col justify-between border-brand-500/50 ${selectedTier === 'business' ? 'ring-2 ring-brand-500' : ''}`}>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Business</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">For established teams requiring deep analytics, staff accounts, and priority listing.</p>
            {isLoadingTiers ? (
              <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-black text-gray-900 dark:text-white">
                {getTierPrice('business', null) || 'Contact us for pricing'} <span className="text-xs text-gray-400 font-normal">/ month</span>
              </div>
            )}
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 pt-4 border-t dark:border-neutral-800">
              <li className="flex items-center gap-2">✓ Everything in Seller Pro</li>
              <li className="flex items-center gap-2">✓ Scoped team member management</li>
              <li className="flex items-center gap-2">✓ Advanced sales & revenue analytics</li>
              <li className="flex items-center gap-2">✓ Priority placement & badge</li>
              <li className="flex items-center gap-2">✓ Dedicated support channel</li>
            </ul>
          </div>
          <div className="pt-6">
            <button 
              onClick={() => setSelectedTier('business')}
              className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                selectedTier === 'business' 
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' 
                  : 'bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Select Business
            </button>
          </div>
        </div>
      </div>

      {/* Main content split: Guest vs Seller vs Application state */}
      <div className="max-w-2xl mx-auto card p-8 border-gray-100 dark:border-neutral-800">
        {!isAuthenticated ? (
          <div className="text-center space-y-6 py-6">
            <AlertCircle size={48} className="mx-auto text-brand-600 animate-pulse" />
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Authentication Required</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You must have an account to apply for a seller upgrade. Create an account or sign in to proceed.
              </p>
            </div>
            <div className="flex gap-4 max-w-sm mx-auto">
              <Link to="/login" className="flex-1 btn-primary py-3 text-center text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-600/20">Sign In</Link>
              <Link to="/register" className="flex-1 py-3 text-center text-sm font-bold border-2 border-brand-600 text-brand-600 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/10">Register</Link>
            </div>
          </div>
        ) : isAlreadySeller ? (
          <div className="text-center space-y-6 py-6">
            <ShieldCheck size={48} className="mx-auto text-green-600" />
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">You Are Already a Seller!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your account is currently active on the <span className="font-bold capitalize text-brand-600">{user.tier}</span> subscription tier.
              </p>
            </div>
            <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider shadow-lg shadow-brand-600/20">
              Access Seller Dashboard <ArrowRight size={16} />
            </Link>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw className="animate-spin text-brand-600" size={32} />
            <p className="text-sm text-gray-500">Checking application status...</p>
          </div>
        ) : application ? (
          <div className="space-y-6 py-4">
            {application.status === 'pending' && (
              <div className="text-center space-y-4">
                <Clock size={48} className="mx-auto text-yellow-500 animate-pulse" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Upgrade Application Pending Review</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  We have received your application for the <span className="font-bold capitalize text-brand-600">{application.requested_tier_name}</span> tier on your business <span className="font-bold">"{application.business_name}"</span>. Our administration team is reviewing your documents.
                </p>
                <div className="text-xs text-gray-400 pt-2">
                  Submitted: {new Date(application.created_at).toLocaleDateString()}
                </div>
              </div>
            )}
            
            {application.status === 'approved' && (
              <div className="text-center space-y-4">
                <CheckCircle size={48} className="mx-auto text-green-500" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Application Approved!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Congratulations! Your request has been approved. You now have full access to your seller dashboard.
                </p>
                <button onClick={async () => {
                  const refresh = localStorage.getItem('refresh_token');
                  if (refresh) {
                    try {
                      const res = await api.post('/api/auth/token/refresh/', { refresh });
                      localStorage.setItem('access_token', res.data.access);
                    } catch (e) {}
                  }
                  window.location.href = '/dashboard';
                }} className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider shadow-lg shadow-brand-600/20">
                  Access Dashboard <ArrowRight size={16} />
                </button>
              </div>
            )}

            {application.status === 'rejected' && (
              <div className="text-center space-y-4">
                <AlertCircle size={48} className="mx-auto text-red-500" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Application Rejected</h3>
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-left">
                  <span className="font-bold text-xs text-red-800 dark:text-red-400 uppercase tracking-widest block mb-1">Rejection Reason:</span>
                  <p className="text-sm text-red-700 dark:text-red-300">{application.rejection_reason || 'No explanation provided by admin.'}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  You can update your details and resubmit the application for review.
                </p>
                <button 
                  onClick={handleReapply}
                  className="px-6 py-2.5 border-2 border-brand-600 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/10 rounded-xl text-xs font-bold uppercase tracking-wider transition"
                >
                  Update & Reapply
                </button>
              </div>
            )}
          </div>
        ) : isSubscriptionExpired ? (
          <div className="space-y-6">
            {pendingConfirmation ? (
              <div className="text-center space-y-6 py-6">
                <Clock size={48} className="mx-auto text-yellow-500 animate-pulse" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Renewal Pending Review</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto font-medium">
                    We are currently verifying your renewal payment reference <code className="bg-gray-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded font-mono text-brand-600 font-bold">{pendingConfirmation.reference}</code> for the <span className="font-bold capitalize text-brand-600">{pendingConfirmation.tier_name}</span> plan.
                  </p>
                  <p className="text-xs text-gray-400">
                    Submitted on: {new Date(pendingConfirmation.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-2xl text-xs text-yellow-850 dark:text-yellow-400 text-left">
                  <strong className="block mb-1">What happens next?</strong>
                  Our administration team will verify the payment confirmation screenshot and transaction reference with the network carrier. Upon approval, your account privileges will be instantly restored.
                </div>
              </div>
            ) : (
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-red-800 dark:text-red-400">Subscription Expired</h4>
                    <p className="text-xs text-red-700 dark:text-red-300">
                      Your seller subscription has expired. You have been placed on the free plan and your listings are temporarily hidden. Please submit a renewal payment to restore your seller privileges.
                    </p>
                  </div>
                </div>

                <div className="border-b dark:border-neutral-800 pb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Renew Subscription
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Selected Tier: <span className="font-bold text-brand-600 capitalize">{(activeRenewalTier?.name || selectedTier).replace('_', ' ')}</span> ({activeRenewalTier ? `TZS ${Number(activeRenewalTier.price).toLocaleString()}` : 'Free'})
                  </p>
                </div>

                {/* Lipa numbers instructions */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Payment Instructions</h4>
                  <p className="text-xs text-gray-500">Send the correct price amount to any of the verified system accounts below:</p>
                  <div className="grid grid-cols-1 gap-3">
                    {lipaNumbers.map((num: any) => (
                      <div key={num.id} className="p-3 bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black uppercase tracking-widest text-[9px] bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400 px-2 py-0.5 rounded-md">
                            {num.network_name || num.network?.name}
                          </span>
                          <span className="font-bold text-gray-800 dark:text-white">{num.number}</span>
                        </div>
                        <span className="text-gray-400 text-[10px] italic">A/C Name: <strong className="text-gray-600 dark:text-gray-300">{num.name}</strong></span>
                      </div>
                    ))}
                    {lipaNumbers.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No system payment numbers listed. Please contact support.</p>
                    )}
                  </div>
                </div>

                {/* Transaction Ref input */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Transaction Reference ID</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. PP1234567890"
                    className="input w-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:outline-none"
                    value={refId}
                    onChange={(e) => setRefId(e.target.value)}
                  />
                </div>

                {/* Proof screenshot input */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Payment Receipt Screenshot</label>
                  <div className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-6 text-center hover:border-brand-500 transition-colors relative cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*"
                      required
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setProofFile(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="space-y-2 pointer-events-none">
                      <Upload className="mx-auto text-gray-400" size={24} />
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                        {proofFile ? proofFile.name : 'Click to select or drag and drop receipt image'}
                      </p>
                      <p className="text-[10px] text-gray-400">JPEG, PNG or WebP up to 5MB</p>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button 
                  type="submit"
                  disabled={submittingPayment || !activeRenewalTier}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingPayment ? 'Submitting Payment Proof...' : 'Submit Renewal Payment'}
                </button>
              </form>
            )}
          </div>
        ) : (

          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b dark:border-neutral-800 pb-3">
              Upgrade to <span className="capitalize text-brand-600">{selectedTier.replace('_', ' ')}</span>
            </h3>

            {/* Business Name */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Business / Store Name</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. Kariakoo Auto Spares"
                className="input w-full"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            {/* Business Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Business Registration No. (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. BRELA 123456"
                  className="input w-full"
                  value={businessRegNumber}
                  onChange={(e) => setBusinessRegNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">TIN Number (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 123-456-789"
                  className="input w-full"
                  value={tinNumber}
                  onChange={(e) => setTinNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Business Address (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Plot 45, Uhuru Street"
                  className="input w-full"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Region (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Dar es Salaam"
                  className="input w-full"
                  value={businessRegion}
                  onChange={(e) => setBusinessRegion(e.target.value)}
                />
              </div>
            </div>

            {/* ID Document upload */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Identity Document (National ID, Passport or License)</label>
              <div className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-6 text-center hover:border-brand-500 transition-colors relative cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*"
                  required
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setIdDocument(e.target.files[0]);
                    }
                  }}
                />
                <div className="space-y-2 pointer-events-none">
                  <Upload className="mx-auto text-gray-400" size={24} />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {idDocument ? idDocument.name : 'Click to select or drag and drop ID image file'}
                  </p>
                  <p className="text-[10px] text-gray-400">JPEG, PNG or WebP up to 5MB</p>
                </div>
              </div>
            </div>

            {/* Business Document (optional) */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Business Registration Certificate (Optional)</label>
              <div className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-6 text-center hover:border-brand-500 transition-colors relative cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setBusinessDocument(e.target.files[0]);
                    }
                  }}
                />
                <div className="space-y-2 pointer-events-none">
                  <Upload className="mx-auto text-gray-400" size={24} />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {businessDocument ? businessDocument.name : 'Click to select or drag and drop business certificate image file'}
                  </p>
                  <p className="text-[10px] text-gray-400">JPEG, PNG or WebP up to 5MB</p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>

      {/* Contact Info — only show cards when SiteSettings has the value */}
      {(siteSettings.support_phone || siteSettings.whatsapp_number || siteSettings.support_email) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto pt-8">
          {siteSettings.support_phone && (
            <a href={`tel:${siteSettings.support_phone}`} className="card p-6 flex flex-col items-center text-center space-y-2 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center rounded-full">
                <Phone size={24} />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Call Us</h3>
              <p className="text-sm text-gray-500">{siteSettings.support_phone}</p>
            </a>
          )}
          {siteSettings.whatsapp_number && (
            <a href={`https://wa.me/${siteSettings.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="card p-6 flex flex-col items-center text-center space-y-2 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center rounded-full">
                <MessageCircle size={24} />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">WhatsApp</h3>
              <p className="text-sm text-gray-500">{siteSettings.whatsapp_number}</p>
            </a>
          )}
          {siteSettings.support_email && (
            <a href={`mailto:${siteSettings.support_email}`} className="card p-6 flex flex-col items-center text-center space-y-2 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center rounded-full">
                <Mail size={24} />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Email Us</h3>
              <p className="text-sm text-gray-500">{siteSettings.support_email}</p>
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default SellerUpgradePage;
