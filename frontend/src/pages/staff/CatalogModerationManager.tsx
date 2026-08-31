import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  CheckCircle2, Edit3, Trash2, Search, 
  GitMerge, Building2, Sliders, Smartphone
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { CardGridSkeleton } from '../../components/Skeleton';

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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
      fd.append('name', editName);
      if (editLogo) fd.append('logo', editLogo);

      await api.patch(`/api/brands/${editBrand.id}/`, fd);
      toast.success('Brand details updated');
      setEditBrand(null);
      if (brandSubTab === 'queue') fetchUnverified();
      else fetchAllBrands();
    } catch {
      toast.error('Failed to update brand');
    } finally {
      setActionLoading(false);
    }
  };

  // Merge Brands
  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSource || !mergeTargetId) return;
    try {
      setActionLoading(true);
      await api.post(`/api/brands/${mergeSource.id}/merge/`, { target_brand_id: parseInt(mergeTargetId) });
      toast.success(`Merged "${mergeSource.name}" successfully!`);
      setMergeSource(null);
      setMergeTargetId('');
      if (brandSubTab === 'queue') fetchUnverified();
      else fetchAllBrands();
      fetchStats();
    } catch {
      toast.error('Failed to merge brands');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Brand
  const handleDeleteBrand = async (brand: BrandItem) => {
    if (!window.confirm(`Are you sure you want to delete "${brand.name}"?`)) return;
    try {
      await api.delete(`/api/brands/${brand.id}/`);
      toast.success('Brand deleted');
      if (brandSubTab === 'queue') fetchUnverified();
      else fetchAllBrands();
      fetchStats();
    } catch {
      toast.error('Failed to delete brand');
    }
  };

  // Verify Model
  const handleVerifyModel = async (model: ReferenceModelItem) => {
    try {
      setActionLoading(true);
      await api.post(`/api/reference-products/${model.id}/verify/`);
      toast.success(`Model "${model.name}" verified!`);
      setUnverifiedModels(prev => prev.filter(m => m.id !== model.id));
      fetchStats();
    } catch {
      toast.error('Model verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Standardize Spec Value
  const handleStandardizeSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!standardizeSpec || !standardizedValue.trim()) return;
    try {
      setActionLoading(true);
      await api.post('/api/categories/standardize_spec_value/', {
        category_id: standardizeSpec.category_id,
        spec_key: standardizeSpec.spec_key,
        old_value: standardizeSpec.discovered_value,
        standardized_value: standardizedValue.trim()
      });
      toast.success('Specification value standardized across listings');
      setStandardizeSpec(null);
      setStandardizedValue('');
      fetchDiscoveredSpecs();
    } catch {
      toast.error('Failed to standardize spec');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered lists
  const filteredBrands = useMemo(() => {
    const list = brandSubTab === 'queue' ? unverifiedBrands : allBrands;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(b => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q));
  }, [brandSubTab, unverifiedBrands, allBrands, searchQuery]);

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return unverifiedModels;
    const q = searchQuery.toLowerCase();
    return unverifiedModels.filter(m => 
      m.name.toLowerCase().includes(q) || 
      (m.brand_name || '').toLowerCase().includes(q) ||
      (m.category_name || '').toLowerCase().includes(q)
    );
  }, [unverifiedModels, searchQuery]);

  const filteredSpecs = useMemo(() => {
    if (!searchQuery.trim()) return discoveredSpecs;
    const q = searchQuery.toLowerCase();
    return discoveredSpecs.filter(s => 
      s.spec_label.toLowerCase().includes(q) || 
      s.discovered_value.toLowerCase().includes(q) ||
      s.category_name.toLowerCase().includes(q)
    );
  }, [discoveredSpecs, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Catalog & Taxonomy Curation</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Review user-created brands, standardize specs, and maintain clean product reference data.
          </p>
        </div>
        
        {/* Universal Mode Switcher */}
        <div className="flex bg-surface-muted dark:bg-[#161616] p-1 rounded-full border border-surface-border dark:border-surface-dark-border">
          <button
            type="button"
            onClick={() => setMainTab('brands')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              mainTab === 'brands'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Building2 size={13} /> Brands
            {stats.unverified_brands_count > 0 && (
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMainTab('models')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              mainTab === 'models'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Smartphone size={13} /> Reference Models
          </button>
          <button
            type="button"
            onClick={() => setMainTab('specs')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              mainTab === 'specs'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Sliders size={13} /> Dynamic Specs
          </button>
        </div>
      </header>

      {/* Main Tab: Brands */}
      {mainTab === 'brands' && (
        <>
          {/* Sub-Tabs Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setBrandSubTab('queue')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  brandSubTab === 'queue'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                Verification Queue
                <span className="px-1.5 py-0.2 rounded-full text-3xs font-black bg-brand-500/20 text-brand-500">
                  {stats.unverified_brands_count}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBrandSubTab('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  brandSubTab === 'all'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                All Directory Brands ({stats.total_brands_count})
              </button>
            </div>

            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search brands by name..."
                className="input pl-8 py-1.5 text-xs w-full"
              />
            </div>
          </div>

          {loading ? (
            <CardGridSkeleton count={6} cols={3} />
          ) : filteredBrands.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No Brands Found"
              description={searchQuery ? 'No brands match your search query.' : 'There are currently no brands in this queue.'}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBrands.map((brand) => (
                <div key={brand.id} className="card p-5 flex flex-col justify-between space-y-4 hover:border-gray-900/20 dark:hover:border-white/20 transition">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {brand.logo ? (
                          <img src={brand.logo} alt={brand.name} className="w-10 h-10 rounded-btn object-contain border border-surface-border p-1 bg-white" />
                        ) : (
                          <div className="w-10 h-10 rounded-btn bg-surface-muted border border-surface-border flex items-center justify-center text-gray-400 font-black text-sm">
                            {brand.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white text-base">{brand.name}</h4>
                          <p className="text-3xs text-gray-400 font-mono">slug: {brand.slug}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        brand.is_verified
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${brand.is_verified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {brand.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </div>

                    {/* Clean Unboxed Metadata */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-normal">Products Listed</span>
                        <span className="font-medium text-gray-900 dark:text-gray-200">{brand.products_count || 0}</span>
                      </div>
                      {brand.created_by_username && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 dark:text-gray-500 font-normal">Submitted By</span>
                          <span className="font-medium text-brand-500">@{brand.created_by_username}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-border/40">
                    {!brand.is_verified && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleVerify(brand)}
                        disabled={actionLoading}
                        className="py-1 px-2.5 text-3xs flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Verify
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditBrand(brand);
                        setEditName(brand.name);
                        setEditLogo(null);
                      }}
                      className="py-1 px-2.5 text-3xs flex items-center gap-1"
                    >
                      <Edit3 size={12} /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMergeSource(brand);
                        setMergeTargetId('');
                      }}
                      className="py-1 px-2.5 text-3xs flex items-center gap-1 text-purple-500"
                    >
                      <GitMerge size={12} /> Merge
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteBrand(brand)}
                      className="py-1 px-2.5 text-3xs flex items-center gap-1 ml-auto"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Main Tab: Reference Models */}
      {mainTab === 'models' && (
        <>
          <div className="flex justify-end">
            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference models..."
                className="input pl-8 py-1.5 text-xs w-full"
              />
            </div>
          </div>

          {loading ? (
            <CardGridSkeleton count={6} cols={3} />
          ) : filteredModels.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="No Reference Models"
              description="There are currently no reference models awaiting verification."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModels.map((model) => (
                <div key={model.id} className="card p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base">{model.name}</h4>
                        <p className="text-xs text-brand-500 font-bold">{model.brand_name} • {model.category_name}</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Pending
                      </span>
                    </div>

                    {model.structured_specs && Object.keys(model.structured_specs).length > 0 && (
                      <div className="space-y-1 text-xs">
                        {Object.entries(model.structured_specs).slice(0, 4).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-gray-400 dark:text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-surface-border/40">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleVerifyModel(model)}
                      disabled={actionLoading}
                      className="w-full"
                    >
                      Confirm & Verify Reference Model
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Main Tab: Discovered Specs */}
      {mainTab === 'specs' && (
        <>
          <div className="flex justify-end">
            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search discovered specs..."
                className="input pl-8 py-1.5 text-xs w-full"
              />
            </div>
          </div>

          {loading ? (
            <CardGridSkeleton count={6} cols={3} />
          ) : filteredSpecs.length === 0 ? (
            <EmptyState
              icon={Sliders}
              title="No Dynamic Specs Found"
              description="No user-submitted dynamic specifications require standardization at this time."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSpecs.map((spec, idx) => (
                <div key={idx} className="card p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-3xs font-bold text-brand-500 uppercase">{spec.category_name}</span>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm mt-0.5">{spec.spec_label}</h4>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-muted text-gray-600 dark:text-gray-400 border border-surface-border">
                        {spec.occurrences_count} items
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-normal">Discovered Value</span>
                        <span className="font-mono font-medium text-brand-500">"{spec.discovered_value}"</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-surface-border/40">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setStandardizeSpec(spec);
                        setStandardizedValue(spec.discovered_value);
                      }}
                      className="w-full text-xs"
                    >
                      Standardize Value
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit Brand Modal */}
      {editBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setEditBrand(null)}>
          <div className="card max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-base text-gray-900 dark:text-white">Edit & Standardize Brand</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Brand Name</label>
                <input required type="text" className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Brand Logo (Optional)</label>
                <input type="file" accept="image/*" className="input text-xs" onChange={(e) => setEditLogo(e.target.files?.[0] || null)} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border/40">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditBrand(null)}>Cancel</Button>
                <Button type="submit" variant="default" size="sm" disabled={actionLoading}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Brands Modal */}
      {mergeSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setMergeSource(null)}>
          <div className="card max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-base text-gray-900 dark:text-white">Merge Duplicate Brand</h3>
            <p className="text-xs text-gray-500">
              Merge all products listed under <strong className="text-gray-900 dark:text-white">"{mergeSource.name}"</strong> into an existing master verified brand.
            </p>
            <form onSubmit={handleMerge} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Target Master Brand</label>
                <select required className="input" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
                  <option value="">-- Select Master Brand --</option>
                  {allBrands.filter(b => b.id !== mergeSource.id).map(b => (
                    <option key={b.id} value={b.id.toString()}>{b.name} ({b.slug})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border/40">
                <Button type="button" variant="outline" size="sm" onClick={() => setMergeSource(null)}>Cancel</Button>
                <Button type="submit" variant="default" size="sm" disabled={actionLoading || !mergeTargetId}>Confirm Merge</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standardize Spec Modal */}
      {standardizeSpec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setStandardizeSpec(null)}>
          <div className="card max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-base text-gray-900 dark:text-white">Standardize Specification</h3>
            <p className="text-xs text-gray-500">
              Clean up user variations for <strong className="text-gray-900 dark:text-white">"{standardizeSpec.spec_label}"</strong> in {standardizeSpec.category_name}.
            </p>
            <form onSubmit={handleStandardizeSpec} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Old Discovered Value</label>
                <input disabled className="input bg-surface-muted" value={standardizeSpec.discovered_value} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Standardized Value</label>
                <input required className="input font-medium" value={standardizedValue} onChange={(e) => setStandardizedValue(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border/40">
                <Button type="button" variant="outline" size="sm" onClick={() => setStandardizeSpec(null)}>Cancel</Button>
                <Button type="submit" variant="default" size="sm" disabled={actionLoading}>Update Listings</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogModerationManager;
