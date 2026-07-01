import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Package, Plus } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { timeAgo } from '../../utils/timeAgo';
import { useDialog } from '../../components/ui/Dialogs';

// ============ Dashboard Products ============
const DashboardProducts: React.FC = () => {
  const { showConfirm } = useDialog();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', category: '', condition: 'New', is_available: true, weight_kg: '1.0', size: 'small' });
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [locData, setLocData] = useState({ latitude: '', longitude: '', location_name: '' });
  const [locStatus, setLocStatus] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

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
      formData.append('stock', form.stock);
      formData.append('category', form.category);
      formData.append('condition', form.condition);
      formData.append('is_available', String(form.is_available));
      formData.append('weight_kg', form.weight_kg);
      formData.append('size', form.size);
      if (locData.latitude) formData.append('latitude', locData.latitude);
      if (locData.longitude) formData.append('longitude', locData.longitude);
      if (locData.location_name) formData.append('location_name', locData.location_name);

      imageFiles.forEach((file) => {
        formData.append('uploaded_images', file);
      });

      if (editingId) {
        await api.put(`/api/products/${editingId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product updated!');
      } else {
        await api.post('/api/products/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product created!');
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', description: '', price: '', stock: '', category: '', condition: 'New', is_available: true, weight_kg: '1.0', size: 'small' });
      setImageFiles([]);
      setExistingImages([]);
      fetchProducts(1, true);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product: any) => {
    setForm({
      name: product.name,
      description: product.description,
      price: product.price,
      stock: String(product.stock),
      category: String(product.category),
      condition: product.condition,
      is_available: product.is_available,
      weight_kg: String(product.weight_kg || '1.0'),
      size: product.size || 'small',
    });
    setEditingId(product.slug);
    setExistingImages(product.images || []);
    setShowForm(true);
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
            setForm({ name: '', description: '', price: '', stock: '', category: '', condition: 'New', is_available: true, weight_kg: '1.0', size: 'small' });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition text-sm"
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'New Product'}
        </button>
      </div>

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
          <div className="grid grid-cols-2 gap-4">
            <input name="price" value={form.price} onChange={handleChange} placeholder="Price" type="number" required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
            <input name="stock" value={form.stock} onChange={handleChange} placeholder="Stock" type="number" required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select name="category" value={form.category} onChange={handleChange} required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
              <option value="">Select Category</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select name="condition" value={form.condition} onChange={handleChange}
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
              <option value="New">New</option>
              <option value="Used">Used</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input name="weight_kg" value={form.weight_kg} onChange={handleChange} placeholder="Weight (kg)" type="number" step="0.1" required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
            <select name="size" value={form.size} onChange={handleChange}
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="oversized">Oversized</option>
            </select>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
            <input 
              type="checkbox" 
              name="is_available" 
              id="is_available"
              checked={form.is_available} 
              onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" 
            />
            <label htmlFor="is_available" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Product is Available for Sale
            </label>
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
          <button type="submit" disabled={submitting}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold rounded-lg transition">
            {submitting ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
          </button>
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
    </div>
  );
};


export default DashboardProducts;
