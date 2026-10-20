import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ClipboardList, ChevronRight, Upload, CheckCircle, AlertTriangle,
  Clock, FileText, Bell, Search, RefreshCw,
  Camera, Printer, ChevronDown, ChevronUp, Check, X, ShieldAlert, BadgeCheck, Plus, ArrowLeft, ExternalLink, Lock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          {t('category_title', 'Category')} <span className="text-red-500">*</span>
        </label>
        <select
          value={level1Id}
          onChange={(e) => handleLevel1Change(e.target.value ? Number(e.target.value) : '')}
          className="input w-full cursor-pointer text-xs"
          required
        >
          <option value="">{t('select_category_dropdown', 'Select Category...')}</option>
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
            {t('subcategory_title', 'Subcategory')} <span className="text-red-500">*</span>
          </label>
          <select
            value={level2Id}
            onChange={(e) => handleLevel2Change(e.target.value ? Number(e.target.value) : '')}
            className="input w-full cursor-pointer text-xs"
            required
          >
            <option value="">{t('select_subcategory_dropdown', 'Select Subcategory...')}</option>
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
            {t('specific_type_title', 'Specific Type')} <span className="text-red-500">*</span>
          </label>
          <select
            value={level3Id}
            onChange={(e) => handleLevel3Change(e.target.value ? Number(e.target.value) : '')}
            className="input w-full cursor-pointer text-xs"
            required
          >
            <option value="">{t('select_type_dropdown', 'Select Type...')}</option>
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
            {t('selected_label', 'Selected:')} <strong className="text-gray-900 dark:text-white">{selected.full_path || selected.name}</strong>
          </span>
          {selected.base_price && (
            <span className="text-brand-500 font-bold">{t('base_label', 'Base:')} {fmtMoney(selected.base_price)}</span>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Request Form ───────────────────────────
const RequestForm: React.FC = () => {
  const { t } = useTranslation();
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
      toast.error(t('select_inspection_category_error', 'Please select an inspection category'));
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
      toast.success(t('inspection_request_submitted', 'Inspection request submitted!'));
      navigate(`/inspections/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('failed_submit_inspection', 'Failed to submit request'));
    } finally {
      setLoading(false);
    }
  };

  const scopeOptions = [
    {
      value: 'basic',
      title: t('scope_basic_title', 'Basic Check'),
      desc: t('scope_basic_desc', 'Exterior condition & core functionality check'),
      badge: '-20%',
    },
    {
      value: 'standard',
      title: t('scope_standard_title', 'Standard Audit'),
      desc: t('scope_standard_desc', 'Multi-point checklist & diagnostic inspection'),
      badge: t('recommended', 'Recommended'),
    },
    {
      value: 'deep',
      title: t('scope_deep_title', 'Specialist Diagnostic'),
      desc: t('scope_deep_desc', 'In-depth technical & component-level testing'),
      badge: '+40%',
    },
  ];

  const turnaroundOptions = [
    { value: 'standard', title: t('turnaround_standard', 'Standard'), time: t('turnaround_standard_time', '24–48 hours'), surcharge: t('included_label', 'Included') },
    { value: 'express', title: t('turnaround_express', 'Express'), time: t('turnaround_express_time', 'Same day'), surcharge: '+30%' },
    { value: 'instant', title: t('turnaround_urgent', 'Urgent'), time: t('turnaround_urgent_time', 'Within hours'), surcharge: '+60%' },
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
          <ArrowLeft size={14} /> {t('back_to_inspections', 'Back to Inspections')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {t('schedule_physical_inspection', 'Schedule Physical Inspection')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('schedule_inspection_subtitle', 'Have an independent specialist inspect, test, and verify this item on-site.')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Item Information & Notes (7 Columns) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Item Details */}
          <div className="card p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('section_item_info', '1. Item Information')}
              </h2>
              {!prefilledProduct && (
                <span className="text-2xs text-brand-600 dark:text-brand-400 font-medium">
                  {isAddressFilled
                    ? t('step_1_complete', 'Step 1 Complete')
                    : isCategorySelected
                    ? t('filling_details', 'Filling details...')
                    : t('select_category_to_start', 'Select category to start')}
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
                      {t('marketplace_item', 'Marketplace Item')}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 break-words leading-snug">
                      {prefilledProduct.name}
                    </h3>
                    {prefilledProduct.price !== undefined && prefilledProduct.price !== null && (
                      <p className="text-xs text-brand-500 font-bold mt-0.5">
                        {fmtMoney(prefilledProduct.price)}
                      </p>
                    )}
                    <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('seller_prefix', 'Seller:')} <strong className="text-gray-700 dark:text-gray-200">@{prefilledProduct.seller_username || 'seller'}</strong> • {t('category_prefix', 'Category:')} <strong className="text-gray-700 dark:text-gray-200">{selectedCategory?.full_path || selectedCategory?.name || 'General'}</strong>
                    </p>
                  </div>
                </div>
                <Link
                  to={`/products/${prefilledProduct.id}`}
                  target="_blank"
                  className="btn-secondary text-2xs py-1 px-2.5 rounded-lg shrink-0 font-bold flex items-center gap-1"
                >
                  {t('view_listing', 'View Listing ↗')}
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
                      {t('item_name_label', 'Item Name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="input text-xs"
                      required
                      placeholder={t('placeholder_item_name', 'e.g. Toyota Crown 2018, iPhone 15 Pro, Solar Inverter')}
                      value={form.item_name}
                      onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Description & Known Condition */}
              <div className={prefilledProduct || isNameFilled ? 'block animate-fade-in' : 'hidden sm:block'}>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t('item_description_verify_label', 'Description & Specific Areas to Verify')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input text-xs"
                  rows={3}
                  required
                  placeholder={t('placeholder_item_desc', 'Describe item condition, key specifications, and any specific areas to examine...')}
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
                    {t('inspection_address_label', 'Physical Inspection / Seller Address')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="input text-xs"
                    required
                    placeholder={t('placeholder_item_address', 'Street address or location where the item is available for inspection')}
                    value={form.item_address}
                    onChange={(e) => setForm({ ...form, item_address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t('item_age_years_label', 'Item Age (years)')}
                  </label>
                  <input
                    className="input text-xs"
                    type="number"
                    min="0"
                    placeholder={t('optional', 'Optional')}
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
                    {t('complex_item_option', 'Complex / Industrial Item (+20%)')}
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
              {t('section_additional_options', '2. Additional Options & Notes')}
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
                <span className="font-bold">{t('reinspection_coverage_option', 'Re-inspection Coverage (+10%)')}</span>
                <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('reinspection_coverage_desc', 'Provides a discounted follow-up inspection if repairs or seller condition fixes are made.')}
                </p>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {t('special_instructions_optional', 'Special Instructions for Inspector (Optional)')}
              </label>
              <textarea
                className="input text-xs"
                rows={2}
                placeholder={t('placeholder_special_instructions', 'Mention any specific parts, functions, or defects you want the inspector to examine closely...')}
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
              {t('inspection_scope', 'Inspection Scope')}
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
              {t('turnaround_speed', 'Turnaround Speed')}
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('official_quote_assessment', 'Official Quote Assessment')}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t('quote_assessment_desc', 'No payment is required right now. Staff will review the address, item complexity, and urgency to issue your official bill.')}
            </p>

            {hasCategory && basePrice && (
              <div className="flex justify-between items-center text-xs py-2 border-t border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">{t('indicative_baseline', 'Indicative Baseline:')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">~{fmtMoney(basePrice)}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !hasCategory}
              className="btn-primary w-full py-2.5 text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              {loading
                ? t('submitting_ellipsis', 'Submitting...')
                : !hasCategory
                ? t('select_category_first', 'Select Category First')
                : t('submit_request_official_bill', 'Submit Request for Official Bill')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

// ─── Payment Upload ─────────────────────────
const PaymentUpload: React.FC<{ request: InspectionRequest; onPaid: () => void }> = ({ request, onPaid }) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [lipaNumbers, setLipaNumbers] = useState<any[]>([]);
  const bill = request.bill;

  useEffect(() => {
    api.get('/api/lipa-numbers/?is_system=true')
       .then(r => {
         const nums = r.data.results || r.data || [];
         if (nums.length > 0) setLipaNumbers(nums);
         else {
           api.get('/api/lipa-numbers/?seller=admin')
              .then(r2 => setLipaNumbers(r2.data.results || r2.data || []))
              .catch(() => {});
         }
       })
       .catch(() => {
         api.get('/api/lipa-numbers/?seller=admin')
            .then(r2 => setLipaNumbers(r2.data.results || r2.data || []))
            .catch(() => {});
       });
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
            {isDeposit ? t('deposit_30_percent', '30% Deposit') : t('balance_70_percent', '70% Balance')} ({fmtMoney(pendingPayment.amount, bill?.currency)}) • Ref: <strong className="font-mono text-gray-900 dark:text-white">{pendingPayment.transaction_reference}</strong>
          </span>
        </div>
        <span className="text-2xs text-amber-500 dark:text-amber-400 shrink-0 ml-2 font-medium">{t('awaiting_confirmation', 'Awaiting confirmation')}</span>
      </div>
    );
  }

  if (allPaid) {
    return (
      <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
        <span>{t('paid_in_full_unlocked', 'Paid in full • Report and certificate unlocked')}</span>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !ref) { toast.error(t('provide_ref_and_receipt', 'Please provide both transaction reference and receipt screenshot')); return; }
    if (!amount) { toast.error(t('bill_amount_not_avail', 'Bill amount not available')); return; }
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
          ? t('deposit_submitted_success', '30% Deposit submitted! Waiting for accountant approval.')
          : t('balance_submitted_success', 'Final balance submitted! Waiting for accountant approval.')
      );
      onPaid();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('failed_submit_proof', 'Failed to submit payment proof'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">
            {stage === 'deposit' ? t('deposit_booking_label', '30% Booking Deposit') : t('final_balance_label', '70% Final Balance')}
          </p>
          <p className="text-2xs text-gray-400">
            {stage === 'deposit' ? t('required_dispatch_inspector', 'Required to dispatch inspector') : t('required_unlock_report', 'Required to unlock full report')}
          </p>
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          {bill?.currency || 'TZS'} {Number(amount).toLocaleString()}
        </span>
      </div>

      {lipaNumbers.length > 0 && (
        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 space-y-2.5">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{t('pay_via_mobile_money', 'Pay via Mobile Money (Lipa Namba):')}</p>
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
        placeholder={t('placeholder_mobile_ref', 'Mobile money transaction reference / SMS code')}
        value={ref} 
        onChange={(e) => setRef(e.target.value)} 
      />
      <label className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-brand-500 transition">
        <Upload size={20} className="text-gray-400" />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {file ? file.name : t('upload_receipt_screenshot', 'Upload payment receipt screenshot')}
        </span>
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      <button type="submit" disabled={loading} className="w-full btn-primary py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl">
        {loading 
          ? t('submitting_payment_proof', 'Submitting Payment Proof...') 
          : stage === 'deposit' 
          ? t('submit_deposit_proof', 'Submit 30% Deposit Proof to Dispatch Inspector') 
          : t('submit_balance_proof', 'Submit 70% Balance Proof to Unlock Report')}
      </button>
    </form>
  );
};

// ─── Bill Display ───────────────────────────
const BillDisplay: React.FC<{ request: InspectionRequest; onPaid: () => void }> = ({ request, onPaid }) => {
  const { t } = useTranslation();
  const [acking, setAcking] = useState(false);
  const bill = request.bill;
  if (!bill) return null;

  const lines = [
    { label: t('bill_base_rate', 'Base Rate'), amount: bill.base_rate },
    { label: t('bill_turnaround_surcharge', 'Turnaround Surcharge'), amount: bill.turnaround_surcharge },
    { label: t('bill_inspector_level', 'Inspector Level'), amount: bill.inspector_level_surcharge },
    { label: t('bill_complexity_age', 'Complexity / Age'), amount: bill.complexity_surcharge },
    { label: t('bill_travel', 'Travel'), amount: bill.travel_surcharge },
    { label: t('bill_reinspection_coverage', 'Re-inspection Coverage'), amount: bill.reinspection_coverage_fee },
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
       toast.success(t('bill_accepted_success', 'Bill accepted. You can now proceed to payment.'));
       onPaid(); // Reload request
     } catch {
       toast.error(t('failed_acknowledge_bill', 'Failed to acknowledge bill'));
     } finally {
       setAcking(false);
     }
  };

  const isReportReady = Boolean(request.report) || request.status === 'published' || request.status === 'qa_review';
  const showPaymentForm = (!depositApproved && request.status === 'awaiting_payment') || (depositApproved && !allPaid && isReportReady);

  return (
    <div className="space-y-4">
      <div className="card border-0 p-4 bg-white dark:bg-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
          {t('inspection_bill', 'Inspection Bill')}
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
              <span className="text-gray-900 dark:text-white">{t('total', 'Total')}</span>
              <span className="text-gray-900 dark:text-white">{fmtMoney(bill.total_amount, bill.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {t('deposit_percentage', 'Deposit (30%)')} {depositApproved ? t('paid_indicator', '• Paid') : ''}
              </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {fmtMoney(bill.deposit_amount, bill.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {t('remaining_balance', 'Remaining Balance')} {allPaid ? t('paid_indicator', '• Paid') : ''}
              </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">
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
              {t('accept_bill_proceed', 'Accept Bill & Proceed to Payment')}
            </button>
            <p className="text-[10px] text-gray-500 text-center mt-2">
              {t('accept_bill_terms', 'By clicking accept, you agree to the inspection terms and pricing.')}
            </p>
          </div>
        )}
      </div>

      {showPaymentForm && !allPaid && <PaymentUpload request={request} onPaid={onPaid} />}
      
      {depositApproved && !allPaid && !isReportReady && (
        <div className="py-2 px-3 rounded-lg bg-white dark:bg-gray-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-green-500 font-medium">
            <CheckCircle size={14} /> {t('deposit_confirmed_label', '30% Deposit confirmed')}
          </span>
          <span className="text-2xs text-gray-400">{t('balance_requested_later_desc', '70% Balance will be requested once report is ready')}</span>
        </div>
      )}
      {depositApproved && !allPaid && isReportReady && (
        <div className="py-2 px-3 rounded-lg bg-white dark:bg-gray-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-amber-500 font-medium">
            <Clock size={14} /> {t('pay_balance_to_unlock', 'Report Ready — Pay 70% Balance to Unlock')}
          </span>
          <span className="text-2xs text-gray-400 font-medium">{fmtMoney(bill.remaining_balance, bill.currency)}</span>
        </div>
      )}
      {allPaid && (
        <div className="py-2 px-3 rounded-lg bg-white dark:bg-gray-800 text-xs text-green-500 flex items-center gap-2 font-medium">
          <CheckCircle size={14} /> {t('fully_paid', 'Fully paid')}
        </div>
      )}
    </div>
  );
};

// ─── Inspection Timeline ────────────────────
const Timeline: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  // Handle terminal/special statuses outside main flow
  if (status === 'cancelled') {
    return (
      <div className="p-4 rounded-xl flex items-center gap-3">
        <X size={18} className="text-red-500 shrink-0" />
        <div>
          <p className="font-semibold text-red-500 dark:text-red-500">{t('inspection_cancelled', 'Inspection Cancelled')}</p>
          <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">{t('inspection_cancelled_desc', 'This inspection request has been cancelled. Contact support if you need help.')}</p>
        </div>
      </div>
    );
  }
  if (status === 'blocked') {
    return (
      <div className="p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle size={18} className="text-orange-500 shrink-0" />
        <div>
          <p className="font-semibold text-orange-500 dark:text-orange-500">{t('on_hold', 'On Hold')}</p>
          <p className="text-xs text-orange-500 dark:text-orange-500 mt-0.5">{t('inspection_on_hold_desc', 'Your inspection is temporarily on hold. Our team will be in touch shortly.')}</p>
        </div>
      </div>
    );
  }
  if (status === 'rescheduled') {
    return (
      <div className="p-4 rounded-xl flex items-center gap-3">
        <RefreshCw size={18} className="text-blue-500 shrink-0" />
        <div>
          <p className="font-semibold text-blue-500 dark:text-blue-500">{t('rescheduled', 'Rescheduled')}</p>
          <p className="text-xs text-blue-500 dark:text-blue-500 mt-0.5">{t('inspection_rescheduled_desc', 'Your inspection has been rescheduled. A new time will be confirmed shortly.')}</p>
        </div>
      </div>
    );
  }

  const steps = [
    { key: 'requested', label: t('requested_status', 'Requested') },
    { key: 'bill_sent', label: t('bill_ready_status', 'Bill Ready') },
    { key: 'awaiting_payment', label: t('awaiting_payment_status', 'Awaiting Payment') },
    { key: 'deposit_paid', label: t('deposit_paid_status', 'Deposit Paid') },
    { key: 'pre_inspection', label: t('pre_inspection_status', 'Pre-Inspection') },
    { key: 'assigned', label: t('assigned_inspector', 'Inspector Assigned') },
    { key: 'in_progress', label: t('inspecting', 'Inspection Running') },
    { key: 'submitted', label: t('report_submitted_status', 'Report Submitted') },
    { key: 'qa_review', label: t('under_qa', 'QA Review') },
    { key: 'published', label: t('report_ready_status', 'Report Ready') },
  ];
  const idx = steps.findIndex((s) => s.key === status);
  // If status not in steps (e.g. unknown future status), show all complete
  const currentIdx = idx >= 0 ? idx : steps.length - 1;

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-4">
        {steps.map((step, i) => {
          const completed = i < currentIdx;
          const active = i === currentIdx;
          const isFinalStep = i === steps.length - 1;
          return (
            <div key={step.key} className="flex items-center gap-4 relative">
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                active
                  ? isFinalStep
                    ? 'bg-green-500'
                    : 'bg-brand-500'
                  : completed
                  ? 'bg-gray-200 dark:bg-gray-700'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                {active ? (
                  <CheckCircle size={14} className="text-white" />
                ) : completed ? (
                  <CheckCircle size={14} className="text-gray-400 dark:text-gray-500" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                )}
              </div>
              <span className={`text-sm transition ${
                active
                  ? isFinalStep
                    ? 'font-semibold text-green-500 dark:text-green-400'
                    : 'font-semibold text-brand-500 dark:text-brand-400'
                  : completed
                  ? 'text-gray-400 dark:text-gray-500'
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
    <div className="card border-0 p-5 bg-white dark:bg-gray-800">
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
        <div className="card border-0 p-5 bg-white dark:bg-gray-800 space-y-3">
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
        <div className="card border-0 p-5 bg-white dark:bg-gray-800 space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded w-full" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded w-5/6" />
        </div>
      </div>

      {/* Right Column Skeletons */}
      <div className="lg:col-span-2 space-y-5">
        <div className="card border-0 p-6 bg-white dark:bg-gray-800 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              <div className="h-4 bg-gray-100 dark:bg-gray-700/60 rounded w-3/4" />
            </div>
          </div>
        </div>
        <div className="card border-0 p-5 bg-white dark:bg-gray-800 space-y-3">
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
  const { t } = useTranslation();
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
      <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 bg-transparent ${
            verdict === 'pass'
              ? 'text-emerald-700 dark:text-emerald-400'
              : verdict === 'conditional'
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-red-700 dark:text-red-400'
          }`}>
            {verdict === 'pass' ? <BadgeCheck size={14} className="text-emerald-600 dark:text-emerald-400" /> : verdict === 'conditional' ? <AlertTriangle size={14} className="text-amber-500" /> : <ShieldAlert size={14} className="text-red-500" />}
            <span>{t(`verdict_${verdict}`, verdict.toUpperCase())} • {t('grade', 'Grade')} {report.grade || 'A'} ({score}%)</span>
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
            <Printer size={13} /> {t('print_official_report', 'Print Official Report')}
          </button>
          <button
            onClick={onReInspect}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw size={12} /> {t('reinspect', 'Re-inspect')}
          </button>
        </div>
      </div>

      {/* Defect Summary Strip */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl shadow-xs">
          <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400">{t('critical_issues', 'Critical Issues')}</p>
          <p className={`text-base font-black mt-0.5 ${criticalDefects > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
            {criticalDefects}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl shadow-xs">
          <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400">{t('major_issues', 'Major Issues')}</p>
          <p className={`text-base font-black mt-0.5 ${majorDefects > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'}`}>
            {majorDefects}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl shadow-xs">
          <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400">{t('advisory_items', 'Advisory Items')}</p>
          <p className={`text-base font-black mt-0.5 ${advisoryDefects > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-200'}`}>
            {advisoryDefects}
          </p>
        </div>
      </div>

      {/* Checklist Breakdown & Findings - Top Priority Focus */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
            {t('checklist_breakdown_findings', 'Checklist Breakdown & Findings')}
          </h3>
          <span className="text-2xs text-gray-400 font-semibold">
            {report.responses.length} checkpoints inspected
          </span>
        </div>

        {Object.entries(responsesBySection).map(([section, items]) => {
          const isOpen = openSections[section] ?? true;
          const flaggedCount = items.filter(i => i.flagged).length;
          return (
            <div key={section} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-xs">
              <button
                onClick={() => toggleSection(section)}
                className="w-full flex items-center justify-between p-3 bg-gray-50/70 dark:bg-gray-700/30 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-gray-800 dark:text-gray-200 capitalize">
                    {section}
                  </span>
                  <span className="text-2xs text-gray-400">
                    ({items.length})
                  </span>
                  {flaggedCount > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold text-red-600 dark:text-red-400 bg-transparent">
                      {flaggedCount} issues
                    </span>
                  )}
                </div>
                {isOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>

              {isOpen && (
                <div className="p-1 space-y-0.5">
                  {items.map((r) => {
                    const itemEvidences = request.evidence.filter(ev => ev.checklist_item === r.checklist_item);
                    return (
                      <div key={r.id} className="p-2.5 rounded-lg transition-colors hover:bg-gray-50/40 dark:hover:bg-gray-700/20">
                        <div className="flex items-center justify-between gap-3 min-w-0">
                          <span className={`font-semibold text-xs flex-1 min-w-0 ${r.flagged ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {r.item_label}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-right w-16 text-gray-400 dark:text-gray-500">
                              {r.severity}
                            </span>
                            <div className="min-w-[50px] flex justify-end">
                              {r.flagged ? (
                                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-2xs font-black uppercase">
                                  <X size={10} strokeWidth={3} /> {r.response_value || 'FAIL'}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-gray-700 dark:text-gray-200 text-2xs font-bold uppercase">
                                  <Check size={10} strokeWidth={3} className="text-emerald-500" /> {r.response_value || 'PASS'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {r.notes && (
                          <p className="text-2xs text-gray-500 dark:text-gray-400 mt-1 pl-0.5 leading-relaxed">
                            {r.notes}
                          </p>
                        )}

                        {/* Inline Evidence Thumbnails - Compact without nested boundary boxes */}
                        {itemEvidences.length > 0 && (
                          <div className="mt-2 flex gap-2 overflow-x-auto py-0.5">
                            {itemEvidences.map(ev => (
                              <div
                                key={ev.id}
                                onClick={() => setSelectedImage(getImageUrl(ev.image))}
                                className="relative w-12 h-12 rounded-md overflow-hidden cursor-zoom-in group shrink-0 bg-gray-100 dark:bg-gray-800"
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

      {/* Photo Documentation - Clean Thumbnails Without Inner Boundaries */}
      {request.evidence && request.evidence.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white mb-3">
            {t('photo_documentation_count', 'Photo Documentation ({{count}} photos)', { count: request.evidence.length })}
          </h3>
          <div className="flex flex-wrap gap-3">
            {request.evidence.map((ev) => (
              <div
                key={ev.id}
                className="group relative cursor-zoom-in w-20 transition-transform hover:scale-105"
                onClick={() => setSelectedImage(getImageUrl(ev.image))}
              >
                <div className="w-20 h-16 overflow-hidden bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <img
                    src={getImageUrl(ev.image)}
                    alt={ev.caption || 'Evidence'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate text-center mt-1">
                  {ev.item_label || 'Evidence'}
                </p>
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
  const { t } = useTranslation();
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
      .catch(() => toast.error(t('failed_load_inspection', 'Failed to load inspection')))
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
                toast.success(notif.message || notif.title || t('inspection_status_updated', 'Inspection status updated!'));
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
      toast.success(t('reinspection_requested', 'Re-inspection requested'));
      setShowReInspect(false);
      load();
    } catch { toast.error(t('failed_reinspection', 'Failed to request re-inspection')); }
  };

  if (loading) return <RequestDetailSkeleton />;
  if (!request) return <p className="text-center py-12 text-gray-400">{t('inspection_not_found', 'Inspection not found')}</p>;

  const allPaid = Boolean(request.payments?.some(p => p.stage === 'balance' && p.status === 'approved'));
  const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://sokonimax.com'}/verify/${request.inspection_id}`;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="card border-0 p-4 sm:p-5 bg-white dark:bg-gray-800 space-y-3">
        {/* Top bar: Back & Status + Meta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/inspections')}
              className="inline-flex items-center gap-1 text-2xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-wider mr-1"
            >
              <ArrowLeft size={12} /> {t('back', 'Back')}
            </button>
            <Badge
              text={STATUS_LABELS[request.status] || request.status}
              className={STATUS_COLORS[request.status] || 'text-gray-500 dark:text-gray-400'}
            />
            {request.report?.is_locked && (request.report.verdict as string) !== 'LOCKED' && allPaid && (
              <Badge
                text={`VERDICT: ${request.report.verdict.toUpperCase()}`}
                className={VERDICT_COLORS[request.report.verdict]}
              />
            )}
            <span className="text-2xs font-mono text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-bold">
              {request.inspection_id}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 sm:justify-end flex-wrap">
            <span>Scope: <strong className="text-gray-700 dark:text-gray-200 capitalize">{request.scope}</strong></span>
            <span>•</span>
            <span>Speed: <strong className="text-gray-700 dark:text-gray-200 capitalize">{request.turnaround}</strong></span>
            <span>•</span>
            <span className="text-[11px] text-gray-400">{fmtDate(request.created_at)}</span>
          </div>
        </div>

        {/* Title - Full Width */}
        <h1 className="text-lg sm:text-xl font-black uppercase text-gray-900 dark:text-white break-words leading-tight">
          {request.item_name}
        </h1>

        {/* Subtle Marketplace Item Link in Title Area - NO OUTER BOUNDARY */}
        {request.product_snapshot && (
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Marketplace Item:</span>
            <Link
              to={`/product/${request.product_snapshot.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200 hover:underline"
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
              <ChevronRight size={12} className="text-gray-400" />
            </Link>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {request.category_path || request.category_name}
        </p>
      </div>

      {/* 2-Column Balanced Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Sidebar Column */}
        <div className="lg:col-span-1 space-y-5">
          {/* Progress Timeline */}
          <div className="card border-0 p-5 bg-white dark:bg-gray-800">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4">
              {t('inspection_progress', 'Inspection Progress')}
            </h3>
            <Timeline status={request.status} />

            {request.assignment && (
              <div className="mt-5 space-y-1">
                <p className="text-2xs font-bold uppercase tracking-wider text-gray-400">{t('assigned_inspector_title', 'Assigned Inspector')}</p>
                <p className="text-sm font-black text-gray-900 dark:text-white">
                  {request.assignment.inspector_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize font-medium">
                  {request.assignment.inspector_level}
                </p>
                {request.assignment.sla_deadline && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Expected by {fmtDate(request.assignment.sla_deadline)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Item & Location Specs */}
          <div className="card border-0 p-5 bg-white dark:bg-gray-800 space-y-2.5">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              {t('location_and_specs', 'Location & Specs')}
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-400 block text-2xs font-bold uppercase">{t('item_location_label', 'Item Location')}</span>
                <span className="text-gray-700 dark:text-gray-300 font-medium">{request.item_address}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-2xs font-bold uppercase">{t('description', 'Description')}</span>
                <p className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{request.item_description}</p>
              </div>
              {request.item_age_years && (
                <div>
                  <span className="text-gray-400 block text-2xs font-bold uppercase">{t('item_age_label', 'Item Age')}</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{request.item_age_years} years</span>
                </div>
              )}
            </div>
          </div>

          {/* QR Code & Authenticity Verification Card */}
          <div className="card border-0 p-4 bg-white dark:bg-gray-800 space-y-3 shadow-xs">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                {t('verified_certificate', 'Verified Certificate')}
              </h4>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white rounded-lg shrink-0">
                <QRCodeSVG value={verifyUrl} size={64} level="M" />
              </div>
              <div className="text-2xs text-gray-500 dark:text-gray-400 space-y-1">
                <p className="font-bold text-gray-900 dark:text-white">{t('scan_with_phone', 'Scan with Phone')}</p>
                <p className="leading-tight">{t('scan_qr_verify_desc', 'Scan this QR code to view and verify this official inspection record online.')}</p>
                <a href={verifyUrl} target="_blank" rel="noreferrer" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:underline font-bold inline-flex items-center gap-1 pt-0.5">
                  {t('verify_record', 'Verify Record')} <ExternalLink size={10} />
                </a>
              </div>
            </div>

            {request.checkin?.checkin_at && (
              <div className="text-2xs text-gray-500 dark:text-gray-400 space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>{t('onsite_checkin', 'On-Site Check-In:')}</span>
                  <span className="font-bold text-gray-700 dark:text-gray-300">{fmtDate(request.checkin.checkin_at)}</span>
                </div>
                {request.checkin?.checkin_lat && request.checkin?.checkin_lng && (
                  <div className="flex justify-between">
                    <span>{t('gps_coordinates', 'GPS Coordinates:')}</span>
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
            <div className="card border-0 p-4 bg-white dark:bg-gray-800 flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{t('request_under_staff_review', 'Request Under Staff Review')}</p>
                <p className="text-2xs text-gray-500">{t('staff_evaluating_bill_desc', 'Staff will evaluate requirements and location to issue your official bill.')}</p>
              </div>
              <span className="text-2xs text-amber-500 dark:text-amber-400 font-medium shrink-0">{t('pending_bill', 'Pending Bill')}</span>
            </div>
          )}

          {/* Bill & Payment */}
          {request.bill && <BillDisplay request={request} onPaid={load} />}

          {/* Report View */}
          {request.report?.is_locked && (
            allPaid ? (
              <ReportView request={request} onReInspect={() => setShowReInspect(true)} />
            ) : (
              <div className="card border-0 p-5 bg-white dark:bg-gray-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
                  <Lock size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">{t('official_report_ready', 'Official Inspection Report Ready')}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                    {t('report_locked_balance_desc', 'The inspector has completed the checklist and QA has approved the assessment. Pay the remaining 70% balance above ({{balance}}) to unlock full findings, defect breakdown, high-res photos, and printable certificate.', { balance: fmtMoney(request.bill?.remaining_balance, request.bill?.currency) })}
                  </p>
                </div>
              </div>
            )
          )}

          {/* Re-inspection modal */}
          {showReInspect && (
            <div className="card border-0 p-5 bg-white dark:bg-gray-800">
              <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{t('request_reinspection', 'Request Re-Inspection')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {t('reinspect_warning_desc', 'A different inspector will be assigned. Only use if inspection conditions were compromised.')}
              </p>
              <textarea
                className="input mb-3 text-xs"
                rows={3}
                placeholder={t('reinspect_reason_placeholder', 'Reason for re-inspection...')}
                value={reInspectReason}
                onChange={(e) => setReInspectReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={handleReInspect} className="btn-primary px-4 py-2 text-xs font-bold">
                  {t('confirm_request', 'Confirm Request')}
                </button>
                <button onClick={() => setShowReInspect(false)} className="btn-secondary px-4 py-2 text-xs font-bold">
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper to determine if a string is a public inspection code format
const isInspectionCode = (str: string): boolean => {
  const trimmed = str.trim();
  return /^OKO-[A-Z0-9]+(-\d{4,8})?-[A-Z0-9]+$/i.test(trimmed) || /^OKO-\d{4,12}$/i.test(trimmed);
};

// ─── My Inspections List ────────────────────
const MyInspections: React.FC = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    inspectionApi.requests.list()
      .then((r: any) => setRequests(r.data.results || r.data))
      .catch(() => toast.error(t('failed_load_inspection', 'Failed to load inspections')))
      .finally(() => setLoading(false));
  }, []);

  const isCode = isInspectionCode(searchQuery);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (isInspectionCode(query)) {
      const matchingLocal = requests.find(
        r => r.inspection_id && r.inspection_id.toLowerCase() === query.toLowerCase()
      );
      if (matchingLocal) {
        // If it's already in the user's local inspections, keep user here with the filtered item
        return;
      }
      // If external code not in local list, navigate to verification page
      navigate(`/verify/${query.toUpperCase()}`);
    }
    // If it's a general search query, just keep the user on the page with filtered results
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
    let list = requests;
    if (filterStatus === 'report_ready') {
      list = list.filter(r => r.has_report || r.status === 'published');
    } else if (filterStatus === 'in_progress') {
      list = list.filter(r => ['assigned', 'in_progress', 'qa_review', 'pre_inspection'].includes(r.status));
    } else if (filterStatus === 'awaiting_payment') {
      list = list.filter(r => ['bill_sent', 'awaiting_payment'].includes(r.status));
    } else if (filterStatus) {
      list = list.filter(r => r.status === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.inspection_id && r.inspection_id.toLowerCase().includes(q)) ||
        (r.item_name && r.item_name.toLowerCase().includes(q)) ||
        (r.category_name && r.category_name.toLowerCase().includes(q)) ||
        (r.item_description && r.item_description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [requests, filterStatus, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('my_inspections', 'My Inspections')}
        subtitle={t('my_inspections_subtitle', 'Track, verify, and manage your item inspections')}
        actions={
          <Link
            to="/inspections/new"
            className="btn-primary text-xs sm:text-sm px-3.5 py-2 flex items-center gap-1.5 font-bold shadow-xs"
          >
            <Plus size={16} />
            <span>{t('new_request', 'New Request')}</span>
          </Link>
        }
      />

      {/* Filter Pills & Search Bar Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
              <span>{t('all', 'All')}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                !filterStatus ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
              }`}>
                {requests.length}
              </span>
            </button>

            {statusCounts.report_ready > 0 && (
              <button
                onClick={() => setFilterStatus('report_ready')}
                className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  filterStatus === 'report_ready' ? 'pill-active shadow-xs' : 'pill-inactive'
                }`}
              >
                <CheckCircle size={14} className="inline mr-0.5" />
                <span>{t('report_ready', 'Report Ready')}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                  filterStatus === 'report_ready' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                }`}>
                  {statusCounts.report_ready}
                </span>
              </button>
            )}

            {statusCounts.in_progress > 0 && (
              <button
                onClick={() => setFilterStatus('in_progress')}
                className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  filterStatus === 'in_progress' ? 'pill-active shadow-xs' : 'pill-inactive'
                }`}
              >
                <Clock size={14} className="inline mr-0.5" />
                <span>{t('in_progress', 'In Progress')}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                  filterStatus === 'in_progress' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                }`}>
                  {statusCounts.in_progress}
                </span>
              </button>
            )}

            {statusCounts.awaiting_payment > 0 && (
              <button
                onClick={() => setFilterStatus('awaiting_payment')}
                className={`pill text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  filterStatus === 'awaiting_payment' ? 'pill-active shadow-xs' : 'pill-inactive'
                }`}
              >
                <FileText size={14} className="inline mr-0.5" />
                <span>{t('awaiting_payment', 'Awaiting Payment')}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                  filterStatus === 'awaiting_payment' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                }`}>
                  {statusCounts.awaiting_payment}
                </span>
              </button>
            )}
          </div>
        ) : null}

        {/* Search & Verify Search Box */}
        <form onSubmit={handleSearchSubmit} className="relative min-w-[220px] sm:w-64 shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className={`w-full h-8 pl-7 pr-6 text-xs font-semibold rounded-full bg-surface-muted dark:bg-[#161616] text-gray-900 dark:text-white placeholder:text-xs placeholder:font-semibold placeholder:text-gray-600 dark:placeholder:text-gray-400 border-0 outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-neutral-700 transition ${
              searchQuery.trim() ? (isCode ? 'pr-16' : 'pr-8') : 'pr-3'
            }`}
            placeholder={t('search_inspections_placeholder', 'Search inspections or ID')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery.trim() && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isCode ? (
                <button
                  type="submit"
                  className="text-[11px] font-bold text-brand-500 hover:text-brand-600 transition px-1"
                  title={t('verify_inspection', 'Verify public inspection ID')}
                >
                  {t('verify_btn', 'Verify →')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 transition"
                  title={t('clear_search', 'Clear search')}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      {/* List / Loading / Empty */}
      {loading ? (
        <div className="space-y-3.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#181818] rounded-xl p-4 sm:p-5 animate-pulse">
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
          title={
            searchQuery.trim()
              ? t('no_inspections_matching', 'No inspections found matching "{{query}}"', { query: searchQuery })
              : requests.length === 0
              ? t('no_inspections_yet', "You haven't requested any inspections yet.")
              : t('no_inspections_status', "No inspections with this status.")
          }
          action={{
            label: searchQuery.trim()
              ? t('clear_search', 'Clear Search')
              : requests.length === 0
              ? t('request_inspection', 'Request Inspection')
              : t('view_all_inspections', 'View All Inspections'),
            onClick: () => {
              if (searchQuery.trim()) {
                setSearchQuery('');
              } else if (requests.length === 0) {
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
                className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden animate-fade-in hover:shadow-md transition-all cursor-pointer p-3.5 sm:p-5 group focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10"
              >
                <div className="flex items-start gap-3 sm:gap-4 w-full">
                  {/* Left: Thumbnail */}
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 mt-0.5">
                    <div className="w-full h-full rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ClipboardList size={22} className="text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    {/* Top Row: Tracking ID & Scope + Status Badge & Chevron */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                        <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest shrink-0">
                          {req.inspection_id || `REQ #${req.id}`}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0">
                          {req.scope} scope
                        </span>
                        <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap shrink-0 hidden sm:inline">
                          {fmtDate(req.created_at)}
                        </span>
                      </div>

                      {/* Status Badge & Chevron */}
                      <div className="flex items-center gap-1.5 shrink-0 pl-1">
                        <Badge
                          text={STATUS_LABELS[req.status] || req.status}
                          className={STATUS_COLORS[req.status] || 'text-gray-500 dark:text-gray-400'}
                        />
                        {req.has_report && req.status !== 'report_ready' && (
                          <span className="text-[10px] font-black text-green-500 dark:text-green-400 uppercase tracking-wider bg-transparent px-1.5 py-0.5 rounded hidden sm:inline-block">
                            Report ready
                          </span>
                        )}
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </div>

                    {/* Date on mobile */}
                    <p className="text-[10px] font-medium text-gray-400 mb-1 sm:hidden">
                      {fmtDate(req.created_at)}
                    </p>

                    {/* Item Name - Uses Full Available Width, wraps gracefully up to 2 lines without clipping */}
                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase line-clamp-2 break-words group-hover:text-brand-500 transition-colors leading-snug">
                      {req.item_name}
                    </h4>

                    {/* Category - Uses Full Available Width */}
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                      <span className="shrink-0">Category:</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300 line-clamp-1 break-words">
                        {req.category_path || req.category_name || 'General'}
                      </span>
                    </div>

                    {/* Secondary Report indicator if not report_ready and mobile */}
                    {req.has_report && req.status !== 'report_ready' && (
                      <div className="mt-1.5 sm:hidden">
                        <span className="text-[10px] font-black text-green-500 dark:text-green-400 uppercase tracking-wider bg-transparent px-1.5 py-0.5 rounded inline-block">
                          Report ready
                        </span>
                      </div>
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
