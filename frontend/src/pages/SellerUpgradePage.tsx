import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { 
  ShieldCheck, ArrowRight, Upload, AlertCircle, Clock, CheckCircle, 
  Phone, MessageCircle, Mail, Copy, Check, Store, CreditCard, 
  FileText, Sparkles, ChevronRight, ChevronLeft, RefreshCw 
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/Input';
import { FormSkeleton } from '../components/Skeleton';

const SellerUpgradePage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  
  // Wizard Step: 1 = Plan, 2 = Business Details, 3 = Payment Info, 4 = Review/Wait Screen
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedTier, setSelectedTier] = useState<'seller_pro' | 'business'>('seller_pro');
  
  // Business details
  const [businessName, setBusinessName] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessRegion, setBusinessRegion] = useState('');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [businessDocument, setBusinessDocument] = useState<File | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Payment details
  const [refId, setRefId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  
  // Status & Data states
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  
  const [application, setApplication] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [siteSettings, setSiteSettings] = useState<any>({});
  const [lipaNumbers, setLipaNumbers] = useState<any[]>([]);

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
      if (res.data && res.data.status !== 'none') {
        setApplication(res.data);
        if (res.data.requested_tier_level) {
          setSelectedTier(res.data.requested_tier_level);
        }
      } else {
        setApplication(null);
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

  const fetchLipaNumbers = async () => {
    try {
      const res = await api.get('/api/lipa-numbers/?system=true&purpose=subscriptions');
      setLipaNumbers(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load Lipa numbers', err);
    }
  };

  useEffect(() => {
    fetchApplicationStatus();
    fetchTiers();
    fetchSiteSettings();
    fetchLipaNumbers();
  }, [isAuthenticated]);

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    toast.success('Account number copied!');
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  const validateStep2 = () => {
    if (!businessName.trim()) {
      toast.error('Please enter your business / store name.');
      return false;
    }
    if (!idDocument) {
      toast.error('Please upload an identity document image.');
      return false;
    }
    if (!termsAccepted) {
      toast.error('Please accept the Seller Upgrade Agreement to proceed.');
      return false;
    }
    return true;
  };

  const handleNextToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep2()) {
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmitApplicationAndPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please log in to apply.');
      return;
    }
    if (!idDocument) {
      toast.error('ID Document image is required.');
      return;
    }
    if (!termsAccepted) {
      toast.error('You must agree to the Seller Upgrade Agreement.');
      return;
    }

    const targetTier = tiers.find(t => t.tier_level === selectedTier);
    if (!targetTier) {
      toast.error('Selected subscription tier is not available.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Submit the seller application
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

      await api.post('/api/seller-applications/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // 2. Submit payment confirmation if reference and proof are provided
      if (refId.trim() && proofFile) {
        const payData = new FormData();
        payData.append('amount', targetTier.price);
        payData.append('reference', refId);
        payData.append('proof', proofFile);
        payData.append('tier', targetTier.id.toString());

        await api.post('/api/subscription-payments/', payData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success('Application and payment details submitted successfully!');
      await fetchApplicationStatus();
      setCurrentStep(4);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to submit application';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReapply = () => {
    setApplication(null);
    setCurrentStep(1);
  };

  const isAlreadySeller = user && (user.tier === 'seller_pro' || user.tier === 'business' || user.is_staff || user.is_superuser);

  // Stepper items definition
  const steps = [
    { number: 1, label: 'Choose Plan', icon: Store },
    { number: 2, label: 'Business & ID', icon: FileText },
    { number: 3, label: 'Payment Info', icon: CreditCard },
    { number: 4, label: 'Status & Review', icon: Clock },
  ];

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold">
          <Sparkles size={14} />
          <span>Seller Onboarding</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Become a Seller on <span className="text-brand-500">SokoniMax</span>
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Scale your business with managed warehousing, fast nationwide logistics, and direct buyer trust.
        </p>
      </div>

      {/* Interactive Step Bar (Only shown for authenticated applicants) */}
      {isAuthenticated && !isAlreadySeller && (
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-4 gap-2 relative">
            {steps.map((step) => {
              const isCurrent = (application ? 4 : currentStep) === step.number;
              const isCompleted = (application ? 4 : currentStep) > step.number;

              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => {
                    if (!application && step.number < currentStep) {
                      setCurrentStep(step.number);
                    }
                  }}
                  disabled={Boolean(application) || step.number > currentStep}
                  className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl transition-all ${
                    isCurrent
                      ? 'text-brand-600 dark:text-brand-400 font-bold'
                      : isCompleted
                      ? 'text-gray-900 dark:text-white font-medium hover:opacity-80'
                      : 'text-gray-400 dark:text-gray-600 opacity-60'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                      isCurrent
                        ? 'bg-brand-500 text-white ring-4 ring-brand-500/20'
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-400'
                    }`}
                  >
                    {isCompleted ? <Check size={16} /> : <step.icon size={16} />}
                  </div>
                  <span className="text-[11px] sm:text-xs text-center truncate max-w-full">
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="w-full bg-gray-100 dark:bg-neutral-800 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-brand-500 h-full transition-all duration-300 rounded-full"
              style={{
                width: `${((application ? 4 : currentStep) / 4) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Main View Area */}
      {!isAuthenticated ? (
        /* Guest prompt */
        <div className="max-w-md mx-auto card p-8 text-center space-y-6 border border-gray-100 dark:border-neutral-800">
          <AlertCircle size={48} className="mx-auto text-brand-500 animate-pulse" />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Authentication Required</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You must have an account to apply for a seller upgrade. Sign in or create a new customer account to continue.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/login" className="flex-1 btn-primary py-2.5 text-center text-sm font-bold bg-brand-500 hover:bg-brand-600 text-white rounded-xl shadow-md">
              Sign In
            </Link>
            <Link to="/register" className="flex-1 py-2.5 text-center text-sm font-bold border border-brand-500 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl">
              Register
            </Link>
          </div>
        </div>
      ) : isAlreadySeller ? (
        /* Active Seller */
        <div className="max-w-lg mx-auto card p-8 text-center space-y-6 border border-gray-100 dark:border-neutral-800">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <ShieldCheck size={36} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">You Are Already a Verified Seller!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your account is currently active on the <span className="font-bold capitalize text-brand-500">{user?.tier?.replace('_', ' ')}</span> tier with full store access.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-bold shadow-md shadow-brand-500/20"
          >
            <span>Open Seller Dashboard</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : loading ? (
        /* Loading */
        <div className="max-w-2xl mx-auto py-8 animate-fade-in">
          <FormSkeleton fields={3} />
        </div>
      ) : application ? (
        /* Step 4: Existing Application Status / Wait Screen */
        <div className="max-w-2xl mx-auto space-y-6">
          {application.status === 'pending' && (
            <div className="card p-8 text-center space-y-6 border border-yellow-500/30 bg-yellow-50/20 dark:bg-neutral-900/40">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center mx-auto animate-pulse">
                <Clock size={36} />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">Application Under Review</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  We have received your application for the <span className="font-bold capitalize text-brand-500">{application.requested_tier_name || selectedTier.replace('_', ' ')}</span> plan for store <strong className="text-gray-900 dark:text-white">"{application.business_name}"</strong>.
                </p>
              </div>

              {/* Submission Details */}
              <div className="text-left text-xs space-y-2.5 max-w-md mx-auto pt-2 border-t border-surface-border/40">
                <div className="flex justify-between border-b border-surface-border/30 pb-2">
                  <span className="text-gray-400">Application ID:</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-gray-200">#{application.id}</span>
                </div>
                <div className="flex justify-between border-b border-surface-border/30 pb-2">
                  <span className="text-gray-400">Plan Tier:</span>
                  <span className="font-bold capitalize text-brand-500">{application.requested_tier_name || selectedTier.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between border-b border-surface-border/30 pb-2">
                  <span className="text-gray-400">Business Name:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{application.business_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Submitted On:</span>
                  <span className="font-medium text-gray-600 dark:text-gray-400">{new Date(application.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* What happens next explanation */}
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-left text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
                <strong className="block font-bold">What happens next?</strong>
                <p>Our compliance team verifies your national ID and business credentials. Upon verification, your account will be upgraded immediately and you will receive full access to your seller dashboard.</p>
              </div>

              <div className="flex justify-center pt-2">
                <Button onClick={fetchApplicationStatus} variant="outline" size="sm" className="gap-2">
                  <RefreshCw size={14} /> Refresh Status
                </Button>
              </div>
            </div>
          )}

          {application.status === 'approved' && (
            <div className="card p-8 text-center space-y-6 border border-green-500/30 bg-green-50/20 dark:bg-neutral-900/40">
              <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto">
                <CheckCircle size={36} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">Application Approved!</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Congratulations! Your seller application has been approved. You are ready to open your store and begin listing items.
                </p>
              </div>
              <button
                onClick={async () => {
                  const refresh = localStorage.getItem('refresh_token');
                  if (refresh) {
                    try {
                      const res = await api.post('/api/auth/token/refresh/', { refresh });
                      localStorage.setItem('access_token', res.data.access);
                    } catch (e) {}
                  }
                  window.location.href = '/dashboard';
                }}
                className="inline-flex items-center justify-center gap-2 w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-bold shadow-md shadow-brand-500/20"
              >
                <span>Enter Seller Dashboard</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {application.status === 'rejected' && (
            <div className="card p-8 text-center space-y-6 border border-red-500/30 bg-red-50/20 dark:bg-neutral-900/40">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <AlertCircle size={36} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">Application Rejected</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Unfortunately, our team was unable to approve your application at this time.
                </p>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-left text-xs text-red-700 dark:text-red-400">
                <strong className="block font-bold mb-1">Rejection Reason:</strong>
                <p>{application.rejection_reason || 'Document verification could not be completed. Please ensure all ID files are clear.'}</p>
              </div>
              <Button onClick={handleReapply} className="w-full py-2.5">
                Edit Details & Reapply
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* WIZARD FLOW: Steps 1, 2, 3 */
        <div>
          {/* STEP 1: Plan Selection */}
          {currentStep === 1 && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Customer / Free (Readonly comparison) */}
                <div className="card p-6 flex flex-col justify-between border-gray-100 dark:border-neutral-800 opacity-75 hover:opacity-100 transition">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Customer Tier</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">For buyers purchasing products and requesting inspections.</p>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">Free</div>
                    <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300 pt-4 border-t dark:border-neutral-800">
                      <li className="flex items-center gap-2">✓ Browse full marketplace</li>
                      <li className="flex items-center gap-2">✓ Message verified sellers</li>
                      <li className="flex items-center gap-2">✓ Place and track orders</li>
                      <li className="flex items-center gap-2">✓ Request pre-purchase inspections</li>
                    </ul>
                  </div>
                  <div className="pt-6">
                    <span className="block w-full py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-neutral-900 rounded-lg">
                      Current Free Plan
                    </span>
                  </div>
                </div>

                {/* Seller Pro Plan */}
                <div
                  onClick={() => setSelectedTier('seller_pro')}
                  className={`card p-6 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all ${
                    selectedTier === 'seller_pro'
                      ? 'ring-2 ring-brand-500 border-brand-500 shadow-lg'
                      : 'border-gray-100 dark:border-neutral-800 hover:border-brand-500/50'
                  }`}
                >
                  <div className="absolute top-0 right-0 bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-bl-lg">
                    Recommended
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>Seller Pro</span>
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">For individual merchants & store owners ready to sell.</p>
                    {isLoadingTiers ? (
                      <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    ) : (
                      <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {getTierPrice('seller_pro', 'TZS 30,000')} <span className="text-xs text-gray-400 font-normal">/ month</span>
                      </div>
                    )}
                    <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300 pt-4 border-t dark:border-neutral-800">
                      <li className="flex items-center gap-2">✓ Dedicated seller dashboard</li>
                      <li className="flex items-center gap-2">✓ Managed logistics & warehousing</li>
                      <li className="flex items-center gap-2">✓ Verified seller badge</li>
                      <li className="flex items-center gap-2">✓ Unlimited product listings</li>
                      <li className="flex items-center gap-2">✓ {getTierCommission('seller_pro', '10%')} platform commission</li>
                    </ul>
                  </div>
                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => setSelectedTier('seller_pro')}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                        selectedTier === 'seller_pro'
                          ? 'bg-brand-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {selectedTier === 'seller_pro' ? '✓ Selected' : 'Select Seller Pro'}
                    </button>
                  </div>
                </div>

                {/* Business Plan */}
                <div
                  onClick={() => setSelectedTier('business')}
                  className={`card p-6 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all ${
                    selectedTier === 'business'
                      ? 'ring-2 ring-brand-500 border-brand-500 shadow-lg'
                      : 'border-gray-100 dark:border-neutral-800 hover:border-brand-500/50'
                  }`}
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Business</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">For teams needing scoped staff accounts & sales analytics.</p>
                    {isLoadingTiers ? (
                      <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    ) : (
                      <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {getTierPrice('business', 'TZS 80,000')} <span className="text-xs text-gray-400 font-normal">/ month</span>
                      </div>
                    )}
                    <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300 pt-4 border-t dark:border-neutral-800">
                      <li className="flex items-center gap-2">✓ Everything in Seller Pro</li>
                      <li className="flex items-center gap-2">✓ Scoped team member management</li>
                      <li className="flex items-center gap-2">✓ Advanced sales & revenue analytics</li>
                      <li className="flex items-center gap-2">✓ Priority placement & badge</li>
                      <li className="flex items-center gap-2">✓ Dedicated account manager</li>
                    </ul>
                  </div>
                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => setSelectedTier('business')}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                        selectedTier === 'business'
                          ? 'bg-brand-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {selectedTier === 'business' ? '✓ Selected' : 'Select Business'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => {
                    setCurrentStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="gap-2 px-8 py-3 font-bold"
                >
                  <span>Continue to Business Details</span>
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Business Information & ID Upload */}
          {currentStep === 2 && (
            <form onSubmit={handleNextToPayment} className="max-w-2xl mx-auto card p-6 sm:p-8 space-y-6 border border-gray-100 dark:border-neutral-800">
              <div className="border-b border-gray-100 dark:border-neutral-800 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-500">Step 2 of 3</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  Business Details for <span className="capitalize text-brand-500">{selectedTier.replace('_', ' ')}</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Provide your store name, identity document, and location information.
                </p>
              </div>

              {/* Business / Store Name */}
              <FormField
                label="Business / Store Name"
                required
                placeholder="e.g. Kariakoo Auto Spares"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />

              {/* Reg No & TIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Business Registration No. (Optional)"
                  placeholder="e.g. BRELA 123456"
                  value={businessRegNumber}
                  onChange={(e) => setBusinessRegNumber(e.target.value)}
                />
                <FormField
                  label="TIN Number (Optional)"
                  placeholder="e.g. 123-456-789"
                  value={tinNumber}
                  onChange={(e) => setTinNumber(e.target.value)}
                />
              </div>

              {/* Address & Region */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Business Address (Optional)"
                  placeholder="e.g. Plot 45, Uhuru Street"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                />
                <FormField
                  label="Region / City (Optional)"
                  placeholder="e.g. Dar es Salaam"
                  value={businessRegion}
                  onChange={(e) => setBusinessRegion(e.target.value)}
                />
              </div>

              {/* National ID Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  National ID, Passport, or Driver's License <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-5 text-center hover:border-brand-500 transition-colors relative cursor-pointer">
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
                  <div className="space-y-1.5 pointer-events-none">
                    <Upload className="mx-auto text-gray-400" size={22} />
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      {idDocument ? idDocument.name : 'Click to select or drag & drop ID document image'}
                    </p>
                    <p className="text-[10px] text-gray-400">JPEG, PNG or WebP up to 5MB</p>
                  </div>
                </div>
              </div>

              {/* Optional Business Document */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Business Registration Certificate (Optional)
                </label>
                <div className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-5 text-center hover:border-brand-500 transition-colors relative cursor-pointer">
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
                  <div className="space-y-1.5 pointer-events-none">
                    <Upload className="mx-auto text-gray-400" size={22} />
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      {businessDocument ? businessDocument.name : 'Click to upload business certificate (if available)'}
                    </p>
                    <p className="text-[10px] text-gray-400">JPEG, PNG or WebP up to 5MB</p>
                  </div>
                </div>
              </div>

              {/* Agreement Checkbox */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  id="terms_accepted_app"
                  type="checkbox"
                  required
                  className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 mt-0.5"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <label htmlFor="terms_accepted_app" className="text-xs text-gray-600 dark:text-gray-300 leading-normal">
                  I agree to the <Link to="/seller-contract" target="_blank" className="text-brand-500 hover:underline font-semibold">Seller Pro / Business Account Upgrade Agreement</Link> and platform terms.
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentStep(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="gap-1.5"
                >
                  <ChevronLeft size={16} />
                  <span>Back to Plans</span>
                </Button>
                <Button type="submit" className="gap-1.5 font-bold">
                  <span>Continue to Payment</span>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3: Payment Instructions & Proof Upload */}
          {currentStep === 3 && (
            <form onSubmit={handleSubmitApplicationAndPayment} className="max-w-2xl mx-auto card p-6 sm:p-8 space-y-6 border border-gray-100 dark:border-neutral-800">
              <div className="border-b border-gray-100 dark:border-neutral-800 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-500">Step 3 of 3</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  Payment for <span className="capitalize text-brand-500">{selectedTier.replace('_', ' ')}</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Plan Price: <strong className="text-gray-900 dark:text-white">{getTierPrice(selectedTier, 'TZS 30,000')}</strong> / month
                </p>
              </div>

              {/* Payment Instructions & Lipa Numbers */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Official Mobile Money Numbers
                </h4>
                <p className="text-xs text-gray-500">
                  Transfer the subscription amount to any of the verified system accounts below:
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  {lipaNumbers.map((num: any) => (
                    <div
                      key={num.id}
                      className="p-3 bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-black uppercase tracking-wider text-[10px] text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md">
                          {num.network_name || num.network?.name || 'M-PESA'}
                        </span>
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white text-sm">{num.number}</span>
                          <span className="block text-[10px] text-gray-400">A/C: {num.name}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyNumber(num.number)}
                        className="flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-neutral-800 px-2.5 py-1 rounded-lg transition"
                      >
                        {copiedNumber === num.number ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        <span>{copiedNumber === num.number ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  ))}
                  {lipaNumbers.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No system payment numbers listed. Please contact support below.</p>
                  )}
                </div>
              </div>

              {/* Transaction Reference ID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Transaction Reference ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MP260827001"
                  className="input w-full py-2.5 text-xs font-mono"
                  value={refId}
                  onChange={(e) => setRefId(e.target.value)}
                />
                <p className="text-[10px] text-gray-400">Enter the transaction SMS ID received from your mobile money provider.</p>
              </div>

              {/* Payment Proof Receipt Upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Payment Receipt / SMS Screenshot <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-5 text-center hover:border-brand-500 transition-colors relative cursor-pointer">
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
                  <div className="space-y-1.5 pointer-events-none">
                    <Upload className="mx-auto text-gray-400" size={22} />
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      {proofFile ? proofFile.name : 'Click to select or drag & drop receipt screenshot'}
                    </p>
                    <p className="text-[10px] text-gray-400">JPEG, PNG or WebP up to 5MB</p>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="gap-1.5"
                >
                  <ChevronLeft size={16} />
                  <span>Back to Business Info</span>
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  className="gap-1.5 font-bold px-6"
                >
                  <span>Submit Application & Payment</span>
                  <Check size={16} />
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Support & Contact Channel Cards (Loaded from SiteSettings) */}
      {(siteSettings.support_phone || siteSettings.whatsapp_number || siteSettings.support_email) && (
        <div className="pt-6 border-t border-gray-100 dark:border-neutral-800">
          <p className="text-center text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
            Need assistance with your upgrade?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {siteSettings.support_phone && (
              <a
                href={`tel:${siteSettings.support_phone}`}
                className="card p-4 flex items-center justify-center gap-3 text-center hover:shadow-md transition text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center">
                  <Phone size={16} />
                </div>
                <span>{siteSettings.support_phone}</span>
              </a>
            )}
            {siteSettings.whatsapp_number && (
              <a
                href={`https://wa.me/${siteSettings.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="card p-4 flex items-center justify-center gap-3 text-center hover:shadow-md transition text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <MessageCircle size={16} />
                </div>
                <span>WhatsApp Support</span>
              </a>
            )}
            {siteSettings.support_email && (
              <a
                href={`mailto:${siteSettings.support_email}`}
                className="card p-4 flex items-center justify-center gap-3 text-center hover:shadow-md transition text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <span className="truncate">{siteSettings.support_email}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerUpgradePage;
