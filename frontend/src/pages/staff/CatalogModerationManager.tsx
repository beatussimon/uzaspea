import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, AlertCircle, Edit3, Trash2, Search, 
  GitMerge, RefreshCw, Sparkles, Building2, 
  X, Sliders, Smartphone
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

interface BrandItem {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_by_username: string | null;
  created_at: string | null;
  products_count: number;
}

interface ReferenceModelItem {
  id: number;
  name: string;
  slug: string;
  brand: number;
  brand_name: string;
  category: number;
  category_name: string;
  image: string | null;
  structured_specs: Record<string, any>;
  is_verified: boolean;
  created_by_username: string | null;
  created_at: string | null;
  products_count: number;
}

interface DiscoveredSpecItem {
  category_id: number;
  category_name: string;
  category_slug: string;
  spec_key: string;
  spec_label: string;
  discovered_value: string;
  occurrences_count: number;
  sample_products: string[];
}

interface CatalogStats {
  unverified_brands_count: number;
  total_brands_count: number;
  total_reference_models_count: number;
}

export const CatalogModerationManager: React.FC = () => {
  const [mainTab, setMainTab] = useState<'brands' | 'models' | 'specs'>('brands');
  const [brandSubTab, setBrandSubTab] = useState<'queue' | 'all'>('queue');
  
  // Data
  const [unverifiedBrands, setUnverifiedBrands] = useState<BrandItem[]>([]);
  const [allBrands, setAllBrands] = useState<BrandItem[]>([]);
  const [unverifiedModels, setUnverifiedModels] = useState<ReferenceModelItem[]>([]);
  const [discoveredSpecs, setDiscoveredSpecs] = useState<DiscoveredSpecItem[]>([]);
  const [stats, setStats] = useState<CatalogStats>({
    unverified_brands_count: 0,
    total_brands_count: 0,
    total_reference_models_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Action States
  const [editBrand, setEditBrand] = useState<BrandItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editLogo, setEditLogo] = useState<File | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Merge Brand State
  const [mergeSource, setMergeSource] = useState<BrandItem | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');

  // Edit Model State
  const [editModel, setEditModel] = useState<ReferenceModelItem | null>(null);
  const [editModelName, setEditModelName] = useState('');

  // Standardize Spec State
  const [standardizeSpec, setStandardizeSpec] = useState<DiscoveredSpecItem | null>(null);
  const [standardizedValue, setStandardizedValue] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/brands/stats/');
      setStats(res.data);
    } catch (e) {
      console.error('Failed to fetch catalog stats', e);
    }
  }, []);

  const fetchUnverified = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/brands/unverified/');
      setUnverifiedBrands(res.data);
    } catch (e) {
      toast.error('Failed to load unverified brands');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllBrands = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/brands/?all=true&include_unverified=true');
      setAllBrands(res.data);
    } catch (e) {
      toast.error('Failed to load brands catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnverifiedModels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/reference-products/?only_unverified=true');
      setUnverifiedModels(res.data?.results || res.data || []);
    } catch (e) {
      toast.error('Failed to load reference models queue');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDiscoveredSpecs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/categories/discovered_specs/');
      setDiscoveredSpecs(res.data);
    } catch (e) {
      toast.error('Failed to load discovered specifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    if (mainTab === 'brands') {
      if (brandSubTab === 'queue') fetchUnverified();
      else fetchAllBrands();
    } else if (mainTab === 'models') {
      fetchUnverifiedModels();
    } else {
      fetchDiscoveredSpecs();
    }
  }, [mainTab, brandSubTab, fetchStats, fetchUnverified, fetchAllBrands, fetchUnverifiedModels, fetchDiscoveredSpecs]);

  // 1-Click Verify Brand
  const handleVerify = async (brand: BrandItem) => {
    try {
      setActionLoading(true);
      await api.post(`/api/brands/${brand.id}/verify/`);
      toast.success(`Brand "${brand.name}" verified!`);
      setUnverifiedBrands(prev => prev.filter(b => b.id !== brand.id));
      fetchStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit & Standardize Brand
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBrand) return;
    try {
      setActionLoading(true);
      const fd = new FormData();
      if (editName.trim()) fd.append('name', editName.trim());
      if (editLogo) fd.append('logo', editLogo);

      await api.post(`/api/brands/${editBrand.id}/verify/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(`Brand "${editName.trim() || editBrand.name}" updated & verified!`);
      setEditBrand(null);
      setEditName('');
      setEditLogo(null);
      if (brandSubTab === 'queue') fetchUnverified();
      else fetchAllBrands();
      fetchStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to update brand');
    } finally {
      setActionLoading(false);
    }
  };

  // Merge Brands
  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSource || !mergeTargetId) {
      toast.error('Please select a target brand to merge into');
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.post('/api/brands/merge/', {
        source_brand_id: mergeSource.id,
        target_brand_id: Number(mergeTargetId)
      });
      toast.success(res.data.message || 'Brands merged successfully!');
      setMergeSource(null);
      setMergeTargetId('');
      if (brandSubTab === 'queue') fetchUnverified();
      else fetchAllBrands();
      fetchStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Merge failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Brand
  const handleDelete = async (brand: BrandItem) => {
    if (!window.confirm(`Are you sure you want to delete brand "${brand.name}"? Active listings will lose this brand association.`)) {
      return;
    }
    try {
      setActionLoading(true);
      await api.delete(`/api/brands/${brand.id}/`);
      toast.success(`Brand "${brand.name}" deleted.`);
      if (brandSubTab === 'queue') {
        setUnverifiedBrands(prev => prev.filter(b => b.id !== brand.id));
      } else {
        setAllBrands(prev => prev.filter(b => b.id !== brand.id));
      }
      fetchStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to delete brand');
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Click Verify Model
  const handleVerifyModel = async (model: ReferenceModelItem) => {
    try {
      setActionLoading(true);
      await api.post(`/api/reference-products/${model.id}/verify/`);
      toast.success(`Model "${model.name}" verified!`);
      setUnverifiedModels(prev => prev.filter(m => m.id !== model.id));
      fetchStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Edit Model
  const handleSaveEditModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModel || !editModelName.trim()) return;
    try {
      setActionLoading(true);
      await api.post(`/api/reference-products/${editModel.id}/verify/`, {
        name: editModelName.trim()
      });
      toast.success(`Model "${editModelName.trim()}" updated & verified!`);
      setEditModel(null);
      setEditModelName('');
      fetchUnverifiedModels();
      fetchStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to update model');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Model
  const handleDeleteModel = async (model: ReferenceModelItem) => {
    if (!window.confirm(`Are you sure you want to delete model "${model.name}"?`)) return;
    try {
      setActionLoading(true);
      await api.delete(`/api/reference-products/${model.id}/`);
      toast.success(`Model "${model.name}" deleted.`);
      setUnverifiedModels(prev => prev.filter(m => m.id !== model.id));
      fetchStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to delete model');
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Click Approve Spec Option into Category Schema
  const handleApproveSpec = async (spec: DiscoveredSpecItem) => {
    try {
      setActionLoading(true);
      const res = await api.post('/api/categories/approve_spec_option/', {
        category_id: spec.category_id,
        spec_key: spec.spec_key,
        spec_label: spec.spec_label,
        value: spec.discovered_value
      });
      toast.success(res.data.message || `Added "${spec.discovered_value}" to ${spec.category_name}!`);
      setDiscoveredSpecs(prev => prev.filter(s => !(s.category_id === spec.category_id && s.spec_key === spec.spec_key && s.discovered_value === spec.discovered_value)));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to approve specification');
    } finally {
      setActionLoading(false);
    }
  };

  // Standardize & Replace Spec Option
  const handleStandardizeSpecSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!standardizeSpec || !standardizedValue.trim()) return;
    try {
      setActionLoading(true);
      const res = await api.post('/api/categories/standardize_spec_option/', {
        category_id: standardizeSpec.category_id,
        spec_key: standardizeSpec.spec_key,
        old_value: standardizeSpec.discovered_value,
        new_value: standardizedValue.trim()
      });
      toast.success(res.data.message || 'Specification standardized!');
      setStandardizeSpec(null);
      setStandardizedValue('');
      fetchDiscoveredSpecs();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to standardize specification');
    } finally {
      setActionLoading(false);
    }
  };

  const displayedBrands = (brandSubTab === 'queue' ? unverifiedBrands : allBrands).filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedModels = unverifiedModels.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.category_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedSpecs = discoveredSpecs.filter(s =>
    s.category_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.spec_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.discovered_value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Metric Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-500" /> Catalog & Taxonomy Curation
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Review, standardize, and approve crowdsourced brands, device models, specifications, and custom attributes.
          </p>
        </div>
        <button 
          onClick={() => { 
            fetchStats(); 
            if (mainTab === 'brands') brandSubTab === 'queue' ? fetchUnverified() : fetchAllBrands();
            else if (mainTab === 'models') fetchUnverifiedModels();
            else fetchDiscoveredSpecs(); 
          }}
          className="self-start sm:self-auto px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Data
        </button>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0A0A0A] flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-neutral-900 dark:text-white">{stats.unverified_brands_count}</p>
            <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Pending Brands</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0A0A0A] flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Smartphone size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-neutral-900 dark:text-white">{unverifiedModels.length}</p>
            <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Pending Models</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0A0A0A] flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Sliders size={20} />
          </div>
          <div>
            <p className="text-2xl font-black text-neutral-900 dark:text-white">{discoveredSpecs.length}</p>
            <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Discovered Spec Options</p>
          </div>
        </div>
      </div>

      {/* Primary Tab Selector */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <button
          onClick={() => setMainTab('brands')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            mainTab === 'brands'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Building2 size={14} /> Brands Queue ({stats.unverified_brands_count})
        </button>

        <button
          onClick={() => setMainTab('models')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            mainTab === 'models'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Smartphone size={14} /> Models Queue ({unverifiedModels.length})
        </button>

        <button
          onClick={() => setMainTab('specs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            mainTab === 'specs'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Sliders size={14} /> Spec Options & Attributes ({discoveredSpecs.length})
        </button>
      </div>

      {/* Sub-Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {mainTab === 'brands' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBrandSubTab('queue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                brandSubTab === 'queue'
                  ? 'bg-brand-500 text-black shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <AlertCircle size={13} /> Unverified Queue ({stats.unverified_brands_count})
            </button>
            <button
              onClick={() => setBrandSubTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                brandSubTab === 'all'
                  ? 'bg-brand-500 text-black shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Building2 size={13} /> All Brands ({stats.total_brands_count})
            </button>
          </div>
        ) : mainTab === 'models' ? (
          <div className="text-xs text-neutral-500">
            Unverified device & product models added by sellers. Click <strong>"Verify"</strong> to promote them to the canonical series list.
          </div>
        ) : (
          <div className="text-xs text-neutral-500">
            Custom specification values submitted by sellers. Click <strong>"Add to Dropdown"</strong> to promote them into category picklists.
          </div>
        )}

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder={mainTab === 'brands' ? "Search brands or slugs..." : mainTab === 'models' ? "Search models or brands..." : "Search categories or specs..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-white outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {mainTab === 'brands' ? (
        /* Brands Table */
        <div className="bg-white dark:bg-[#0A0A0A] rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-xs text-neutral-400">Loading catalog items...</div>
          ) : displayedBrands.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                {brandSubTab === 'queue' ? 'Queue is clean!' : 'No brands matched your search.'}
              </p>
              <p className="text-xs text-neutral-400">
                {brandSubTab === 'queue' ? 'All user-submitted brands have been verified or standardized.' : 'Try a different search query.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Slug</th>
                    <th className="py-3 px-4">Listings</th>
                    <th className="py-3 px-4">Submitted By</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {displayedBrands.map(brand => (
                    <tr key={brand.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 transition">
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        {brand.logo ? (
                          <img src={brand.logo} alt={brand.name} className="w-6 h-6 object-contain rounded border border-neutral-200 dark:border-neutral-800" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-bold flex items-center justify-center text-[10px]">
                            {brand.name.charAt(0)}
                          </div>
                        )}
                        <span>{brand.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-500">{brand.slug}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-[10px]">
                          {brand.products_count} {brand.products_count === 1 ? 'product' : 'products'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-500">
                        {brand.created_by_username ? `@${brand.created_by_username}` : 'System / Seed'}
                      </td>
                      <td className="py-3 px-4">
                        {brand.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            <CheckCircle2 size={11} /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                            <AlertCircle size={11} /> Unverified
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!brand.is_verified && (
                            <button
                              onClick={() => handleVerify(brand)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-[10px] rounded transition flex items-center gap-1"
                              title="1-Click Approve"
                            >
                              <CheckCircle2 size={11} /> Verify
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditBrand(brand);
                              setEditName(brand.name);
                              setEditLogo(null);
                            }}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded transition"
                            title="Edit & Standardize Name / Logo"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              setMergeSource(brand);
                              setMergeTargetId('');
                            }}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-brand-500 rounded transition"
                            title="Merge Duplicate into Canonical Brand"
                          >
                            <GitMerge size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(brand)}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-red-500 rounded transition"
                            title="Delete Brand"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : mainTab === 'models' ? (
        /* Reference Models Table */
        <div className="bg-white dark:bg-[#0A0A0A] rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-xs text-neutral-400">Loading reference models...</div>
          ) : displayedModels.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                No pending device models!
              </p>
              <p className="text-xs text-neutral-400">
                When sellers type custom model names for brands, they will appear here for 1-click verification.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Model / Series</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Listings</th>
                    <th className="py-3 px-4">Submitted By</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {displayedModels.map(model => (
                    <tr key={model.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 transition">
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                        {model.name}
                      </td>
                      <td className="py-3 px-4 font-semibold text-brand-600 dark:text-brand-400">
                        {model.brand_name}
                      </td>
                      <td className="py-3 px-4 text-neutral-500">
                        {model.category_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-[10px]">
                          {model.products_count} {model.products_count === 1 ? 'listing' : 'listings'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-500">
                        {model.created_by_username ? `@${model.created_by_username}` : 'User'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleVerifyModel(model)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-[10px] rounded transition flex items-center gap-1"
                            title="Verify & Promote to Master Model Series"
                          >
                            <CheckCircle2 size={11} /> Verify
                          </button>
                          <button
                            onClick={() => {
                              setEditModel(model);
                              setEditModelName(model.name);
                            }}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded transition"
                            title="Edit Model Name"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteModel(model)}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-red-500 rounded transition"
                            title="Delete Model"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Discovered Specs & Attributes Table */
        <div className="bg-white dark:bg-[#0A0A0A] rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-xs text-neutral-400">Scanning product specifications...</div>
          ) : displayedSpecs.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                All custom specification values have been standardized!
              </p>
              <p className="text-xs text-neutral-400">
                As sellers enter custom attributes or options on listings, they will automatically appear here for review.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Spec Attribute</th>
                    <th className="py-3 px-4">Discovered Value</th>
                    <th className="py-3 px-4">Occurrences</th>
                    <th className="py-3 px-4">Sample Listings</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {displayedSpecs.map((spec, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 transition">
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                        {spec.category_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-[11px]">
                          {spec.spec_label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-brand-600 dark:text-brand-400">
                        {spec.discovered_value}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                          {spec.occurrences_count} {spec.occurrences_count === 1 ? 'listing' : 'listings'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-500 text-[11px] max-w-xs truncate">
                        {spec.sample_products.join(', ') || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApproveSpec(spec)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-[10px] rounded transition flex items-center gap-1"
                            title="Add directly to Category Schema Dropdown"
                          >
                            <CheckCircle2 size={11} /> Add to Dropdown
                          </button>
                          <button
                            onClick={() => {
                              setStandardizeSpec(spec);
                              setStandardizedValue(spec.discovered_value);
                            }}
                            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded transition"
                            title="Standardize / Format Value"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ Edit Brand Modal ═══ */}
      {editBrand && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111] rounded-2xl max-w-md w-full p-5 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="font-bold text-neutral-900 dark:text-white text-sm flex items-center gap-2">
                <Edit3 size={16} className="text-brand-500" /> Standardize Brand
              </h3>
              <button onClick={() => setEditBrand(null)} className="text-neutral-400 hover:text-neutral-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Canonical Brand Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Official Brand Logo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditLogo(e.target.files?.[0] || null)}
                  className="w-full text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 dark:file:bg-neutral-800 dark:file:text-neutral-300 hover:file:bg-neutral-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditBrand(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-black text-xs font-bold rounded-lg transition"
                >
                  {actionLoading ? 'Saving...' : 'Save & Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Edit Model Modal ═══ */}
      {editModel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111] rounded-2xl max-w-md w-full p-5 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="font-bold text-neutral-900 dark:text-white text-sm flex items-center gap-2">
                <Edit3 size={16} className="text-brand-500" /> Standardize Model Name
              </h3>
              <button onClick={() => setEditModel(null)} className="text-neutral-400 hover:text-neutral-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditModel} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Canonical Model / Series Name
                </label>
                <input
                  type="text"
                  required
                  value={editModelName}
                  onChange={(e) => setEditModelName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditModel(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !editModelName.trim()}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-black text-xs font-bold rounded-lg transition"
                >
                  {actionLoading ? 'Saving...' : 'Save & Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Merge Brand Modal ═══ */}
      {mergeSource && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111] rounded-2xl max-w-md w-full p-5 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="font-bold text-neutral-900 dark:text-white text-sm flex items-center gap-2">
                <GitMerge size={16} className="text-brand-500" /> Merge Brand
              </h3>
              <button onClick={() => setMergeSource(null)} className="text-neutral-400 hover:text-neutral-600">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Merge all listings under <strong className="text-neutral-900 dark:text-white">"{mergeSource.name}"</strong> into a target canonical brand. The source brand will then be deleted.
            </p>

            <form onSubmit={handleMerge} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Target Canonical Brand
                </label>
                <select
                  required
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500"
                >
                  <option value="">Select target canonical brand...</option>
                  {allBrands
                    .filter(b => b.id !== mergeSource.id)
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.is_verified ? 'Verified' : 'Unverified'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setMergeSource(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !mergeTargetId}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-black text-xs font-bold rounded-lg transition flex items-center gap-1"
                >
                  <GitMerge size={12} /> {actionLoading ? 'Merging...' : 'Confirm Merge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Standardize Spec Option Modal ═══ */}
      {standardizeSpec && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111] rounded-2xl max-w-md w-full p-5 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="font-bold text-neutral-900 dark:text-white text-sm flex items-center gap-2">
                <Edit3 size={16} className="text-brand-500" /> Standardize Specification Value
              </h3>
              <button onClick={() => setStandardizeSpec(null)} className="text-neutral-400 hover:text-neutral-600">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Format or standardize <strong className="text-neutral-900 dark:text-white">"{standardizeSpec.discovered_value}"</strong> under <strong>{standardizeSpec.category_name} ({standardizeSpec.spec_label})</strong>. This will update all {standardizeSpec.occurrences_count} listing(s) and add the standardized value to the category dropdown.
            </p>

            <form onSubmit={handleStandardizeSpecSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Standardized Value
                </label>
                <input
                  type="text"
                  required
                  value={standardizedValue}
                  onChange={(e) => setStandardizedValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setStandardizeSpec(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !standardizedValue.trim()}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-black text-xs font-bold rounded-lg transition"
                >
                  {actionLoading ? 'Saving...' : 'Standardize & Save to Schema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogModerationManager;
