import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';
import { Package, Plus } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { timeAgo } from '../../utils/timeAgo';
import { useDialog } from '../../components/ui/Dialogs';
import ProductVariantsModal from './ProductVariantsModal';

const CATEGORY_VARIATION_DEFAULTS: Record<string, string[]> = {
  'electronics': ['Color', 'Storage Capacity'],
  'electronics-mobile-phones': ['Color', 'Storage Capacity', 'RAM'],
  'electronics-computers-laptops': ['Processor', 'RAM', 'Storage Capacity'],
  'electronics-tvs-audio': ['Screen Size', 'Color'],
  'mens-fashion': ['Size', 'Color'],
  'mens-fashion-clothing': ['Size', 'Color', 'Material'],
  'mens-fashion-shoes': ['Shoe Size', 'Color'],
  'mens-fashion-watches': ['Strap Color', 'Dial Color'],
  'womens-fashion': ['Size', 'Color', 'Material'],
  'vehicles-cars': ['Color', 'Trim Level'],
  'vehicles-vehicle-parts-accessories': ['Compatibility', 'Color'],
};

// ============ Dashboard Products ============
const DashboardProducts: React.FC = () => {
  const { user } = useAuth();
  const { showConfirm } = useDialog();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [variantProductId, setVariantProductId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', sale_price: '', stock: '', category: '', condition: 'New', is_available: true });
  const [newVariants, setNewVariants] = useState<any[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [locData, setLocData] = useState({ latitude: '', longitude: '', location_name: '' });
  const [locStatus, setLocStatus] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [variationColumns, setVariationColumns] = useState<string[]>(['Option 1']);
  const [showCustomColumnInput, setShowCustomColumnInput] = useState(false);
  const [customColumnName, setCustomColumnName] = useState('');
  const [deletedVariantIds, setDeletedVariantIds] = useState<number[]>([]);

  // Flatten the nested category tree from the API into a flat list for the <select> dropdown
  const flatCategories = useMemo(() => {
    const result: any[] = [];
    for (const cat of categories) {
      result.push({ id: cat.id, name: cat.name, slug: cat.slug, depth: 0 });
      if (cat.children?.length) {
        for (const child of cat.children) {
          result.push({ id: child.id, name: `  › ${child.name}`, slug: child.slug, depth: 1 });
        }
      }
    }
    return result;
  }, [categories]);

  useEffect(() => {
    if (!editingId && form.category) {
      const selectedCat = flatCategories.find(c => String(c.id) === String(form.category));
      if (selectedCat && selectedCat.slug) {
         const defaults = CATEGORY_VARIATION_DEFAULTS[selectedCat.slug];
         setVariationColumns(defaults || ['Option 1']);
         // Ensure existing newVariants have the right fields initialized
         setNewVariants(prev => prev.map(v => {
           const newFields: Record<string, string> = {};
           (defaults || ['Option 1']).forEach(col => newFields[col] = v.fields?.[col] || '');
           return { ...v, fields: newFields };
         }));
      }
    }
  }, [form.category, editingId, flatCategories]);

  // Infinite Scroll state
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const currentUser = localStorage.getItem('username');

  const fetchProducts = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }
    
    api.get(`/api/products/?seller=${currentUser}&page=${p}`)
      .then((res) => {
        const data = res.data.results || res.data;
        const arr = Array.isArray(data) ? data : [];
        if (reset) {
          setProducts(arr);
        } else {
          setProducts((prev) => {
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueIncoming = arr.filter(p => !existingIds.has(p.id));
            return [...prev, ...uniqueIncoming];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => setHasMore(false))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [currentUser]);

  useEffect(() => {
    fetchProducts(1, true);
    api.get('/api/categories/')
      .then((res) => setCategories(res.data.results || res.data))
      .catch(() => {});
      
    if (window.location.hash === '#new') {
      setShowForm(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [fetchProducts]);

  useEffect(() => {
    if (showForm && !editingId) {
      setLocStatus('Fetching location...');
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const latStr = latitude.toFixed(6);
            const lngStr = longitude.toFixed(6);
            try {
              const res = await api.get(`/api/health/reverse_geocode/?lat=${latitude}&lng=${longitude}`);
              const location_name = res.data.address || 'Coordinates mapped';
              setLocData({ latitude: latStr, longitude: lngStr, location_name });
              setLocStatus(`Location: ${location_name}`);
            } catch {
              setLocData({ latitude: latStr, longitude: lngStr, location_name: 'Coordinates mapped' });
              setLocStatus('Location coordinates captured');
            }
          },
          () => {
            setLocStatus('Location access denied or unavailable.');
            setLocData({ latitude: '', longitude: '', location_name: '' });
          }
        );
      } else {
        setLocStatus('Geolocation not supported.');
      }
    }
  }, [showForm, editingId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchProducts(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '800px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchProducts]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImageFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('description', form.description);
      formData.append('price', form.price);
      if (form.sale_price) formData.append('sale_price', form.sale_price);
      formData.append('stock', form.stock);
      formData.append('category', form.category);
      formData.append('condition', form.condition);
      formData.append('is_available', String(form.is_available));
      if (locData.latitude) formData.append('latitude', locData.latitude);
      if (locData.longitude) formData.append('longitude', locData.longitude);
      if (locData.location_name) formData.append('location_name', locData.location_name);

      imageFiles.forEach((file) => {
        formData.append('uploaded_images', file);
      });

      let baseProductId = null;
      if (editingId) {
        await api.put(`/api/products/${editingId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product updated!');
        baseProductId = editingProductId;
      } else {
        const res = await api.post('/api/products/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product created!');
        baseProductId = res.data.id;
      }

      if (newVariants.length > 0 && baseProductId) {
        for (const nv of newVariants) {
          const parts = variationColumns.map(col => nv.fields?.[col]).filter(Boolean);
          if (parts.length === 0) continue;
          const finalName = parts.join(' / ');
          const finalAdjustment = nv.price_adj_sign === '-' ? `-${nv.price_adjustment || '0'}` : (nv.price_adjustment || '0');
          const vData = new FormData();
          vData.append('product', String(baseProductId));
          vData.append('name', finalName);
          vData.append('price_adjustment', finalAdjustment);
          vData.append('stock', nv.stock || '0');
          vData.append('is_available', 'true');
          if (nv.imageFile) {
            vData.append('image', nv.imageFile);
          }
          try {
            if (nv.id) {
              await api.put(`/api/variants/${nv.id}/`, vData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
              await api.post('/api/variants/', vData, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
          } catch (err) {
            console.error('Variant save failed:', err);
          }
        }
        toast.success('Variations saved!');
      }

      if (deletedVariantIds.length > 0) {
        for (const id of deletedVariantIds) {
          try {
            const vData = new FormData();
            vData.append('is_available', 'false');
            vData.append('stock', '0');
            await api.patch(`/api/variants/${id}/`, vData);
          } catch (e) {
            console.error('Failed to soft delete variant', e);
          }
        }
      }

      setShowForm(false);
      setEditingId(null);
      setEditingProductId(null);
      setForm({ name: '', description: '', price: '', sale_price: '', stock: '', category: '', condition: 'New', is_available: true });
      setImageFiles([]);
      setExistingImages([]);
      setNewVariants([]);
      setDeletedVariantIds([]);
      fetchProducts(1, true);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (product: any) => {
    setForm({
      name: product.name,
      description: product.description,
      price: product.price,
      sale_price: product.sale_price || '',
      stock: String(product.stock),
      category: String(product.category),
      condition: product.condition,
      is_available: product.is_available,
    });
    setEditingId(product.slug);
    setEditingProductId(product.id);
    setExistingImages(product.images || []);
    setNewVariants([]);
    setShowForm(true);

    try {
      const vRes = await api.get(`/api/variants/?product=${product.id}`);
      const fetchedVars = (vRes.data.results || vRes.data).filter((v: any) => v.is_available !== false);
      // Determine columns for editing
      const selectedCat = flatCategories.find(c => String(c.id) === String(product.category));
      let cols = ['Option 1'];
      if (selectedCat && selectedCat.slug && CATEGORY_VARIATION_DEFAULTS[selectedCat.slug]) {
         cols = [...CATEGORY_VARIATION_DEFAULTS[selectedCat.slug]];
      }

      const parsedVars = fetchedVars.map((v: any) => {
        const parts = v.name.split(' / ');
        const fields: Record<string, string> = {};
        
        while (cols.length < parts.length) {
           cols.push(`Custom ${cols.length + 1}`);
        }
        
        parts.forEach((p: string, idx: number) => {
           fields[cols[idx]] = p;
        });

        return {
          id: v.id,
          fields,
          price_adj_sign: v.price_adjustment.startsWith('-') ? '-' : '+',
          price_adjustment: v.price_adjustment.replace('-', ''),
          stock: String(v.stock),
          existingImageUrl: v.image
        };
      });
      setVariationColumns(cols);
      setNewVariants(parsedVars);
    } catch {
      toast.error('Failed to load existing variations');
    }
  };

  const handleDelete = async (slug: string) => {
    const confirmed = await showConfirm('Are you sure you want to delete this product?', 'Delete Listing');
    if (!confirmed) return;
    try {
      await api.delete(`/api/products/${slug}/`);
      toast.success('Product deleted');
      fetchProducts(1, true);
    } catch {
      toast.error('Failed to delete product');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Products</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setExistingImages([]);
            setNewVariants([]);
            setForm({ name: '', description: '', price: '', sale_price: '', stock: '', category: '', condition: 'New', is_available: true });
          }}
          disabled={user?.tier === 'customer'}
          className={`flex items-center gap-2 px-4 py-2 ${user?.tier === 'customer' ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'} text-white rounded-lg transition text-sm`}
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'New Product'}
        </button>
      </div>

      {user?.tier === 'customer' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-200">
                Your seller plan has expired. Your products are currently hidden from the public. Please <a href="/subscription" className="font-medium underline text-yellow-700 dark:text-yellow-200 hover:text-yellow-600 dark:hover:text-yellow-100">renew your plan</a> to continue selling.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Product Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-6 mb-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center justify-between">
            <span>{editingId ? 'Edit Product' : 'Create Product'}</span>
            {!editingId && (
              <span className="text-xs text-brand-600 dark:text-brand-400 font-normal bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded-full">{locStatus}</span>
            )}
          </h3>
          <input name="name" value={form.name} onChange={handleChange} placeholder="Product Name" required
            className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" required rows={3}
            className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white resize-none" />
          <div className="grid grid-cols-3 gap-4">
            <input name="price" value={form.price} onChange={handleChange} placeholder="Price" type="number" required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
            <input name="sale_price" value={form.sale_price} onChange={handleChange} placeholder="Sale Price (Optional)" type="number"
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
            <input name="stock" value={form.stock} onChange={handleChange} placeholder="Stock" type="number" required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select name="category" value={form.category} onChange={handleChange} required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
              <option value="">Select Category</option>
              {flatCategories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select name="condition" value={form.condition} onChange={handleChange}
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
              <option value="New">New</option>
              <option value="Used">Used</option>
            </select>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
            <input 
              type="checkbox" 
              name="is_available" 
              id="is_available"
              checked={form.is_available} 
              onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-gray-900 dark:focus:ring-white" 
            />
            <label htmlFor="is_available" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Product is Available for Sale
            </label>
          </div>
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">Product Variations</h4>
                <p className="text-xs text-gray-500">Configure category-specific variations like size, color, or capacity.</p>
              </div>
              <div className="flex flex-col gap-3">
                {variationColumns.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Active Columns:</span>
                    {variationColumns.map((col, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                        {col}
                        <button type="button" onClick={() => setVariationColumns(variationColumns.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-0.5 transition" title="Remove column">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 items-center">
                  {showCustomColumnInput ? (
                    <div className="flex items-center gap-2">
                      <input 
                        autoFocus
                        placeholder="e.g. Length"
                        value={customColumnName}
                        onChange={e => setCustomColumnName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customColumnName.trim()) {
                            const col = customColumnName.trim();
                            setVariationColumns([...variationColumns, col]);
                            setNewVariants(prev => prev.map(v => ({ ...v, fields: { ...v.fields, [col]: '' } })));
                            setCustomColumnName('');
                            setShowCustomColumnInput(false);
                          } else if (e.key === 'Escape') {
                            setShowCustomColumnInput(false);
                          }
                        }}
                        className="text-xs p-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white outline-none focus:border-brand-500 w-24"
                      />
                      <button type="button" onClick={() => {
                          if (customColumnName.trim()) {
                            const col = customColumnName.trim();
                            setVariationColumns([...variationColumns, col]);
                            setNewVariants(prev => prev.map(v => ({ ...v, fields: { ...v.fields, [col]: '' } })));
                            setCustomColumnName('');
                          }
                          setShowCustomColumnInput(false);
                      }} className="text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 px-2 py-1.5 rounded-lg transition">
                        Add
                      </button>
                      <button type="button" onClick={() => setShowCustomColumnInput(false)} className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1.5">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowCustomColumnInput(true)} className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition whitespace-nowrap">
                      <Plus size={14} /> Add Custom Column
                    </button>
                  )}
                  <button type="button" onClick={() => setNewVariants([...newVariants, { fields: {}, price_adj_sign: '+', price_adjustment: '0', stock: '0' }])} className="text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 px-3 py-1.5 rounded-lg flex items-center gap-1 transition whitespace-nowrap">
                    <Plus size={14} /> Add Option
                  </button>
                </div>
              </div>
            </div>
            {newVariants.length > 0 && (
              <div className="space-y-3 mb-4 overflow-x-auto pb-2">
                {newVariants.map((v, i) => (
                  <div key={i} className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 relative min-w-max">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                      <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Variation Option {i + 1}</h5>
                      <button type="button" onClick={() => { 
                          const nv = [...newVariants]; 
                          const removed = nv.splice(i, 1)[0]; 
                          setNewVariants(nv); 
                          if (removed.id) setDeletedVariantIds(prev => [...prev, removed.id]);
                        }} className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        Remove Option
                      </button>
                    </div>
                    <div className="flex gap-3 items-end">
                       {variationColumns.map((col, colIdx) => (
                         <div key={colIdx} className="w-32 shrink-0">
                           <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1 truncate" title={col}>{col}</label>
                           <input placeholder={`e.g. Value`} value={v.fields?.[col] || ''} onChange={e => { const nv = [...newVariants]; if (!nv[i].fields) nv[i].fields = {}; nv[i].fields[col] = e.target.value; setNewVariants(nv); }} className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:ring-1 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white outline-none transition" />
                         </div>
                       ))}
                       <div className="w-24 shrink-0">
                         <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Stock</label>
                         <input placeholder="0" type="number" value={v.stock} onChange={e => { const nv = [...newVariants]; nv[i].stock = e.target.value; setNewVariants(nv); }} className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:ring-1 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white outline-none transition" required />
                       </div>
                       <div className="w-32 shrink-0">
                         <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Price Adj.</label>
                         <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-within:ring-1 focus-within:ring-gray-900/10 dark:focus-within:ring-white/10 focus-within:border-gray-900 dark:focus-within:border-white transition overflow-hidden">
                           <select value={v.price_adj_sign} onChange={e => { const nv = [...newVariants]; nv[i].price_adj_sign = e.target.value; setNewVariants(nv); }} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-2 text-sm outline-none border-r border-gray-200 dark:border-gray-600 font-bold">
                             <option value="+">+</option>
                             <option value="-">-</option>
                           </select>
                           <input placeholder="0" type="number" value={v.price_adjustment} onChange={e => { const nv = [...newVariants]; nv[i].price_adjustment = e.target.value; setNewVariants(nv); }} className="w-full p-2 text-sm bg-transparent dark:text-white outline-none" />
                         </div>
                       </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      {v.existingImageUrl && !v.imageFile && (
                        <SafeImage src={v.existingImageUrl} alt="Variant" category="product" className="w-10 h-10 rounded border dark:border-gray-700 object-cover shrink-0" />
                      )}
                      {v.imageFile && (
                        <div className="w-10 h-10 rounded border border-brand-500 bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
                          <Package size={16} className="text-brand-500" />
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Variation Image (Optional)</label>
                        <input type="file" accept="image/*" onChange={e => { const nv = [...newVariants]; nv[i].imageFile = e.target.files?.[0]; setNewVariants(nv); }} className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {existingImages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Images
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {existingImages.map((img: any) => (
                  <div key={img.id} className="relative w-20 h-20 shrink-0">
                    <SafeImage src={img.image} alt="Product" category={categories.find(c => String(c.id) === String(form.category))?.name || ''} className="w-full h-full object-cover rounded-lg border dark:border-gray-600" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {existingImages.length > 0 ? 'Upload Additional Images' : 'Product Images (multiple)'}
            </label>
            <input type="file" multiple accept="image/*" onChange={handleImageChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            {imageFiles.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{imageFiles.length} file(s) selected</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => {
              setShowForm(false);
              setEditingId(null);
              setEditingProductId(null);
              setForm({ name: '', description: '', price: '', sale_price: '', stock: '', category: '', condition: 'New', is_available: true });
              setImageFiles([]);
              setExistingImages([]);
              setNewVariants([]);
              setDeletedVariantIds([]);
            }} disabled={submitting} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-[2] py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold rounded-lg transition">
              {submitting ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      )}

      {/* Products Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <Package size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No products yet. Create your first listing!</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product: any) => (
            <div key={product.id}
              className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 hover:shadow-sm transition">
              <SafeImage src={product.images?.[0]?.image || ''} alt={product.name} category={product.category_name}
                className="w-16 h-16 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white truncate">{product.name}</h4>
                <p className="text-sm text-brand-600 dark:text-brand-400 font-bold">
                  TSh {parseInt(product.price).toLocaleString()}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Stock: {product.stock}</span>
                  {product.created_at && (
                    <>
                      <span>•</span>
                      <span>{timeAgo(product.created_at)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => handleEdit(product)}
                  className="px-3 py-1.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">
                  Edit
                </button>
                <button onClick={() => setVariantProductId(product.id.toString())}
                  className="px-3 py-1.5 text-xs text-center border border-brand-300 dark:border-brand-600 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition">
                  Variants
                </button>
                <button onClick={() => handleDelete(product.slug)}
                  className="px-3 py-1.5 text-xs text-center border border-red-300 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-4" />}
        {loadingMore && <div className="text-center py-4 text-gray-500 text-sm">Loading more...</div>}
        </>
      )}

      {variantProductId && (
        <ProductVariantsModal 
          productId={variantProductId} 
          onClose={() => setVariantProductId(null)} 
        />
      )}
    </div>
  );
};


export default DashboardProducts;
