import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ClipboardList, ChevronRight, Upload, CheckCircle, AlertTriangle,
  XCircle, Clock, FileText, Bell, Search, RefreshCw, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import inspectionApi from '../../api/inspectionApi';
import {
  InspectionCategory, InspectionRequest, InspectionNotification,
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
  const bill = request.bill;

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
    if (!file) { toast.error('Please upload proof of payment'); return; }
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
      <input className="input" placeholder="Transaction reference (optional)"
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
  const steps = [
    { key: 'requested', label: 'Requested' },
    { key: 'bill_sent', label: 'Bill Ready' },
    { key: 'awaiting_payment', label: 'Awaiting Payment' },
    { key: 'deposit_paid', label: 'Deposit Paid' },
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
  if (!report || !report.is_locked) return null;

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className={`p-5 rounded-xl border ${
        report.verdict === 'pass' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : report.verdict === 'conditional' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          {report.verdict === 'pass' ? <CheckCircle size={24} className="text-green-600" />
            : report.verdict === 'conditional' ? <AlertTriangle size={24} className="text-yellow-600" />
            : <XCircle size={24} className="text-red-600" />}
          <span className={`text-2xl font-bold uppercase ${
            report.verdict === 'pass' ? 'text-green-700 dark:text-green-400'
              : report.verdict === 'conditional' ? 'text-yellow-700 dark:text-yellow-400'
              : 'text-red-700 dark:text-red-400'
          }`}>
            {report.verdict}
          </span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">{report.summary}</p>
      </div>

      {/* Checklist Results */}
      {report.responses.length > 0 && (
        <div className="card p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Checklist Results</h4>
          <div className="space-y-2">
            {report.responses.map((r) => (
              <div key={r.id} className={`flex items-start justify-between p-2 rounded-lg text-sm ${
                r.flagged ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800/50'
              }`}>
                <div className="flex-1">
                  <span className="text-gray-700 dark:text-gray-300">{r.item_label}</span>
                  {r.notes && <p className="text-xs text-gray-500 mt-0.5">{r.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {r.flagged && <AlertTriangle size={12} className="text-red-500" />}
                  <span className={`font-medium ${r.flagged ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {r.response_value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Inspection ID</p>
          <p className="font-mono font-bold text-gray-900 dark:text-white">{request.inspection_id}</p>
          <p className="text-xs text-gray-400 mt-1">Hash: {report.report_hash.slice(0, 16)}…</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/verify/${request.inspection_id}`}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
            <Shield size={12} /> Verify
          </Link>
          <button onClick={onReInspect} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1">
            <RefreshCw size={12} /> Re-inspect
          </button>
        </div>
      </div>

      {report.approved_at && (
        <p className="text-xs text-center text-gray-400">
          Approved by {report.approved_by_username} on {fmtDate(report.approved_at)}
        </p>
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
              <div className="mt-5 pt-4 border-t border-surface-border dark:border-surface-dark-border">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Inspector</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {request.assignment.inspector_name}
                </p>
                <Badge text={request.assignment.inspector_level}
                  className="badge-blue mt-1 capitalize" />
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
                       src={request.product_snapshot.image_url.startsWith('http') ? request.product_snapshot.image_url : `http://localhost:8000${request.product_snapshot.image_url}`} 
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
                   <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                      <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
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
  const navigate = useNavigate();

  useEffect(() => {
    inspectionApi.requests.list()
      .then((r: any) => setRequests(r.data.results || r.data))
      .catch(() => toast.error('Failed to load inspections'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
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
