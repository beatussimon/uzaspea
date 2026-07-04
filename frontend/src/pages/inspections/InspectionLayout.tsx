import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ClipboardList, ChevronRight, Upload, CheckCircle, AlertTriangle,
  Clock, FileText, Bell, Search, RefreshCw, Shield,
  MapPin, Camera, Printer, ChevronDown, ChevronUp, Check, X, ShieldAlert, BadgeCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import inspectionApi from '../../api/inspectionApi';
import api, { API_BASE_URL } from '../../api';
import './InspectionLayout.css';
import {
  InspectionCategory, InspectionRequest, InspectionNotification, ChecklistResponse,
  STATUS_LABELS, STATUS_COLORS, VERDICT_COLORS, fmtDate, fmtMoney,
} from '../../types/inspection';

// ─── Helpers ───────────────────────────────
const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {text}
  </span>
);

const Spinner = () => (
  <div className="flex justify-center py-16">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
  </div>
);

// ─── Category Tree Selector ─────────────────
const CategorySelector: React.FC<{
  categories: InspectionCategory[];
  selected: InspectionCategory | null;
  onSelect: (c: InspectionCategory) => void;
}> = ({ categories, selected, onSelect }) => {
  const [path, setPath] = useState<InspectionCategory[]>([]);
  const current = path.length === 0 ? categories : (path[path.length - 1].children || []);

  const handleClick = (cat: InspectionCategory) => {
    if (cat.children && cat.children.length > 0) {
      setPath([...path, cat]);
    } else {
      onSelect(cat);
    }
  };

  return (
    <div className="space-y-2">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
        <button onClick={() => setPath([])} className="hover:text-brand-600 transition">All</button>
        {path.map((p, i) => (
          <React.Fragment key={p.id}>
            <ChevronRight size={12} />
            <button onClick={() => setPath(path.slice(0, i + 1))} className="hover:text-brand-600 transition">{p.name}</button>
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
        {current.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleClick(cat)}
            className={`p-3 rounded-lg border text-left transition text-sm ${
              selected?.id === cat.id
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                : 'border-surface-border dark:border-surface-dark-border hover:border-brand-300 dark:hover:border-brand-600 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="font-medium text-gray-900 dark:text-white line-clamp-1">{cat.name}</div>
            {cat.children?.length > 0 && (
              <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                {cat.children.length} subcategories <ChevronRight size={10} />
              </div>
            )}
            {cat.children?.length === 0 && cat.base_price && (
              <div className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
                From {fmtMoney(cat.base_price)}
              </div>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm">
          <span className="font-medium text-green-700 dark:text-green-400">Selected: </span>
          <span className="text-green-600 dark:text-green-300">{selected.full_path}</span>
        </div>
      )}
    </div>
  );
};

// ─── Request Form ───────────────────────────
const RequestForm: React.FC = () => {
  const [categories, setCategories] = useState<InspectionCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<InspectionCategory | null>(null);
  const [form, setForm] = useState({
    item_name: '', item_description: '', item_address: '',
    item_age_years: '', is_complex: false,
    scope: 'standard', turnaround: 'standard',
    reinspection_coverage: false,
    marketplace_product: null as number | null,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [prefilledProduct, setPrefilledProduct] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await inspectionApi.categories.list();
        const cats = res.data.results || res.data;
        setCategories(cats);
        
        const params = new URLSearchParams(location.search);
        const marketId = params.get('marketplace_product_id');
        
        if (marketId) {
          setLoading(true);
          const preRes = await inspectionApi.requests.prefillMarketplace(parseInt(marketId));
          const data = preRes.data;
          
          setForm(f => ({
            ...f,
            item_name: data.item_name,
            item_description: data.item_description,
            item_address: data.item_address,
            marketplace_product: data.product.id,
          }));
          
          setPrefilledProduct(data.product);
          
          // Ensure the newly created/found category is in our list and selected
          const latestCatsRes = await inspectionApi.categories.list();
          const latestCats = latestCatsRes.data.results || latestCatsRes.data;
          setCategories(latestCats);
          
          const found = latestCats.find((c: any) => c.id === data.category.id) || data.category;
          setSelectedCategory(found);
          setLoading(false);
        } else {
          // Manual pre-fill from basic params
          const name = params.get('item_name');
          const catName = params.get('category_name');
          if (name) setForm(f => ({ ...f, item_name: name }));
          if (catName) {
            const findCat = (list: InspectionCategory[]): InspectionCategory | null => {
              for (const c of list) {
                if (c.name.toLowerCase() === catName.toLowerCase()) return c;
                if (c.children) {
                  const sub = findCat(c.children);
                  if (sub) return sub;
                }
              }
              return null;
            };
            const found = findCat(cats);
            if (found) setSelectedCategory(found);
          }
        }
      } catch (err) {
        console.error('Failed to load pre-fill data', err);
      }
    };
    load();
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) { toast.error('Please select a category'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        category: selectedCategory.id,
        item_age_years: form.item_age_years ? parseInt(form.item_age_years) : null,
      };
      const res = await inspectionApi.requests.create(payload);
      toast.success('Inspection request submitted!');
      navigate(`/inspections/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const scopeOptions = [
    { value: 'basic', label: 'Basic', desc: 'Visual & functional check' },
    { value: 'standard', label: 'Standard', desc: 'Thorough across all checkpoints' },
    { value: 'deep', label: 'Deep / Technical', desc: 'Specialist-level diagnostics' },
  ];
  const turnaroundOptions = [
    { value: 'standard', label: 'Standard', desc: '24–48 hours' },
    { value: 'express', label: 'Express +30%', desc: 'Same day' },
    { value: 'instant', label: 'Instant +60%', desc: 'Within hours' },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
            <ClipboardList size={20} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Request Inspection</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fill in the details below to get a bill</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {prefilledProduct && (
            <div className="flex items-center gap-4 p-4 bg-brand-50/50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/30 rounded-xl animate-fade-in">
              <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden shadow-sm border border-white dark:border-gray-800">
                <img 
                  src={prefilledProduct.image?.startsWith('http') ? prefilledProduct.image : `http://localhost:8000${prefilledProduct.image}`} 
                  alt="" className="w-full h-full object-cover" 
                />
              </div>
              <div>
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Linked Marketplace Item</span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{prefilledProduct.name}</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Details and category have been automatically borrowed.</p>
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Item Category <span className="text-red-500">*</span>
            </label>
            <CategorySelector
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </div>

          {/* Item Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Item Name <span className="text-red-500">*</span>
              </label>
              <input className="input" required placeholder="e.g. Toyota Camry 2019, iPhone 14 Pro"
                value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea className="input" rows={3} required
                placeholder="Describe the item, known issues, what you need verified..."
                value={form.item_description}
                onChange={(e) => setForm({ ...form, item_description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Item Location / Address <span className="text-red-500">*</span>
              </label>
              <textarea className="input" rows={2} required
                placeholder="Full address where the item is located"
                value={form.item_address}
                onChange={(e) => setForm({ ...form, item_address: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Item Age (years)
              </label>
              <input className="input" type="number" min="0" placeholder="Optional"
                value={form.item_age_years}
                onChange={(e) => setForm({ ...form, item_age_years: e.target.value })} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="is_complex" checked={form.is_complex}
                onChange={(e) => setForm({ ...form, is_complex: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <label htmlFor="is_complex" className="text-sm text-gray-700 dark:text-gray-300">
                Mark as unusually complex (+20%)
              </label>
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Inspection Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              {scopeOptions.map((o) => (
                <button key={o.value} type="button"
                  onClick={() => setForm({ ...form, scope: o.value })}
                  className={`p-3 rounded-lg border text-left transition ${
                    form.scope === o.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-surface-border dark:border-surface-dark-border hover:border-brand-300 bg-white dark:bg-gray-800'
                  }`}>
                  <div className={`text-sm font-semibold ${form.scope === o.value ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>
                    {o.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Turnaround */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Turnaround Speed
            </label>
            <div className="grid grid-cols-3 gap-2">
              {turnaroundOptions.map((o) => (
                <button key={o.value} type="button"
                  onClick={() => setForm({ ...form, turnaround: o.value })}
                  className={`p-3 rounded-lg border text-left transition ${
                    form.turnaround === o.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-surface-border dark:border-surface-dark-border hover:border-brand-300 bg-white dark:bg-gray-800'
                  }`}>
                  <div className={`text-sm font-semibold ${form.turnaround === o.value ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-white'}`}>
                    {o.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Add-ons */}
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-surface-border dark:border-surface-dark-border">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Optional Add-ons</h3>
            <div className="flex items-start gap-3">
              <input type="checkbox" id="reinspection" checked={form.reinspection_coverage}
                onChange={(e) => setForm({ ...form, reinspection_coverage: e.target.checked })}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <label htmlFor="reinspection" className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Re-inspection coverage (+10%)</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Discounted re-inspection if conditions were compromised
                </p>
              </label>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full btn-primary py-3 text-base font-semibold">
            {loading ? 'Submitting...' : 'Submit Request & Get Bill →'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Payment Upload ─────────────────────────
const PaymentUpload: React.FC<{ request: InspectionRequest; onPaid: () => void }> = ({ request, onPaid }) => {
  const [file, setFile] = useState<File | null>(null);
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [lipaNumbers, setLipaNumbers] = useState<any[]>([]);
  const bill = request.bill;

  useEffect(() => {
    api.get('/api/lipa-numbers/?seller=admin')
       .then(r => setLipaNumbers(r.data.results || r.data))
       .catch(() => {});
  }, []);

  // Determine stage
  const hasApprovedDeposit = request.payments.some(
    (p) => p.stage === 'deposit' && p.status === 'approved'
  );
  const stage = hasApprovedDeposit ? 'balance' : 'deposit';
  const amount = stage === 'deposit' ? bill?.deposit_amount : bill?.remaining_balance;

  const pendingPayment = request.payments.find(p => p.status === 'pending');

  if (pendingPayment) {
    return (
      <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-center gap-3 animate-pulse">
        <Clock size={16} className="text-yellow-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-yellow-700 dark:text-yellow-300 font-bold">
            {pendingPayment.stage === 'deposit' ? 'Deposit' : 'Balance'} payment submitted
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
            Finance is currently confirming your transaction. Please wait for confirmation before sending again.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !ref) { toast.error('Please provide both transaction reference and receipt screenshot'); return; }
    if (!amount) { toast.error('Bill amount not available'); return; }
    setLoading(true);
    const fd = new FormData();
    fd.append('request', String(request.id));
    fd.append('stage', stage);
    fd.append('amount', String(amount));
    fd.append('proof_image', file);
    fd.append('transaction_reference', ref);
    try {
      await inspectionApi.payments.submit(fd);
      toast.success('Payment proof submitted!');
      onPaid();
    } catch { toast.error('Failed to submit payment'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="p-4 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
        <p className="text-sm text-brand-700 dark:text-brand-300 font-medium">
          {stage === 'deposit' ? 'Booking Deposit' : 'Remaining Balance'}: {' '}
          <span className="text-lg font-bold">{bill?.currency} {Number(amount).toLocaleString()}</span>
        </p>
        <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
          Transfer to our account and upload proof below
        </p>
      </div>

      {lipaNumbers.length > 0 && (
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Payment Options (Lipa Namba):</p>
          <div className="flex flex-wrap gap-3">
            {lipaNumbers.map(l => (
              <div key={l.id} className="flex-1 min-w-[220px] flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg shadow-sm">
                {l.network_logo && (
                  <div className="w-24 h-12 rounded bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden border border-gray-100 dark:border-gray-700">
                    <img src={l.network_logo} alt={l.network_name} className="w-full h-full object-contain" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{l.network_name}</p>
                  <p className="text-brand-600 font-mono font-bold tracking-wide">{l.number}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{l.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <input className="input" required placeholder="Transaction reference (required)"
        value={ref} onChange={(e) => setRef(e.target.value)} />
      <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-surface-border dark:border-surface-dark-border rounded-lg cursor-pointer hover:border-brand-400 transition">
        <Upload size={24} className="text-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {file ? file.name : 'Click to upload payment proof'}
        </span>
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      <button type="submit" disabled={loading} className="w-full btn-primary py-2.5">
        {loading ? 'Submitting...' : 'Submit Payment Proof'}
      </button>
    </form>
  );
};

// ─── Bill Display ───────────────────────────
const BillDisplay: React.FC<{ request: InspectionRequest; onPaid: () => void }> = ({ request, onPaid }) => {
  const [acking, setAcking] = useState(false);
  const bill = request.bill;
  if (!bill) return null;

  const lines = [
    { label: 'Base Rate', amount: bill.base_rate },
    { label: 'Turnaround Surcharge', amount: bill.turnaround_surcharge },
    { label: 'Inspector Level', amount: bill.inspector_level_surcharge },
    { label: 'Complexity / Age', amount: bill.complexity_surcharge },
    { label: 'Travel', amount: bill.travel_surcharge },
    { label: 'Re-inspection Coverage', amount: bill.reinspection_coverage_fee },
  ].filter((l) => Number(l.amount) > 0);

  const allPaid = request.payments.some(
    (p) => p.stage === 'balance' && p.status === 'approved'
  );
  const depositApproved = request.payments.some(
    (p) => p.stage === 'deposit' && p.status === 'approved'
  );

  const handleAcknowledge = async () => {
     setAcking(true);
     try {
       await inspectionApi.requests.acknowledgeBill(request.id);
       toast.success('Bill accepted. You can now proceed to payment.');
       onPaid(); // Reload request
     } catch {
       toast.error('Failed to acknowledge bill');
     } finally {
       setAcking(false);
     }
  };

  const showPaymentForm = request.status === 'awaiting_payment' || (depositApproved && !allPaid);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <FileText size={16} className="text-brand-600" /> Inspection Bill
        </h3>
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{l.label}</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {fmtMoney(l.amount, bill.currency)}
              </span>
            </div>
          ))}
          <div className="border-t border-surface-border dark:border-surface-dark-border pt-2 mt-2">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-gray-900 dark:text-white">{fmtMoney(bill.total_amount, bill.currency)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-brand-600">Deposit (30%)</span>
              <span className="text-brand-600 font-semibold">{fmtMoney(bill.deposit_amount, bill.currency)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500 dark:text-gray-400">Remaining Balance</span>
              <span className="text-gray-700 dark:text-gray-300">{fmtMoney(bill.remaining_balance, bill.currency)}</span>
            </div>
          </div>
        </div>

        {request.status === 'bill_sent' && (
          <div className="mt-4 pt-4 border-t border-surface-border dark:border-surface-dark-border">
            <button
              onClick={handleAcknowledge}
              disabled={acking}
              className="w-full btn-primary py-2.5 flex items-center justify-center gap-2"
            >
              {acking ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              Accept Bill & Proceed to Payment
            </button>
            <p className="text-[10px] text-gray-500 text-center mt-2">
              By clicking accept, you agree to the inspection terms and pricing.
            </p>
          </div>
        )}
      </div>

      {showPaymentForm && !allPaid && <PaymentUpload request={request} onPaid={onPaid} />}
      
      {depositApproved && !allPaid && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
          <CheckCircle size={14} />
          Deposit confirmed. Inspection will be scheduled. Pay balance when requested.
        </div>
      )}
      {allPaid && (
        <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-sm text-green-800 dark:text-green-200 flex items-center gap-2 font-medium">
          <CheckCircle size={14} /> Fully paid ✓
        </div>
      )}
    </div>
  );
};

// ─── Inspection Timeline ────────────────────
const Timeline: React.FC<{ status: string }> = ({ status }) => {
  // Handle terminal/special statuses outside main flow
  if (status === 'cancelled') {
    return (
      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3">
        <X size={18} className="text-red-500 shrink-0" />
        <div>
          <p className="font-semibold text-red-700 dark:text-red-400">Inspection Cancelled</p>
          <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">This inspection request has been cancelled. Contact support if you need help.</p>
        </div>
      </div>
    );
  }
  if (status === 'blocked') {
    return (
      <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 flex items-center gap-3">
        <AlertTriangle size={18} className="text-orange-500 shrink-0" />
        <div>
          <p className="font-semibold text-orange-700 dark:text-orange-400">On Hold</p>
          <p className="text-xs text-orange-500 dark:text-orange-500 mt-0.5">Your inspection is temporarily on hold. Our team will be in touch shortly.</p>
        </div>
      </div>
    );
  }
  if (status === 'rescheduled') {
    return (
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center gap-3">
        <RefreshCw size={18} className="text-blue-500 shrink-0" />
        <div>
          <p className="font-semibold text-blue-700 dark:text-blue-400">Rescheduled</p>
          <p className="text-xs text-blue-500 dark:text-blue-500 mt-0.5">Your inspection has been rescheduled. A new time will be confirmed shortly.</p>
        </div>
      </div>
    );
  }

  const steps = [
    { key: 'requested', label: 'Requested' },
    { key: 'bill_sent', label: 'Bill Ready' },
    { key: 'awaiting_payment', label: 'Awaiting Payment' },
    { key: 'deposit_paid', label: 'Deposit Paid' },
    { key: 'pre_inspection', label: 'Pre-Inspection' },
    { key: 'assigned', label: 'Inspector Assigned' },
    { key: 'in_progress', label: 'Inspection Running' },
    { key: 'qa_review', label: 'QA Review' },
    { key: 'published', label: 'Report Ready' },
  ];
  const currentIdx = steps.findIndex((s) => s.key === status);

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-4">
        {steps.map((step, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} className="flex items-center gap-4 relative">
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                done ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'
              } ${active ? 'ring-4 ring-brand-200 dark:ring-brand-900' : ''}`}>
                {done ? (
                  <CheckCircle size={14} className="text-white" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                )}
              </div>
              <span className={`text-sm transition ${
                active ? 'font-semibold text-brand-600 dark:text-brand-400'
                  : done ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-600'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Report View ────────────────────────────
const ReportView: React.FC<{ request: InspectionRequest; onReInspect: () => void }> = ({ request, onReInspect }) => {
  const report = request.report;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (report?.responses) {
      const sections = Array.from(new Set(report.responses.map(r => r.section || 'General')));
      const initial: Record<string, boolean> = {};
      sections.forEach(s => { initial[s] = true; });
      setOpenSections(initial);
    }
  }, [report]);

  if (!report || !report.is_locked) return null;

  const score = parseFloat(report.quality_score || '0');
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getGradeColors = (grade: string) => {
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return {
      text: 'text-emerald-600 dark:text-emerald-400',
      stroke: 'stroke-emerald-600 dark:stroke-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-200 dark:border-emerald-800'
    };
    if (g.startsWith('B')) return {
      text: 'text-blue-600 dark:text-blue-400',
      stroke: 'stroke-blue-600 dark:stroke-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-800'
    };
    if (g.startsWith('C')) return {
      text: 'text-amber-600 dark:text-amber-400',
      stroke: 'stroke-amber-600 dark:stroke-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800'
    };
    if (g.startsWith('D')) return {
      text: 'text-orange-600 dark:text-orange-400',
      stroke: 'stroke-orange-600 dark:stroke-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      border: 'border-orange-200 dark:border-orange-800'
    };
    return {
      text: 'text-red-600 dark:text-red-400',
      stroke: 'stroke-red-600 dark:stroke-red-500',
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-200 dark:border-red-800'
    };
  };

  const colors = getGradeColors(report.grade || 'F');

  const criticalDefects = report.responses.filter(r => r.severity === 'critical' && r.flagged).length;
  const majorDefects = report.responses.filter(r => r.severity === 'major' && r.flagged).length;
  const advisoryDefects = report.responses.filter(r => r.severity === 'advisory' && r.flagged).length;

  const responsesBySection = report.responses.reduce((acc, r) => {
    const sec = r.section || 'General';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(r);
    return acc;
  }, {} as Record<string, ChecklistResponse[]>);

  const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const relative = path.startsWith('/') ? path : `/${path}`;
    return `${base}${relative}`;
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">

      {/* Report Header Controls */}
      <div className="flex items-center justify-between no-print bg-white dark:bg-slate-900 p-4 rounded-xl border border-surface-border dark:border-surface-dark-border shadow-sm">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Official Inspection Report
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg border border-brand-200 dark:bg-brand-950/20 dark:text-brand-400 dark:border-brand-900 transition-colors"
          >
            <Printer size={14} /> Print Report
          </button>
          <button
            onClick={onReInspect}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
          >
            <RefreshCw size={14} /> Re-inspect
          </button>
        </div>
      </div>

      {/* Grade and Scoring ring Card */}
      <div className={`print-card p-6 rounded-2xl border ${colors.border} ${colors.bg} flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden`}>
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-8 -translate-y-8">
          <Shield size={240} className={colors.text} />
        </div>
        <div className="flex items-center gap-4 z-10">
          <div className="relative flex items-center justify-center shrink-0 w-24 h-24">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-gray-200 dark:stroke-gray-800"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                className={`transition-all duration-1000 ${colors.stroke}`}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-3xl font-extrabold ${colors.text}`}>{report.grade}</span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{score}%</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black uppercase tracking-wider ${colors.text}`}>
                {report.verdict}
              </span>
              {report.verdict === 'pass' ? (
                <BadgeCheck size={20} className="text-emerald-600" />
              ) : report.verdict === 'conditional' ? (
                <AlertTriangle size={20} className="text-amber-500" />
              ) : (
                <ShieldAlert size={20} className="text-red-500" />
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase font-bold tracking-wider">
              Quality Grade Report
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 max-w-xl font-medium leading-relaxed">
              {report.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Defect severity counters */}
      <div className="grid grid-cols-3 gap-4 print-grid">
        <div className="print-card bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">Critical Issues</p>
            <p className="text-2xl font-black text-red-700 dark:text-red-400 mt-1">{criticalDefects}</p>
          </div>
          <ShieldAlert className="text-red-400 dark:text-red-600" size={32} />
        </div>
        <div className="print-card bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/30 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-wider">Major Issues</p>
            <p className="text-2xl font-black text-orange-700 dark:text-orange-400 mt-1">{majorDefects}</p>
          </div>
          <AlertTriangle className="text-orange-400 dark:text-orange-600" size={32} />
        </div>
        <div className="print-card bg-yellow-50/50 dark:bg-yellow-950/10 border border-yellow-100 dark:border-yellow-900/30 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-yellow-500 dark:text-yellow-400 uppercase tracking-wider">Advisory Items</p>
            <p className="text-2xl font-black text-yellow-700 dark:text-yellow-400 mt-1">{advisoryDefects}</p>
          </div>
          <Clock className="text-yellow-400 dark:text-yellow-600" size={32} />
        </div>
      </div>

      {/* Section-based Accordions */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b pb-2">Checklist Details</h3>
        {Object.entries(responsesBySection).map(([section, items]) => {
          const isOpen = openSections[section] ?? true;
          const flaggedCount = items.filter(i => i.flagged).length;
          return (
            <div key={section} className="print-card bg-white dark:bg-slate-900 border border-surface-border dark:border-surface-dark-border rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => toggleSection(section)}
                className="w-full flex items-center justify-between p-4 bg-gray-50/70 dark:bg-slate-800/40 border-b border-surface-border dark:border-surface-dark-border text-left no-print"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800 dark:text-gray-200 capitalize">
                    {section}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({items.length} items)
                  </span>
                  {flaggedCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                      {flaggedCount} issues
                    </span>
                  )}
                </div>
                {isOpen ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
              </button>
              
              {/* Printed section header */}
              <div className="hidden print:flex items-center justify-between p-3 border-b bg-gray-50 font-bold capitalize">
                <span>{section} ({items.length} items)</span>
                {flaggedCount > 0 && <span className="text-red-600 text-xs">{flaggedCount} issues found</span>}
              </div>

              <div className={isOpen ? 'block' : 'hidden print:block'}>
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {items.map((r) => {
                    const itemEvidences = request.evidence.filter(ev => ev.checklist_item === r.checklist_item);
                    return (
                      <div key={r.id} className={`p-4 transition-colors ${r.flagged ? 'bg-red-50/20 dark:bg-red-950/5' : 'hover:bg-gray-50/30 dark:hover:bg-slate-800/10'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold text-sm ${r.flagged ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                {r.item_label}
                              </span>
                              <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                r.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                                  : r.severity === 'major' ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400'
                              }`}>
                                {r.severity}
                              </span>
                            </div>
                            {r.notes && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-slate-900/50 p-2 rounded border border-gray-100 dark:border-slate-800 mt-1">
                                {r.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.flagged ? (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-black uppercase">
                                <X size={12} strokeWidth={3} /> {r.response_value}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-black uppercase">
                                <Check size={12} strokeWidth={3} /> {r.response_value}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Inline Evidence Display */}
                        {itemEvidences.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto py-1">
                            {itemEvidences.map(ev => (
                              <div
                                key={ev.id}
                                onClick={() => setSelectedImage(getImageUrl(ev.image))}
                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800 cursor-zoom-in group shrink-0"
                              >
                                <img
                                  src={getImageUrl(ev.image)}
                                  alt={ev.caption || 'Evidence'}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Camera size={14} className="text-white" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Evidence Gallery */}
      {request.evidence && request.evidence.length > 0 && (
        <div className="print-card bg-white dark:bg-slate-900 border border-surface-border dark:border-surface-dark-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Camera className="text-gray-500" size={20} /> Photo Gallery ({request.evidence.length} photos)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print-grid">
            {request.evidence.map((ev) => (
              <div
                key={ev.id}
                className="group relative border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden cursor-zoom-in"
                onClick={() => setSelectedImage(getImageUrl(ev.image))}
              >
                <div className="aspect-video w-full overflow-hidden bg-gray-100 dark:bg-slate-950">
                  <img
                    src={getImageUrl(ev.image)}
                    alt={ev.caption || 'Evidence'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-3 bg-gray-50/50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                    {ev.item_label || 'General Evidence'}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {ev.caption || 'No caption provided'}
                  </p>
                  {ev.captured_at && (
                    <p className="text-[9px] text-gray-400 mt-1">
                      {fmtDate(ev.captured_at)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GPS Integrity & Verification Badge */}
      <div className="print-card bg-slate-950 text-white rounded-2xl p-6 relative overflow-hidden shadow-md">
        <div className="absolute right-0 bottom-0 transform translate-x-12 translate-y-12 opacity-5">
          <Shield size={200} />
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black tracking-wider uppercase">GPS & Cryptographic Integrity</h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
                Verified On-Site
              </span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">Assuring inspector presence and report immutability.</p>
          </div>
          <div className="font-mono text-right text-xs shrink-0 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
            <span className="text-white/40 block text-[9px] uppercase tracking-wider font-bold mb-0.5">Report Signature</span>
            {report.report_hash ? (
              <span className="text-amber-400 font-bold">{report.report_hash.slice(0, 24)}...</span>
            ) : (
              <span className="text-red-400 uppercase tracking-widest text-[10px]">Unsigned</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-grid">
          <div>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <MapPin size={12} className="text-brand-400" /> Site Check-In Verify
            </p>
            <div className="flex items-center gap-3">
              {request.checkin?.checkin_photo ? (
                <img
                  src={getImageUrl(request.checkin.checkin_photo)}
                  alt="Check-In"
                  className="w-16 h-16 object-cover rounded-lg border border-white/10 cursor-zoom-in"
                  onClick={() => setSelectedImage(getImageUrl(request.checkin!.checkin_photo))}
                />
              ) : (
                <div className="w-16 h-16 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center text-white/20">
                  <Camera size={20} />
                </div>
              )}
              <div className="text-xs space-y-1 text-white/70">
                <div>
                  <span className="text-white/40">Timestamp: </span>
                  {request.checkin?.checkin_at ? fmtDate(request.checkin.checkin_at) : 'N/A'}
                </div>
                <div>
                  <span className="text-white/40">Coordinates: </span>
                  {request.checkin?.checkin_lat && request.checkin?.checkin_lng ? (
                    <span className="font-mono">{parseFloat(request.checkin.checkin_lat.toString()).toFixed(6)}, {parseFloat(request.checkin.checkin_lng.toString()).toFixed(6)}</span>
                  ) : 'N/A'}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1">
                  <CheckCircle size={10} /> Inspector on-site verification confirmed
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <MapPin size={12} className="text-brand-400" /> Site Check-Out Verify
            </p>
            <div className="flex items-center gap-3">
              {request.checkin?.checkout_photo ? (
                <img
                  src={getImageUrl(request.checkin.checkout_photo)}
                  alt="Check-Out"
                  className="w-16 h-16 object-cover rounded-lg border border-white/10 cursor-zoom-in"
                  onClick={() => setSelectedImage(getImageUrl(request.checkin!.checkout_photo))}
                />
              ) : (
                <div className="w-16 h-16 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center text-white/20">
                  <Camera size={20} />
                </div>
              )}
              <div className="text-xs space-y-1 text-white/70">
                <div>
                  <span className="text-white/40">Timestamp: </span>
                  {request.checkin?.checkout_at ? fmtDate(request.checkin.checkout_at) : 'In Progress'}
                </div>
                <div>
                  <span className="text-white/40">Coordinates: </span>
                  {request.checkin?.checkout_lat && request.checkin?.checkout_lng ? (
                    <span className="font-mono">{parseFloat(request.checkin.checkout_lat.toString()).toFixed(6)}, {parseFloat(request.checkin.checkout_lng.toString()).toFixed(6)}</span>
                  ) : 'N/A'}
                </div>
                <div className="text-[10px] text-white/50 mt-1">
                  Location verified within geofence threshold
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {report.approved_at && (
        <p className="text-xs text-center text-gray-400 mt-6 font-semibold">
          Approved and digitally signed by {report.approved_by_username} on {fmtDate(report.approved_at)}
        </p>
      )}

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 no-print"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={selectedImage}
            alt="Enlarged evidence"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

// ─── Request Detail ─────────────────────────
const RequestDetail: React.FC = () => {
  const { id } = useParams();
  const [request, setRequest] = useState<InspectionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReInspect, setShowReInspect] = useState(false);
  const [reInspectReason, setReInspectReason] = useState('');

  const load = () => {
    const numericId = Number(id);
    if (isNaN(numericId)) {
      setLoading(false);
      return;
    }
    inspectionApi.requests.get(numericId)
      .then((r: any) => setRequest(r.data))
      .catch(() => toast.error('Failed to load inspection'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleReInspect = async () => {
    if (!request || !reInspectReason) return;
    try {
      await inspectionApi.reinspection.create({
        original_request: request.id,
        reason: reInspectReason,
      });
      toast.success('Re-inspection requested');
      setShowReInspect(false);
      load();
    } catch { toast.error('Failed to request re-inspection'); }
  };

  if (loading) return <Spinner />;
  if (!request) return <p className="text-center py-12 text-gray-400">Inspection not found</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge text={STATUS_LABELS[request.status] || request.status}
                className={STATUS_COLORS[request.status] || 'badge-gray'} />
              {request.report?.is_locked && (
                <Badge text={request.report.verdict.toUpperCase()}
                  className={VERDICT_COLORS[request.report.verdict]} />
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{request.item_name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{request.category_path}</p>
            <p className="font-mono text-xs text-gray-400 mt-1">{request.inspection_id}</p>
          </div>
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            <p>Scope: <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{request.scope}</span></p>
            <p>Turnaround: <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{request.turnaround}</span></p>
            <p className="mt-1 text-xs">{fmtDate(request.created_at)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-1">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Progress</h3>
            <Timeline status={request.status} />

            {request.assignment && (
              <div className="mt-5 pt-4 border-t border-surface-border dark:border-surface-dark-border space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Assigned Inspector</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {request.assignment.inspector_name}
                </p>
                <Badge text={request.assignment.inspector_level}
                  className="badge-blue mt-1 capitalize" />
                {request.assignment.sla_deadline && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Clock size={12} />
                    <span>Expected by {fmtDate(request.assignment.sla_deadline)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Item info */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Item Details</h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500">Location:</span> <span className="text-gray-700 dark:text-gray-300 ml-2">{request.item_address}</span></div>
              <div><span className="text-gray-500">Description:</span> <span className="text-gray-700 dark:text-gray-300 ml-2">{request.item_description}</span></div>
              {request.item_age_years && (
                <div><span className="text-gray-500">Age:</span> <span className="text-gray-700 dark:text-gray-300 ml-2">{request.item_age_years} years</span></div>
              )}
            </div>
          </div>

          {/* Bill & Payment */}
          {request.bill && <BillDisplay request={request} onPaid={load} />}

          {/* Report */}
          {request.report?.is_locked && (
            <ReportView request={request} onReInspect={() => setShowReInspect(true)} />
          )}

          {/* Re-inspection modal */}
          {showReInspect && (
            <div className="card p-5 border-2 border-brand-300 dark:border-brand-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Request Re-Inspection</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                A different inspector will be assigned. Only use if inspection conditions were compromised.
              </p>
              <textarea className="input mb-3" rows={3} placeholder="Reason for re-inspection..."
                value={reInspectReason}
                onChange={(e) => setReInspectReason(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={handleReInspect} className="btn-primary px-4 py-2 text-sm">
                  Confirm Request
                </button>
                <button onClick={() => setShowReInspect(false)} className="btn-secondary px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Product Snapshot (Sidebar) */}
        {request.product_snapshot && (
          <div className="lg:col-span-3">
            <div className="card overflow-hidden">
               <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-surface-border dark:border-surface-dark-border flex items-center justify-between">
                 <div>
                   <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                     <Shield size={18} className="text-brand-600" />
                     Marketplace Item State at Request Time
                   </h3>
                   <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wider">
                     Captured on {fmtDate(request.product_snapshot.captured_at)}
                   </p>
                 </div>
                 <Link to={`/product/${request.product_snapshot.id}`} className="text-brand-600 text-[10px] font-bold hover:underline">
                   View Current Product →
                 </Link>
               </div>
               <div className="p-5 flex flex-col md:flex-row gap-6">
                 {request.product_snapshot.image_url && (
                   <div className="w-full md:w-48 shrink-0">
                     <img 
                       src={request.product_snapshot.image_url.startsWith('http') ? request.product_snapshot.image_url : `${API_BASE_URL}${request.product_snapshot.image_url}`} 
                       alt={request.product_snapshot.name} 
                       className="w-full aspect-square object-cover rounded-lg shadow-sm"
                     />
                   </div>
                 )}
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-2">
                     <Badge text={request.product_snapshot.condition} className="badge-blue capitalize" />
                     <Badge text={`Stock: ${request.product_snapshot.stock}`} className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" />
                   </div>
                   <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{request.product_snapshot.name}</h4>
                   <p className="text-brand-600 font-bold text-xl mb-3">{fmtMoney(request.product_snapshot.price)}</p>
                   <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-surface-border dark:border-surface-dark-border">
                     <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic line-clamp-3">
                       "{request.product_snapshot.description}"
                     </p>
                   </div>
                   <div className="mt-4 p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-lg">
                      <p className="text-[10px] text-brand-700 dark:text-brand-300 leading-relaxed">
                        <span className="font-bold">Note:</span> This is a persistent snapshot of the item's details when this inspection was requested. 
                        Changes to the marketplace listing after this point are not reflected here to maintain verification integrity.
                      </p>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── My Inspections List ────────────────────
const MyInspections: React.FC = () => {
  const [requests, setRequests] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyId, setVerifyId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    inspectionApi.requests.list()
      .then((r: any) => setRequests(r.data.results || r.data))
      .catch(() => toast.error('Failed to load inspections'))
      .finally(() => setLoading(false));
  }, []);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyId.trim()) return;
    navigate(`/verify/${verifyId.trim()}`);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8">
      {/* Verify Public Portal Card */}
      <div className="card p-5 border-2 border-brand-100 dark:border-brand-900/30 bg-brand-50/50 dark:bg-brand-900/10">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Shield size={18} className="text-brand-600" />
          Verify an Inspection
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Paste a public inspection ID (e.g. UZ-VEH-20260428-00001) to verify its authenticity and view the report summary.
        </p>
        <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            className="input flex-1 uppercase font-mono"
            placeholder="Enter Inspection ID..."
            value={verifyId}
            onChange={(e) => setVerifyId(e.target.value.toUpperCase())}
          />
          <button type="submit" className="btn-primary py-2.5 px-6 whitespace-nowrap flex items-center justify-center gap-2">
            <Search size={16} /> Verify
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Inspections</h1>
          <Link to="/inspections/new" className="btn-primary text-sm px-4 py-2">
            + New Request
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="card p-12 text-center">
            <ClipboardList size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No inspections yet</p>
            <Link to="/inspections/new" className="btn-primary text-sm px-5 py-2">
              Request your first inspection
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req: any) => (
              <button key={req.id} onClick={() => navigate(`/inspections/${req.id}`)}
                className="card p-4 w-full text-left hover:shadow-card-hover transition group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge text={STATUS_LABELS[req.status] || req.status}
                        className={STATUS_COLORS[req.status] || 'badge-gray'} />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 transition line-clamp-1">
                      {req.item_name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{req.category_path}</p>
                    <p className="font-mono text-xs text-gray-400 mt-1">{req.inspection_id}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{fmtDate(req.created_at)}</p>
                    {req.has_report && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Report ready</span>
                    )}
                    <ChevronRight size={16} className="text-gray-400 mt-1 ml-auto" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Notifications ──────────────────────────
const NotificationsPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<InspectionNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    inspectionApi.notifications.list()
      .then((r: any) => setNotifications(r.data.results || r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await inspectionApi.notifications.markAllRead();
    setNotifications((n) => n.map((x) => ({ ...x, is_read: true })));
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bell size={18} className="text-brand-600" /> Notifications
        </h2>
        <button onClick={markAllRead} className="btn-ghost text-xs px-3 py-1.5">Mark all read</button>
      </div>
      {notifications.length === 0 ? (
        <div className="card p-10 text-center">
          <Bell size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No notifications</p>
        </div>
      ) : (
        notifications.map((n) => (
          <div key={n.id} className={`card p-4 ${!n.is_read ? 'border-brand-300 dark:border-brand-700' : ''}`}>
            <div className="flex items-start gap-3">
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-brand-600 mt-1.5 shrink-0" />}
              <div className="flex-1">
                <p className="text-sm text-gray-700 dark:text-gray-300">{n.message}</p>
                {n.request_id && (
                  <Link to={`/inspections/${n.related_request}`}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-0.5 inline-block">
                    View inspection {n.request_id}
                  </Link>
                )}
                <p className="text-xs text-gray-400 mt-1">{fmtDate(n.created_at)}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// ─── Public Verify Page ─────────────────────
export const PublicVerifyPage: React.FC = () => {
  const { inspection_id } = useParams();
  const [query, setQuery] = useState(inspection_id || '');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await inspectionApi.requests.verify(q.trim());
      setResult(res.data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  useEffect(() => {
    if (inspection_id) doSearch(inspection_id);
  }, []);

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <div className="card p-8 text-center">
        <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
          <Shield size={28} className="text-brand-600 dark:text-brand-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verify Inspection</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Enter an Inspection ID to verify its authenticity
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input className="input" placeholder="e.g. UZ-AUT-20240424-00001"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" className="btn-primary px-4 py-2 shrink-0">
            <Search size={16} />
          </button>
        </form>

        {loading && <div className="mt-6"><Spinner /></div>}

        {searched && !loading && !result && (
          <div className="mt-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            No inspection found with this ID.
          </div>
        )}

        {result && (
          <div className={`mt-6 p-5 rounded-xl border-2 text-left ${
            result.is_verified
              ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-700'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {result.is_verified
                ? <CheckCircle size={20} className="text-green-600" />
                : <Clock size={20} className="text-yellow-600" />}
              <span className={`font-bold ${result.is_verified ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                {result.is_verified ? 'Verified Inspection' : 'Inspection In Progress'}
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{result.inspection_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category</span>
                <span className="text-gray-700 dark:text-gray-300">{result.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <Badge text={result.status} className={STATUS_COLORS[result.status] || 'badge-gray'} />
              </div>
              {result.verdict && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Verdict</span>
                  <Badge text={result.verdict.toUpperCase()} className={VERDICT_COLORS[result.verdict]} />
                </div>
              )}
              {result.report_hash && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Report Hash</span>
                  <span className="font-mono text-xs text-gray-400">{result.report_hash.slice(0, 20)}…</span>
                </div>
              )}
              {result.inspected_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Inspected</span>
                  <span className="text-gray-700 dark:text-gray-300">{fmtDate(result.inspected_at)}</span>
                </div>
              )}
            </div>

            {/* Render full report if verified */}
            {result.is_verified && result.summary && (
              <div className="mt-5 pt-5 border-t border-green-200 dark:border-green-800/50 space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {result.quality_score && (
                    <div className="text-center shrink-0">
                      <div className="text-2xl font-black text-gray-900 dark:text-white">{parseFloat(result.quality_score).toFixed(1)}%</div>
                      <div className="text-[10px] uppercase font-bold text-gray-500">Score</div>
                    </div>
                  )}
                  {result.grade && (
                    <div className="text-center shrink-0">
                      <div className={`text-2xl font-black ${
                        result.grade.startsWith('A') ? 'text-green-600' :
                        result.grade.startsWith('B') ? 'text-blue-600' :
                        result.grade.startsWith('C') ? 'text-amber-500' : 'text-red-500'
                      }`}>{result.grade}</div>
                      <div className="text-[10px] uppercase font-bold text-gray-500">Grade</div>
                    </div>
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{result.summary}"</p>
                  </div>
                </div>

                {result.flagged_items && result.flagged_items.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Flagged Issues ({result.flagged_items.length})</p>
                    <div className="divide-y divide-green-200/50 dark:divide-green-800/30">
                      {result.flagged_items.map((fi: any, idx: number) => (
                        <div key={idx} className="py-2.5 flex items-start gap-3">
                          <AlertTriangle size={14} className={
                            fi.severity === 'critical' ? 'text-red-500 mt-0.5 shrink-0' :
                            fi.severity === 'major' ? 'text-amber-500 mt-0.5 shrink-0' : 'text-blue-500 mt-0.5 shrink-0'
                          } />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-gray-900 dark:text-white">{fi.label}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                fi.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                                fi.severity === 'major' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                              }`}>{fi.severity}</span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Found: <span className="font-medium text-gray-800 dark:text-gray-200">{fi.response}</span></p>
                            {fi.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{fi.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Layout ─────────────────────────────────
const InspectionLayout: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Routes>
        <Route index element={<MyInspections />} />
        <Route path="new" element={<RequestForm />} />
        <Route path=":id" element={<RequestDetail />} />
        <Route path="notifications" element={<NotificationsPanel />} />
      </Routes>
    </div>
  );
};

export default InspectionLayout;
