import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ClipboardList, ChevronRight, Upload, CheckCircle, AlertTriangle,
  Clock, FileText, Bell, Search, RefreshCw, Shield,
  MapPin, Camera, Printer, ChevronDown, ChevronUp, Check, X, ShieldAlert, BadgeCheck, Plus, ArrowLeft, ExternalLink, Lock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import inspectionApi from '../../api/inspectionApi';
import api, { API_BASE_URL } from '../../api';
import './InspectionLayout.css';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { printInspectionReport } from '../../utils/PrintableInspectionReport';
import {
  InspectionCategory, InspectionRequest, InspectionNotification, ChecklistResponse,
  STATUS_LABELS, STATUS_COLORS, VERDICT_COLORS, fmtDate, fmtMoney,
} from '../../types/inspection';
import { CardListSkeleton } from '../../components/Skeleton';

// ─── Helpers ───────────────────────────────
const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {text}
  </span>
);

// ─── Category Dropdown Selector ──────────────
const CategoryDropdownSelector: React.FC<{
  categories: InspectionCategory[];
  selected: InspectionCategory | null;
  onSelect: (c: InspectionCategory | null) => void;
}> = ({ categories, selected, onSelect }) => {
  const [level1Id, setLevel1Id] = useState<number | ''>('');
  const [level2Id, setLevel2Id] = useState<number | ''>('');
  const [level3Id, setLevel3Id] = useState<number | ''>('');

  const topCategories = categories.filter((c) => !c.parent);

  useEffect(() => {
    if (!selected) {
      setLevel1Id('');
      setLevel2Id('');
      setLevel3Id('');
      return;
    }
    const findParents = (targetId: number): number[] => {
      for (const top of topCategories) {
        if (top.id === targetId) return [top.id];
        if (top.children) {
          for (const mid of top.children) {
            if (mid.id === targetId) return [top.id, mid.id];
            if (mid.children) {
              for (const leaf of mid.children) {
                if (leaf.id === targetId) return [top.id, mid.id, leaf.id];
              }
            }
          }
        }
      }
      return [targetId];
    };
    const lineage = findParents(selected.id);
    if (lineage.length >= 1) setLevel1Id(lineage[0]);
    if (lineage.length >= 2) setLevel2Id(lineage[1]);
    if (lineage.length >= 3) setLevel3Id(lineage[2]);
  }, [selected, categories]);

  const level1Cat = topCategories.find((c) => c.id === Number(level1Id));
  const level2Options = level1Cat?.children || [];

  const level2Cat = level2Options.find((c) => c.id === Number(level2Id));
  const level3Options = level2Cat?.children || [];

  const handleLevel1Change = (id: number | '') => {
    setLevel1Id(id);
    setLevel2Id('');
    setLevel3Id('');
    if (!id) {
      onSelect(null);
      return;
    }
    const cat = topCategories.find((c) => c.id === Number(id));
    if (cat && (!cat.children || cat.children.length === 0)) {
      onSelect(cat);
    } else {
      onSelect(null);
    }
  };

  const handleLevel2Change = (id: number | '') => {
    setLevel2Id(id);
    setLevel3Id('');
    if (!id) {
      onSelect(level1Cat || null);
      return;
    }
    const cat = level2Options.find((c) => c.id === Number(id));
    if (cat && (!cat.children || cat.children.length === 0)) {
      onSelect(cat);
    } else {
      onSelect(null);
    }
  };

  const handleLevel3Change = (id: number | '') => {
    setLevel3Id(id);
    if (!id) {
      onSelect(level2Cat || null);
      return;
    }
    const cat = level3Options.find((c) => c.id === Number(id));
    onSelect(cat || null);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          value={level1Id}
          onChange={(e) => handleLevel1Change(e.target.value ? Number(e.target.value) : '')}
          className="input w-full cursor-pointer text-xs"
          required
        >
          <option value="">Select Category...</option>
          {topCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {level2Options.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Subcategory <span className="text-red-500">*</span>
          </label>
          <select
            value={level2Id}
            onChange={(e) => handleLevel2Change(e.target.value ? Number(e.target.value) : '')}
            className="input w-full cursor-pointer text-xs"
            required
          >
            <option value="">Select Subcategory...</option>
            {level2Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {level3Options.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Specific Type <span className="text-red-500">*</span>
          </label>
          <select
            value={level3Id}
            onChange={(e) => handleLevel3Change(e.target.value ? Number(e.target.value) : '')}
            className="input w-full cursor-pointer text-xs"
            required
          >
            <option value="">Select Type...</option>
            {level3Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selected && (
        <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-xs flex items-center justify-between">
          <span className="text-gray-500">
            Selected: <strong className="text-gray-900 dark:text-white">{selected.full_path || selected.name}</strong>
          </span>
          {selected.base_price && (
            <span className="text-brand-500 font-bold">Base: {fmtMoney(selected.base_price)}</span>
          )}
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
    item_name: '',
    item_description: '',
    item_address: '',
    item_age_years: '',
    is_complex: false,
    scope: 'standard',
    turnaround: 'standard',
    reinspection_coverage: false,
    marketplace_product: null as number | null,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [prefilledProduct, setPrefilledProduct] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const marketId = params.get('marketplace_product_id');
    const name = params.get('item_name');
    const desc = params.get('item_description');
    const addr = params.get('item_address');

    // Immediate hydration from URL search params
    if (name || marketId || desc || addr) {
      setForm((f) => ({
        ...f,
        item_name: name || f.item_name,
        item_description: desc || f.item_description,
        item_address: addr || f.item_address,
        marketplace_product: marketId ? parseInt(marketId) : f.marketplace_product,
      }));
    }

    const load = async () => {
      try {
        let cats: InspectionCategory[] = [];
        try {
          const res = await inspectionApi.categories.list();
          cats = res.data.results || res.data || [];
          setCategories(cats);
        } catch (catErr) {
          console.warn('Failed to load categories list', catErr);
        }

        if (marketId) {
          try {
            setLoading(true);
            const preRes = await inspectionApi.requests.prefillMarketplace(parseInt(marketId));
            const data = preRes.data;

            setForm((f) => ({
              ...f,
              item_name: data.item_name || f.item_name || '',
              item_description: data.item_description || f.item_description || '',
              item_address: data.item_address || f.item_address || '',
              marketplace_product: data.product?.id || parseInt(marketId),
            }));

            if (data.product) {
              setPrefilledProduct(data.product);
            }

            const found = cats.find((c: any) => c.id === data.category?.id) || data.category;
            if (found) setSelectedCategory(found);
          } catch (preErr) {
            console.warn('Marketplace prefill endpoint error, using URL fallback', preErr);
            const catName = params.get('category_name');
            if (catName && cats.length > 0) {
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
          } finally {
            setLoading(false);
          }
        } else {
          const catName = params.get('category_name');
          if (catName && cats.length > 0) {
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
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [location.search]);

  // Intelligent dynamic pricing engine matching backend/inspections/pricing.py
  const hasCategory = Boolean(
    selectedCategory &&
      (Number(selectedCategory.dynamic_base_price) > 0 || Number(selectedCategory.base_price) > 0)
  );
  const basePrice = hasCategory
    ? Number(selectedCategory!.dynamic_base_price || selectedCategory!.base_price)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) {
      toast.error('Please select an inspection category');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        item_description: form.notes
          ? `${form.item_description}\n\nClient Notes: ${form.notes}`
          : form.item_description,
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
    {
      value: 'basic',
      title: 'Basic Check',
      desc: 'Exterior condition & core functionality check',
      badge: '-20%',
    },
    {
      value: 'standard',
      title: 'Standard Audit',
      desc: 'Multi-point checklist & diagnostic inspection',
      badge: 'Recommended',
    },
    {
      value: 'deep',
      title: 'Specialist Diagnostic',
      desc: 'In-depth technical & component-level testing',
      badge: '+40%',
    },
  ];

  const turnaroundOptions = [
    { value: 'standard', title: 'Standard', time: '24–48 hours', surcharge: 'Included' },
    { value: 'express', title: 'Express', time: 'Same day', surcharge: '+30%' },
    { value: 'instant', title: 'Urgent', time: 'Within hours', surcharge: '+60%' },
  ];

  // Progressive reveal steps for custom item form (mobile-only)
  const isCategorySelected = Boolean(selectedCategory);
  const isNameFilled = form.item_name.trim().length > 0;
  const isDescFilled = form.item_description.trim().length > 0;
  const isAddressFilled = form.item_address.trim().length > 0;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/inspections"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white font-medium mb-2.5 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Inspections
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Schedule Physical Inspection
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Have an independent specialist inspect, test, and verify this item on-site.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Item Information & Notes (7 Columns) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Item Details */}
          <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                1. Item Information
              </h2>
              {!prefilledProduct && (
                <span className="text-2xs text-brand-600 dark:text-brand-400 font-medium">
                  {isAddressFilled
                    ? 'Step 1 Complete'
                    : isCategorySelected
                    ? 'Filling details...'
                    : 'Select category to start'}
                </span>
              )}
            </div>

            {prefilledProduct && (
              <div className="p-3.5 bg-gray-50 dark:bg-gray-700/30 border border-gray-200/80 dark:border-gray-700 rounded-xl flex items-start justify-between gap-3.5">
                <div className="flex items-start gap-3 min-w-0">
                  {prefilledProduct.image ? (
                    <img
                      src={
                        prefilledProduct.image.startsWith('http')
                          ? prefilledProduct.image
                          : `${API_BASE_URL}${prefilledProduct.image}`
                      }
                      alt={prefilledProduct.name}
                      className="w-16 h-16 object-cover rounded-lg shrink-0 border border-gray-200 dark:border-gray-700 bg-white"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 shrink-0 flex items-center justify-center text-gray-400">
                      <ClipboardList size={24} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                      Marketplace Item
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {prefilledProduct.name}
                    </h3>
                    {prefilledProduct.price !== undefined && prefilledProduct.price !== null && (
                      <p className="text-xs text-brand-500 font-bold mt-0.5">
                        {fmtMoney(prefilledProduct.price)}
                      </p>
                    )}
                    <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Seller: <strong className="text-gray-700 dark:text-gray-200">@{prefilledProduct.seller_username || 'seller'}</strong> • Category: <strong className="text-gray-700 dark:text-gray-200">{selectedCategory?.full_path || selectedCategory?.name || 'General'}</strong>
                    </p>
                  </div>
                </div>
                <Link
                  to={`/products/${prefilledProduct.id}`}
                  target="_blank"
                  className="btn-secondary text-2xs py-1 px-2.5 rounded-lg shrink-0 font-bold flex items-center gap-1"
                >
                  View Listing ↗
                </Link>
              </div>
            )}

            <div className="space-y-4">
              {/* Category selector for off-marketplace items */}
              {!prefilledProduct && (
                <div>
                  <CategoryDropdownSelector
                    categories={categories}
                    selected={selectedCategory}
                    onSelect={setSelectedCategory}
                  />
                </div>
              )}

              {/* Item Name (if off-marketplace) */}
              {!prefilledProduct && (
                <div
                  className={`space-y-4 pt-1 ${
                    isCategorySelected ? 'block animate-fade-in' : 'hidden sm:block'
                  }`}
                >
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Item Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="input text-xs"
                      required
                      placeholder="e.g. Toyota Crown 2018, iPhone 15 Pro, Solar Inverter"
                      value={form.item_name}
                      onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Description & Known Condition */}
              <div className={prefilledProduct || isNameFilled ? 'block animate-fade-in' : 'hidden sm:block'}>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description &amp; Specific Areas to Verify <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input text-xs"
                  rows={3}
                  required
                  placeholder="Describe item condition, key specifications, and any specific areas to examine..."
                  value={form.item_description}
                  onChange={(e) => setForm({ ...form, item_description: e.target.value })}
                />
              </div>

              {/* Physical Inspection Address & Age */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 ${
                  prefilledProduct || isDescFilled ? 'grid animate-fade-in' : 'hidden sm:grid'
                }`}
              >
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Physical Inspection / Seller Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="input text-xs"
                    required
                    placeholder="Street address or location where the item is available for inspection"
                    value={form.item_address}
                    onChange={(e) => setForm({ ...form, item_address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Item Age (years)
                  </label>
                  <input
                    className="input text-xs"
                    type="number"
                    min="0"
                    placeholder="Optional"
                    value={form.item_age_years}
                    onChange={(e) => setForm({ ...form, item_age_years: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="is_complex"
                    checked={form.is_complex}
                    onChange={(e) => setForm({ ...form, is_complex: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <label
                    htmlFor="is_complex"
                    className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    Complex / Industrial Item (+20%)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Instructions & Add-ons (Always visible on desktop, revealed on mobile after address is filled) */}
          <div
            className={`card p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-xs space-y-4 ${
              prefilledProduct || isAddressFilled ? 'block animate-fade-in' : 'hidden sm:block'
            }`}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              2. Additional Options & Notes
            </h2>

            <div className="p-3 bg-gray-50 dark:bg-gray-700/20 border border-gray-200 dark:border-gray-700 rounded-xl flex items-start gap-3">
              <input
                type="checkbox"
                id="reinspection"
                checked={form.reinspection_coverage}
                onChange={(e) => setForm({ ...form, reinspection_coverage: e.target.checked })}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <label
                htmlFor="reinspection"
                className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                <span className="font-bold">Re-inspection Coverage (+10%)</span>
                <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Provides a discounted follow-up inspection if repairs or seller condition fixes
                  are made.
                </p>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Special Instructions for Inspector (Optional)
              </label>
              <textarea
                className="input text-xs"
                rows={2}
                placeholder="Mention any specific parts, functions, or defects you want the inspector to examine closely..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Scope, Speed & Fee Summary (5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. Scope Selection (Cards on desktop, compact dropdown on mobile) */}
          <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Inspection Scope
            </h2>

            {/* Mobile Dropdown */}
            <div className="sm:hidden">
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className="input text-xs w-full cursor-pointer"
              >
                {scopeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.title} ({o.badge}) — {o.desc}
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop / Tablet Cards */}
            <div className="hidden sm:flex flex-col gap-2.5">
              {scopeOptions.map((o) => {
                const active = form.scope === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm({ ...form, scope: o.value })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/20 ring-1 ring-brand-500'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-xs font-bold ${
                          active
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {o.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          active
                            ? 'bg-brand-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {o.badge}
                      </span>
                    </div>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {o.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Turnaround Speed (Cards on desktop, compact dropdown on mobile) */}
          <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Turnaround Speed
            </h2>

            {/* Mobile Dropdown */}
            <div className="sm:hidden">
              <select
                value={form.turnaround}
                onChange={(e) => setForm({ ...form, turnaround: e.target.value })}
                className="input text-xs w-full cursor-pointer"
              >
                {turnaroundOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.title} ({o.time}) — {o.surcharge}
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop / Tablet Cards */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-2.5">
              {turnaroundOptions.map((o) => {
                const active = form.turnaround === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm({ ...form, turnaround: o.value })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/20 ring-1 ring-brand-500'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={`text-xs font-bold ${
                          active
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {o.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 block">{o.surcharge}</span>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">{o.time}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Official Quote Assessment & Submit Action */}
          <div className="card p-5 space-y-3.5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Official Quote Assessment</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              No payment is required right now. Staff will review the address, item complexity, and urgency to issue your official bill.
            </p>

            {hasCategory && basePrice && (
              <div className="flex justify-between items-center text-xs py-2 border-t border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Indicative Baseline:</span>
                <span className="font-semibold text-gray-900 dark:text-white">~{fmtMoney(basePrice)}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !hasCategory}
              className="btn-primary w-full py-2.5 text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              {loading
                ? 'Submitting...'
                : !hasCategory
                ? 'Select Category First'
                : 'Submit Request for Official Bill'}
            </button>
          </div>
        </div>
      </form>
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

  const depositApproved = request.payments.some(
    (p) => p.stage === 'deposit' && p.status === 'approved'
  );
  const allPaid = request.payments.some(
    (p) => p.stage === 'balance' && p.status === 'approved'
  );

  const stage: 'deposit' | 'balance' = !depositApproved ? 'deposit' : 'balance';
  const amount = stage === 'deposit'
    ? bill?.deposit_amount || (bill ? Math.round(Number(bill.total_amount) * 0.3) : 0)
    : bill?.remaining_balance || (bill ? Number(bill.total_amount) - (Number(bill.deposit_amount) || 0) : 0);

  const pendingPayment = request.payments.find(p => p.status === 'pending');

  if (pendingPayment) {
    const isDeposit = pendingPayment.stage === 'deposit';
    return (
      <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Clock size={14} className="text-amber-500 shrink-0" />
          <span className="text-gray-700 dark:text-gray-300 truncate">
            {isDeposit ? '30% Deposit' : '70% Balance'} ({fmtMoney(pendingPayment.amount, bill?.currency)}) • Ref: <strong className="font-mono text-gray-900 dark:text-white">{pendingPayment.transaction_reference}</strong>
          </span>
        </div>
        <span className="text-2xs text-amber-500 dark:text-amber-400 shrink-0 ml-2 font-medium">Awaiting confirmation</span>
      </div>
    );
  }

  if (allPaid) {
    return (
      <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
        <span>Paid in full • Report and certificate unlocked</span>
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
      toast.success(
        stage === 'deposit'
          ? '30% Deposit submitted! Waiting for accountant approval.'
          : 'Final balance submitted! Waiting for accountant approval.'
      );
      onPaid();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit payment proof');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">
            {stage === 'deposit' ? '30% Booking Deposit' : '70% Final Balance'}
          </p>
          <p className="text-2xs text-gray-400">
            {stage === 'deposit' ? 'Required to dispatch inspector' : 'Required to unlock full report'}
          </p>
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          {bill?.currency || 'TZS'} {Number(amount).toLocaleString()}
        </span>
      </div>

      {lipaNumbers.length > 0 && (
        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 space-y-2.5">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Pay via Mobile Money (Lipa Namba):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {lipaNumbers.map(l => (
              <div key={l.id} className="flex items-center gap-3 p-2.5 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700/80 rounded-lg shadow-2xs">
                {l.network_logo && (
                  <div className="w-10 h-10 rounded bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden border border-gray-100 dark:border-gray-700">
                    <img src={l.network_logo} alt={l.network_name} className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-2xs font-bold text-gray-900 dark:text-white uppercase">{l.network_name}</p>
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-mono font-bold tracking-wide">{l.number}</p>
                  <p className="text-3xs text-gray-400 uppercase truncate">{l.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <input 
        className="input text-xs" 
        required 
        placeholder="Mobile money transaction reference / SMS code"
        value={ref} 
        onChange={(e) => setRef(e.target.value)} 
      />
      <label className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-brand-500 transition">
        <Upload size={20} className="text-gray-400" />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {file ? file.name : 'Upload payment receipt screenshot'}
        </span>
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      <button type="submit" disabled={loading} className="w-full btn-primary py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl">
        {loading 
          ? 'Submitting Payment Proof...' 
          : stage === 'deposit' 
          ? 'Submit 30% Deposit Proof to Dispatch Inspector' 
          : 'Submit 70% Balance Proof to Unlock Report'}
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

  const isReportReady = Boolean(request.report) || request.status === 'published' || request.status === 'qa_review';
  const showPaymentForm = (!depositApproved && request.status === 'awaiting_payment') || (depositApproved && !allPaid && isReportReady);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <FileText size={16} className="text-brand-500" /> Inspection Bill
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
          <div className="border-t border-surface-border dark:border-surface-dark-border pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-gray-900 dark:text-white">{fmtMoney(bill.total_amount, bill.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={depositApproved ? "text-green-500 font-medium" : "text-gray-500 dark:text-gray-400"}>
                Deposit (30%) {depositApproved ? '✓ Paid' : ''}
              </span>
              <span className={depositApproved ? "text-green-500 font-semibold" : "text-gray-900 dark:text-white font-semibold"}>
                {fmtMoney(bill.deposit_amount, bill.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={allPaid ? "text-green-500 font-medium" : "text-gray-500 dark:text-gray-400"}>
                Remaining Balance {allPaid ? '✓ Paid' : ''}
              </span>
              <span className={allPaid ? "text-green-500 font-semibold" : "text-gray-700 dark:text-gray-300"}>
                {fmtMoney(bill.remaining_balance, bill.currency)}
              </span>
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
      
      {depositApproved && !allPaid && !isReportReady && (
        <div className="py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-green-500 font-medium">
            <CheckCircle size={14} /> 30% Deposit confirmed
          </span>
          <span className="text-2xs text-gray-400">70% Balance will be requested once report is ready</span>
        </div>
      )}
      {depositApproved && !allPaid && isReportReady && (
        <div className="py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-amber-500 font-medium">
            <Clock size={14} /> Report Ready — Pay 70% Balance to Unlock
          </span>
          <span className="text-2xs text-gray-400 font-medium">{fmtMoney(bill.remaining_balance, bill.currency)}</span>
        </div>
      )}
      {allPaid && (
        <div className="py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-green-500 flex items-center gap-2 font-medium">
          <CheckCircle size={14} /> Fully paid
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
      <div className="p-4 rounded-xl   border border-red-500 dark:border-red-500 flex items-center gap-3">
        <X size={18} className="text-red-500 shrink-0" />
        <div>
          <p className="font-semibold text-red-500 dark:text-red-500">Inspection Cancelled</p>
          <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">This inspection request has been cancelled. Contact support if you need help.</p>
        </div>
      </div>
    );
  }
  if (status === 'blocked') {
    return (
      <div className="p-4 rounded-xl   border border-orange-500 dark:border-orange-500 flex items-center gap-3">
        <AlertTriangle size={18} className="text-orange-500 shrink-0" />
        <div>
          <p className="font-semibold text-orange-500 dark:text-orange-500">On Hold</p>
          <p className="text-xs text-orange-500 dark:text-orange-500 mt-0.5">Your inspection is temporarily on hold. Our team will be in touch shortly.</p>
        </div>
      </div>
    );
  }
  if (status === 'rescheduled') {
    return (
      <div className="p-4 rounded-xl   border border-blue-500 dark:border-blue-500 flex items-center gap-3">
        <RefreshCw size={18} className="text-blue-500 shrink-0" />
        <div>
          <p className="font-semibold text-blue-500 dark:text-blue-500">Rescheduled</p>
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
    { key: 'submitted', label: 'Report Submitted' },
    { key: 'qa_review', label: 'QA Review' },
    { key: 'published', label: 'Report Ready' },
  ];
  const idx = steps.findIndex((s) => s.key === status);
  // If status not in steps (e.g. unknown future status), show all complete
  const currentIdx = idx >= 0 ? idx : steps.length - 1;

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
                done ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'
              } ${active ? 'ring-4 ring-brand-500 dark:ring-brand-500' : ''}`}>
                {done ? (
                  <CheckCircle size={14} className="text-white" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                )}
              </div>
              <span className={`text-sm transition ${
                active ? 'font-semibold text-brand-500 dark:text-brand-500'
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

// ─── Request Detail Skeleton ────────────────
const RequestDetailSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {/* Header Skeleton */}
    <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2.5 flex-1">
          <div className="flex gap-2">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
          </div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3" />
          <div className="h-4 bg-gray-100 dark:bg-gray-700/60 rounded-md w-1/4" />
        </div>
        <div className="w-32 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-100 dark:bg-gray-700/60 rounded w-3/4 ml-auto" />
        </div>
      </div>
    </div>

    {/* 2-Column Grid Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column Skeletons */}
      <div className="lg:col-span-1 space-y-5">
        <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="space-y-4 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                <div className="h-3.5 bg-gray-100 dark:bg-gray-700/60 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded w-full" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded w-5/6" />
        </div>
      </div>

      {/* Right Column Skeletons */}
      <div className="lg:col-span-2 space-y-5">
        <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              <div className="h-4 bg-gray-100 dark:bg-gray-700/60 rounded w-3/4" />
            </div>
          </div>
        </div>
        <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-10 bg-gray-100 dark:bg-gray-700/40 rounded-lg w-full" />
          <div className="h-10 bg-gray-100 dark:bg-gray-700/40 rounded-lg w-full" />
        </div>
      </div>
    </div>
  </div>
);

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
  const verdict = report.verdict || 'pass';

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
    <div className="space-y-4">
      {/* Top Action & Verdict Bar */}
      <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
            verdict === 'pass'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
              : verdict === 'conditional'
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800/60'
          }`}>
            {verdict === 'pass' ? <BadgeCheck size={14} className="text-emerald-600 dark:text-emerald-400" /> : verdict === 'conditional' ? <AlertTriangle size={14} className="text-amber-500" /> : <ShieldAlert size={14} className="text-red-500" />}
            <span>{verdict} • Grade {report.grade || 'A'} ({score}%)</span>
          </div>
          {report.summary && (
            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
              {report.summary}
            </span>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => printInspectionReport(request)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold btn-primary transition-all shadow-xs"
          >
            <Printer size={13} /> Print Official Report
          </button>
          <button
            onClick={onReInspect}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw size={12} /> Re-inspect
          </button>
        </div>
      </div>

      {/* Defect Summary Strip */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2.5 rounded-xl shadow-xs">
          <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400">Critical Issues</p>
          <p className={`text-base font-black mt-0.5 ${criticalDefects > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
            {criticalDefects}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2.5 rounded-xl shadow-xs">
          <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400">Major Issues</p>
          <p className={`text-base font-black mt-0.5 ${majorDefects > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'}`}>
            {majorDefects}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2.5 rounded-xl shadow-xs">
          <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400">Advisory Items</p>
          <p className={`text-base font-black mt-0.5 ${advisoryDefects > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-200'}`}>
            {advisoryDefects}
          </p>
        </div>
      </div>

      {/* Checklist Breakdown & Findings - Top Priority Focus */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
            <ClipboardList size={14} className="text-brand-500" />
            Checklist Breakdown & Findings
          </h3>
          <span className="text-2xs text-gray-400 font-semibold">
            {report.responses.length} checkpoints inspected
          </span>
        </div>

        {Object.entries(responsesBySection).map(([section, items]) => {
          const isOpen = openSections[section] ?? true;
          const flaggedCount = items.filter(i => i.flagged).length;
          return (
            <div key={section} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden shadow-xs">
              <button
                onClick={() => toggleSection(section)}
                className="w-full flex items-center justify-between p-3 bg-gray-50/70 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-gray-800 dark:text-gray-200 capitalize">
                    {section}
                  </span>
                  <span className="text-2xs text-gray-400">
                    ({items.length})
                  </span>
                  {flaggedCount > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/40 dark:text-red-400">
                      {flaggedCount} issues
                    </span>
                  )}
                </div>
                {isOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>

              {isOpen && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {items.map((r) => {
                    const itemEvidences = request.evidence.filter(ev => ev.checklist_item === r.checklist_item);
                    return (
                      <div key={r.id} className={`p-3 transition-colors ${r.flagged ? 'bg-red-50/20 dark:bg-red-950/10' : 'hover:bg-gray-50/40 dark:hover:bg-gray-700/20'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold text-xs ${r.flagged ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                {r.item_label}
                              </span>
                              <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                r.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                  : r.severity === 'major' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                              }`}>
                                {r.severity}
                              </span>
                            </div>
                            {r.notes ? (
                              <p className="text-2xs text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/40 p-1.5 rounded border border-gray-100 dark:border-gray-800">
                                {r.notes}
                              </p>
                            ) : (
                              <p className="text-2xs text-gray-400 italic">No defect notes recorded.</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {r.flagged ? (
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 rounded text-2xs font-black uppercase">
                                <X size={10} strokeWidth={3} /> {r.response_value || 'FAIL'}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded text-2xs font-black uppercase">
                                <Check size={10} strokeWidth={3} /> {r.response_value || 'PASS'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Inline Evidence Thumbnails - Compact */}
                        {itemEvidences.length > 0 && (
                          <div className="mt-2 flex gap-2 overflow-x-auto py-0.5">
                            {itemEvidences.map(ev => (
                              <div
                                key={ev.id}
                                onClick={() => setSelectedImage(getImageUrl(ev.image))}
                                className="relative w-12 h-12 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 cursor-zoom-in group shrink-0 bg-gray-100 dark:bg-gray-800"
                              >
                                <img
                                  src={getImageUrl(ev.image)}
                                  alt={ev.caption || 'Evidence'}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Camera size={11} className="text-white" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Photo Documentation - Neat Small Thumbnails */}
      {request.evidence && request.evidence.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white mb-2.5 flex items-center gap-1.5">
            <Camera className="text-brand-500" size={14} /> Photo Documentation ({request.evidence.length} photos)
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {request.evidence.map((ev) => (
              <div
                key={ev.id}
                className="group relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden cursor-zoom-in w-20 bg-gray-50 dark:bg-gray-900/60"
                onClick={() => setSelectedImage(getImageUrl(ev.image))}
              >
                <div className="w-20 h-16 overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={getImageUrl(ev.image)}
                    alt={ev.caption || 'Evidence'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="p-1 text-center bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-bold text-gray-800 dark:text-gray-200 truncate">
                    {ev.item_label || 'Evidence'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.approved_at && (
        <p className="text-2xs text-center text-gray-400 font-medium pt-1">
          Digitally signed by @{report.approved_by_username} on {fmtDate(report.approved_at)}
        </p>
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={22} />
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
  const navigate = useNavigate();
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

  useEffect(() => {
    load();

    // 1. WebSocket Live Stream via Redis
    let ws: WebSocket | null = null;
    const token = localStorage.getItem('token');
    const numericId = Number(id);

    if (token && !isNaN(numericId)) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/ws/notifications/?token=${token}`;
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.notification || data?.type === 'notification.push') {
              const notif = data.notification || data;
              if (
                notif.request_id === numericId ||
                notif.link?.includes(String(numericId)) ||
                (request && notif.inspection_id === request.inspection_id)
              ) {
                toast.success(notif.message || notif.title || 'Inspection status updated!');
                load();
              }
            }
          } catch (e) {
            console.error('WS notification parse error', e);
          }
        };
      } catch (e) {
        console.warn('WebSocket connection error:', e);
      }
    }

    // 2. Adaptive Backup Poller (polls every 5s while in active pending state)
    const interval = setInterval(() => {
      if (
        !isNaN(numericId) &&
        request &&
        ['requested', 'bill_sent', 'awaiting_payment', 'deposit_paid', 'pre_inspection', 'assigned', 'in_progress', 'submitted', 'qa_review'].includes(request.status)
      ) {
        inspectionApi.requests.get(numericId).then((r: any) => {
          if (
            r.data.status !== request.status ||
            JSON.stringify(r.data.payments) !== JSON.stringify(request.payments) ||
            Boolean(r.data.report?.is_locked) !== Boolean(request.report?.is_locked)
          ) {
            setRequest(r.data);
          }
        }).catch(() => {});
      }
    }, 5000);

    // 3. Auto-sync on window focus
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => {
      if (ws) ws.close();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [id, request?.status, request?.payments?.length]);

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

  if (loading) return <RequestDetailSkeleton />;
  if (!request) return <p className="text-center py-12 text-gray-400">Inspection not found</p>;

  const allPaid = Boolean(request.payments?.some(p => p.stage === 'balance' && p.status === 'approved'));
  const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://sokonimax.com'}/verify/${request.inspection_id}`;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="card p-4 sm:p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/inspections')}
                className="inline-flex items-center gap-1 text-2xs font-bold text-gray-500 hover:text-brand-500 transition-colors uppercase tracking-wider mr-1"
              >
                <ArrowLeft size={12} /> Back
              </button>
              <Badge
                text={STATUS_LABELS[request.status] || request.status}
                className={STATUS_COLORS[request.status] || 'badge-gray'}
              />
              {request.report?.is_locked && (request.report.verdict as string) !== 'LOCKED' && allPaid && (
                <Badge
                  text={`VERDICT: ${request.report.verdict.toUpperCase()}`}
                  className={VERDICT_COLORS[request.report.verdict]}
                />
              )}
              <span className="text-2xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-bold">
                {request.inspection_id}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-lg sm:text-xl font-black uppercase text-gray-900 dark:text-white truncate">
              {request.item_name}
            </h1>

            {/* Subtle Marketplace Item Link in Title Area */}
            {request.product_snapshot && (
              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Marketplace Item:</span>
                <Link
                  to={`/product/${request.product_snapshot.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline bg-brand-50/80 dark:bg-brand-900/20 px-2 py-0.5 rounded-md border border-brand-200/50 dark:border-brand-800/50"
                >
                  {request.product_snapshot.image_url && (
                    <img
                      src={request.product_snapshot.image_url.startsWith('http') ? request.product_snapshot.image_url : `${API_BASE_URL}${request.product_snapshot.image_url}`}
                      alt=""
                      className="w-4 h-4 rounded object-cover"
                    />
                  )}
                  <span>{request.product_snapshot.name}</span>
                  <span className="text-gray-500 font-normal">({fmtMoney(request.product_snapshot.price)})</span>
                  <ChevronRight size={12} className="text-brand-500" />
                </Link>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {request.category_path || request.category_name}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0">
            <div className="flex items-center gap-2">
              <span>Scope: <strong className="text-gray-700 dark:text-gray-200 capitalize">{request.scope}</strong></span>
              <span>•</span>
              <span>Speed: <strong className="text-gray-700 dark:text-gray-200 capitalize">{request.turnaround}</strong></span>
            </div>
            <p className="text-[10px] text-gray-400">Requested {fmtDate(request.created_at)}</p>
          </div>
        </div>
      </div>

      {/* 2-Column Balanced Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Sidebar Column */}
        <div className="lg:col-span-1 space-y-5">
          {/* Progress Timeline */}
          <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock size={15} className="text-brand-500" />
              Inspection Progress
            </h3>
            <Timeline status={request.status} />

            {request.assignment && (
              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
                <p className="text-2xs font-bold uppercase tracking-wider text-gray-400">Assigned Inspector</p>
                <p className="text-sm font-black text-gray-900 dark:text-white">
                  {request.assignment.inspector_name}
                </p>
                <Badge text={request.assignment.inspector_level} className="badge-blue capitalize" />
                {request.assignment.sla_deadline && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <Clock size={12} />
                    <span>Expected by {fmtDate(request.assignment.sla_deadline)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Item & Location Specs */}
          <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 space-y-2.5">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin size={15} className="text-brand-500" />
              Location & Specs
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-400 block text-2xs font-bold uppercase">Item Location</span>
                <span className="text-gray-700 dark:text-gray-300 font-medium">{request.item_address}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-2xs font-bold uppercase">Description</span>
                <p className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{request.item_description}</p>
              </div>
              {request.item_age_years && (
                <div>
                  <span className="text-gray-400 block text-2xs font-bold uppercase">Item Age</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{request.item_age_years} years</span>
                </div>
              )}
            </div>
          </div>

          {/* QR Code & Authenticity Verification Card (Takes user directly to this inspection) */}
          <div className="card p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
              <Shield size={16} className="text-emerald-500" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Verified Certificate
                </h4>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓ Authenticity Guaranteed
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="p-1.5 bg-white rounded-lg border border-gray-200 shrink-0">
                <QRCodeSVG value={verifyUrl} size={64} level="M" />
              </div>
              <div className="text-2xs text-gray-500 dark:text-gray-400 space-y-1">
                <p className="font-bold text-gray-900 dark:text-white">Scan with Phone</p>
                <p className="leading-tight">Scan this QR code to view and verify this official inspection record online.</p>
                <a href={verifyUrl} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline font-bold inline-flex items-center gap-1 pt-0.5">
                  Verify Record <ExternalLink size={10} />
                </a>
              </div>
            </div>

            {request.checkin?.checkin_at && (
              <div className="text-2xs text-gray-500 dark:text-gray-400 space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>On-Site Check-In:</span>
                  <span className="font-bold text-gray-700 dark:text-gray-300">{fmtDate(request.checkin.checkin_at)}</span>
                </div>
                {request.checkin?.checkin_lat && request.checkin?.checkin_lng && (
                  <div className="flex justify-between">
                    <span>GPS Coordinates:</span>
                    <span className="font-mono text-gray-600 dark:text-gray-300">
                      {parseFloat(request.checkin.checkin_lat.toString()).toFixed(4)}, {parseFloat(request.checkin.checkin_lng.toString()).toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Bill & Report View) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Awaiting Bill / Staff Review */}
          {request.status === 'requested' && !request.bill && (
            <div className="card p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Clock size={15} className="text-amber-500 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Request Under Staff Review</p>
                  <p className="text-2xs text-gray-500">Staff will evaluate requirements and location to issue your official bill.</p>
                </div>
              </div>
              <span className="text-2xs text-amber-500 dark:text-amber-400 font-medium">Pending Bill</span>
            </div>
          )}

          {/* Bill & Payment */}
          {request.bill && <BillDisplay request={request} onPaid={load} />}

          {/* Report View */}
          {request.report?.is_locked && (
            allPaid ? (
              <ReportView request={request} onReInspect={() => setShowReInspect(true)} />
            ) : (
              <div className="card p-5 border border-amber-500/30 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
                  <Lock size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Official Inspection Report Ready</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                    The inspector has completed the checklist and QA has approved the assessment.
                    Pay the remaining 70% balance above ({fmtMoney(request.bill?.remaining_balance, request.bill?.currency)}) to unlock full findings, defect breakdown, high-res photos, and printable certificate.
                  </p>
                </div>
              </div>
            )
          )}

          {/* Re-inspection modal */}
          {showReInspect && (
            <div className="card p-5 border-2 border-brand-500 dark:border-brand-500 bg-white dark:bg-gray-800">
              <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Request Re-Inspection</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                A different inspector will be assigned. Only use if inspection conditions were compromised.
              </p>
              <textarea
                className="input mb-3 text-xs"
                rows={3}
                placeholder="Reason for re-inspection..."
                value={reInspectReason}
                onChange={(e) => setReInspectReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={handleReInspect} className="btn-primary px-4 py-2 text-xs font-bold">
                  Confirm Request
                </button>
                <button onClick={() => setShowReInspect(false)} className="btn-secondary px-4 py-2 text-xs font-bold">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── My Inspections List ────────────────────
const MyInspections: React.FC = () => {
  const [requests, setRequests] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyId, setVerifyId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
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

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: requests.length,
      report_ready: requests.filter(r => r.has_report || r.status === 'published').length,
      in_progress: requests.filter(r => ['assigned', 'in_progress', 'qa_review', 'pre_inspection'].includes(r.status)).length,
      awaiting_payment: requests.filter(r => ['bill_sent', 'awaiting_payment'].includes(r.status)).length,
    };
    requests.forEach(r => {
      if (r.status && !['published', 'assigned', 'in_progress', 'qa_review', 'pre_inspection', 'bill_sent', 'awaiting_payment'].includes(r.status)) {
        counts[r.status] = (counts[r.status] || 0) + 1;
      }
    });
    return counts;
  }, [requests]);

  const filteredRequests = React.useMemo(() => {
    if (!filterStatus) return requests;
    if (filterStatus === 'report_ready') {
      return requests.filter(r => r.has_report || r.status === 'published');
    }
    if (filterStatus === 'in_progress') {
      return requests.filter(r => ['assigned', 'in_progress', 'qa_review', 'pre_inspection'].includes(r.status));
    }
    if (filterStatus === 'awaiting_payment') {
      return requests.filter(r => ['bill_sent', 'awaiting_payment'].includes(r.status));
    }
    return requests.filter(r => r.status === filterStatus);
  }, [requests, filterStatus]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Inspections"
        subtitle="Track, verify, and manage your item inspections"
        actions={
          <Link
            to="/inspections/new"
            className="btn-primary text-xs sm:text-sm px-3.5 py-2 flex items-center gap-1.5 font-bold shadow-xs"
          >
            <Plus size={16} />
            <span>New Request</span>
          </Link>
        }
      />

      {/* Verify Public Portal Card */}
      <div className="card p-4 sm:p-5 border border-brand-500/20 bg-brand-500/5 dark:bg-brand-500/5">
        <div className="flex items-center gap-2 mb-1.5">
          <Shield size={16} className="text-brand-500" />
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">Verify an Inspection</h3>
        </div>
        <p className="text-2xs sm:text-xs text-gray-500 dark:text-gray-400 mb-3">
          Paste a public inspection ID (e.g. OKO-VEH-20260428-00001) to verify its authenticity and view the report summary.
        </p>
        <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            className="input flex-1 uppercase font-mono text-xs h-9 bg-white dark:bg-[#111]"
            placeholder="ENTER INSPECTION ID..."
            value={verifyId}
            onChange={(e) => setVerifyId(e.target.value.toUpperCase())}
          />
          <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0">
            <Search size={14} /> Verify
          </button>
        </form>
      </div>

      {/* Status Filter Pills */}
      {loading ? (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[16, 24, 22, 28].map((w, i) => (
            <div
              key={i}
              className="h-7 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0"
              style={{ width: `${w * 4}px` }}
            />
          ))}
        </div>
      ) : requests.length > 0 ? (
        <div data-horizontal-scroll="true" className="flex overflow-x-auto no-scrollbar gap-2 select-none pb-1">
          <button
            onClick={() => setFilterStatus('')}
            className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${!filterStatus ? 'pill-active shadow-xs' : 'pill-inactive'}`}
          >
            <span>All</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              !filterStatus ? 'bg-white/20 text-inherit' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {requests.length}
            </span>
          </button>

          {statusCounts.report_ready > 0 && (
            <button
              onClick={() => setFilterStatus('report_ready')}
              className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${
                filterStatus === 'report_ready'
                  ? 'pill-active border-green-500 text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-300 shadow-xs'
                  : 'pill-inactive'
              }`}
            >
              <CheckCircle size={14} className="inline mr-0.5" />
              <span>Report Ready</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                filterStatus === 'report_ready' ? 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {statusCounts.report_ready}
              </span>
            </button>
          )}

          {statusCounts.in_progress > 0 && (
            <button
              onClick={() => setFilterStatus('in_progress')}
              className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${
                filterStatus === 'in_progress'
                  ? 'pill-active border-purple-500 text-purple-700 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-300 shadow-xs'
                  : 'pill-inactive'
              }`}
            >
              <Clock size={14} className="inline mr-0.5" />
              <span>In Progress</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                filterStatus === 'in_progress' ? 'bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {statusCounts.in_progress}
              </span>
            </button>
          )}

          {statusCounts.awaiting_payment > 0 && (
            <button
              onClick={() => setFilterStatus('awaiting_payment')}
              className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${
                filterStatus === 'awaiting_payment'
                  ? 'pill-active border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 shadow-xs'
                  : 'pill-inactive'
              }`}
            >
              <FileText size={14} className="inline mr-0.5" />
              <span>Awaiting Payment</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                filterStatus === 'awaiting_payment' ? 'bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {statusCounts.awaiting_payment}
              </span>
            </button>
          )}
        </div>
      ) : null}

      {/* List / Loading / Empty */}
      {loading ? (
        <div className="space-y-3.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#181818] rounded-xl border border-gray-100 dark:border-neutral-800 p-4 sm:p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gray-200 dark:bg-neutral-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 dark:bg-neutral-800 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 dark:bg-neutral-800/60 rounded w-1/3" />
                </div>
                <div className="h-6 bg-gray-200 dark:bg-neutral-800 rounded-full w-20 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={requests.length === 0 ? "You haven't requested any inspections yet." : "No inspections with this status."}
          action={{
            label: requests.length === 0 ? "Request Inspection" : "View All Inspections",
            onClick: () => {
              if (requests.length === 0) {
                navigate('/inspections/new');
              } else {
                setFilterStatus('');
              }
            },
          }}
        />
      ) : (
        <div className="space-y-3.5">
          {filteredRequests.map((req: any) => {
            const imageUrl = req.product_snapshot?.image_url
              ? (req.product_snapshot.image_url.startsWith('http') ? req.product_snapshot.image_url : `${API_BASE_URL}${req.product_snapshot.image_url}`)
              : null;

            return (
              <div
                id={`inspection-${req.id}`}
                key={req.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/inspections/${req.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/inspections/${req.id}`);
                  }
                }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in hover:shadow-md transition-all cursor-pointer p-4 sm:p-5 group focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10"
              >
                <div className="flex items-start justify-between gap-3 w-full">
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 mt-0.5">
                      <div className="w-full h-full rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden flex items-center justify-center">
                        {imageUrl ? (
                          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ClipboardList size={22} className="text-gray-400" />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded">
                          {req.inspection_id || `REQ #${req.id}`}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 rounded">
                          {req.scope} scope
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                          {fmtDate(req.created_at)}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-gray-900 dark:text-white truncate uppercase group-hover:text-brand-500 transition-colors">
                        {req.item_name}
                      </h4>

                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 truncate">
                        <span>Category:</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300 truncate">
                          {req.category_path || req.category_name || 'General'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status & Chevron */}
                  <div className="flex flex-col items-end shrink-0 gap-1.5 pl-2">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        text={STATUS_LABELS[req.status] || req.status}
                        className={STATUS_COLORS[req.status] || 'badge-gray'}
                      />
                      <ChevronRight size={16} className="text-gray-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    {req.has_report && (
                      <span className="text-[10px] font-black text-green-500 dark:text-green-400 uppercase tracking-wider bg-green-50 dark:bg-green-950/20 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800">
                        Report ready
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

  if (loading) return <CardListSkeleton count={4} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on all your inspection activities"
        actions={
          notifications.length > 0 ? (
            <button onClick={markAllRead} className="btn-ghost text-xs px-3 py-1.5">Mark all read</button>
          ) : undefined
        }
      />
      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You are all caught up! New updates will appear here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`card p-4 ${!n.is_read ? 'border-brand-500 dark:border-brand-500' : ''}`}>
              <div className="flex items-start gap-3">
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{n.message}</p>
                  {n.request_id && (
                    <Link to={`/inspections/${n.related_request}`}
                      className="text-xs text-brand-500 dark:text-brand-500 hover:underline mt-0.5 inline-block font-semibold">
                      View inspection {n.request_id}
                    </Link>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{fmtDate(n.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Layout ─────────────────────────────────
const InspectionLayout: React.FC = () => {
  return (
    <div className="container-page max-w-4xl py-6">
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
