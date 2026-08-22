import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';
import { Package, Plus, Printer } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { timeAgo } from '../../utils/timeAgo';
import { useDialog } from '../../components/ui/Dialogs';
import ProductVariantsModal from './ProductVariantsModal';
import { useTranslation } from 'react-i18next';
import VehicleSelector from '../../components/VehicleSelector';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ReportPrintHeader } from '../../components/print/ReportPrintHeader';
import { useLocation } from 'react-router-dom';

// ─── Mobile detection (camera option only shown on touch devices) ─────────────
const isMobile = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// ─── Reusable image picker button ────────────────────────────────────────────
interface ImagePickerButtonProps {
  label?: string;
  compact?: boolean;
  multiple?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
const ImagePickerButton: React.FC<ImagePickerButtonProps> = ({
  label = 'Add Images',
  compact = false,
  multiple = false,
  onChange,
}) => {
  const [open, setOpen] = React.useState(false);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const mobile = isMobile();

  return (
    <>
      {mobile && (
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple={multiple} onChange={onChange} className="hidden" />
      )}
      <input ref={galleryRef} type="file" accept="image/*" multiple={multiple} onChange={onChange} className="hidden" />

      {/* trigger button */}
      <button
        type="button"
        onClick={() => (mobile ? setOpen(true) : galleryRef.current?.click())}
        className={
          compact
            ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-brand-500 dark:border-brand-500   text-brand-500 dark:text-brand-500 text-xs font-semibold   transition-colors'
            : 'flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-brand-500 dark:border-brand-500   text-brand-500 dark:text-brand-500 font-semibold text-sm   transition-colors w-full justify-center'
        }
      >
        <svg className={compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {label}
      </button>

      {/* bottom-sheet picker — mobile only */}
      {open && mobile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-t-3xl px-5 pt-4 pb-10 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-5" />
            <p className="text-center text-base font-bold text-gray-900 dark:text-white mb-5">{label}</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Camera */}
              <button
                type="button"
                onClick={() => { setOpen(false); cameraRef.current?.click(); }}
                className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800   hover:border-brand-500 dark:hover:border-brand-500 transition-all group"
              >
                <div className="w-12 h-12 rounded-full   flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-brand-500 dark:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Use Camera</span>
              </button>
              {/* Gallery */}
              <button
                type="button"
                onClick={() => { setOpen(false); galleryRef.current?.click(); }}
                className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800   hover:border-brand-500 dark:hover:border-brand-500 transition-all group"
              >
                <div className="w-12 h-12 rounded-full   flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-brand-500 dark:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Choose File</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full py-3 rounded-xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};


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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showConfirm } = useDialog();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [quickStockValue, setQuickStockValue] = useState<string>('');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [variantProductId, setVariantProductId] = useState<string | null>(null);
  const INITIAL_FORM = { name: '', sku: '', description: '', price: '', buying_price: '', sale_price: '', stock: '', category: '', condition: 'New', is_available: true, requires_quote: false, unit_of_measure: 'piece', minimum_order_quantity: '1', brand: '', reference_product: '', structured_specs: {} as Record<string, any> };
  const [form, setForm] = useState(INITIAL_FORM);
  const [vehicleIds, setVehicleIds] = useState<string[]>([]);
  const [oemPartNumber, setOemPartNumber] = useState<string>('');
  const [priceTiers, setPriceTiers] = useState<any[]>([]);

  // Dynamic Specs
  const [specSchema, setSpecSchema] = useState<any[]>([]);
  const [categoryBrands, setCategoryBrands] = useState<any[]>([]);
  const [referenceProducts, setReferenceProducts] = useState<any[]>([]);
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  
  // Batch Upload Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchUploading, setBatchUploading] = useState(false);
  const [newVariants, setNewVariants] = useState<any[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [locData, setLocData] = useState({ latitude: '', longitude: '', location_name: '' });
  const [, setLocStatus] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Array<{ url: string; file: File; aspectStatus: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [variationColumns, setVariationColumns] = useState<string[]>(['Option 1']);
  const [showCustomColumnInput, setShowCustomColumnInput] = useState(false);
  const [customColumnName, setCustomColumnName] = useState('');
  const [deletedVariantIds, setDeletedVariantIds] = useState<number[]>([]);
  const location = useLocation();
  const [fulfillRequestId, setFulfillRequestId] = useState<number | null>(null);

  // Wizard state — must be at component top level (React Rules of Hooks)
  const [wizardStep, setWizardStep] = useState(1);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dropRef = React.useRef<HTMLDivElement>(null);


  // Prefill from demand card conversion
  useEffect(() => {
    if (location.state && (location.state as any).convert_request) {
      const req = (location.state as any).convert_request;
      setForm(prev => ({
        ...prev,
        name: req.name || '',
        description: req.description || '',
        price: req.price ? String(req.price) : '',
        category: req.category?.id ? String(req.category.id) : (req.category ? String(req.category) : ''),
        condition: req.condition || 'New',
        requires_quote: req.requires_quote || false,
      }));
      setFulfillRequestId(req.id);
      setShowForm(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

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

  // Fetch Dynamic Schema and Brands when Category changes
  useEffect(() => {
    if (form.category) {
      const selectedCat = flatCategories.find(c => String(c.id) === String(form.category));
      if (selectedCat && selectedCat.slug) {
        api.get(`/api/categories/${selectedCat.slug}/spec-schema/`).then(res => setSpecSchema(res.data)).catch(() => setSpecSchema([]));
        api.get(`/api/categories/${selectedCat.slug}/brands/`).then(res => setCategoryBrands(res.data)).catch(() => setCategoryBrands([]));
      }
    } else {
      setSpecSchema([]);
      setCategoryBrands([]);
      setReferenceProducts([]);
    }
  }, [form.category, flatCategories]);

  // Fetch Reference Products when Brand or Category changes
  useEffect(() => {
    if (form.category && form.brand) {
      const selectedCat = flatCategories.find(c => String(c.id) === String(form.category));
      const catSlug = selectedCat?.slug || '';
      api.get(`/api/reference-products/?category=${catSlug}&brand=${form.brand}`).then(res => setReferenceProducts(res.data.results || res.data)).catch(() => setReferenceProducts([]));
    } else {
      setReferenceProducts([]);
    }
  }, [form.category, form.brand, flatCategories]);

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
    const params = new URLSearchParams();
    if (currentUser) params.append('mine', 'true');
    params.append('page', p.toString());
    if (searchQuery) params.append('q', searchQuery);
    if (filterCategory) params.append('category', filterCategory);
    if (filterCondition) params.append('condition', filterCondition);
    
    api.get(`/api/products/?${params.toString()}`)
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
  }, [currentUser, searchQuery, filterCategory, filterCondition]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts(1, true);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, filterCategory, filterCondition, fetchProducts]);

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
      const files = Array.from(e.target.files);
      setImageFiles(prev => [...prev, ...files]);
      
      const newPreviews = files.map(file => {
        const url = URL.createObjectURL(file);
        const previewItem = { url, file, aspectStatus: 'Checking...' };

        const img = new Image();
        img.onload = () => {
          const ratio = img.naturalWidth / img.naturalHeight;
          let status = 'Good (Landscape)';
          if (ratio >= 0.85 && ratio <= 1.15) {
            status = 'Perfect (1:1)';
          } else if (ratio < 0.85) {
            status = '⚠️ Tall (Vertical)';
          }
          setImagePreviews(prevList => 
            prevList.map(item => item.url === url ? { ...item, aspectStatus: status } : item)
          );
        };
        img.src = url;
        return previewItem;
      });

      setImagePreviews(prev => [...prev, ...newPreviews]);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const previewToRemove = imagePreviews[indexToRemove];
    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove.url);
    }
    const updatedPreviews = imagePreviews.filter((_, idx) => idx !== indexToRemove);
    setImagePreviews(updatedPreviews);
    setImageFiles(updatedPreviews.map(p => p.file));
  };

  const handleBatchUpload = async () => {
    if (!batchFile) return;
    setBatchUploading(true);
    const formData = new FormData();
    formData.append('file', batchFile);
    try {
      const res = await api.post('/api/products/batch_upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message || 'Batch import successful!');
      setShowBatchModal(false);
      setBatchFile(null);
      fetchProducts(1, true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Batch import failed');
    } finally {
      setBatchUploading(false);
    }
  };



  const handleEdit = async (product: any) => {
    setForm({
      name: product.name,
      sku: product.sku || '',
      description: product.description,
      price: product.price,
      buying_price: product.buying_price || '',
      sale_price: product.sale_price || '',
      stock: String(product.stock),
      category: String(product.category),
      condition: product.condition,
      is_available: product.is_available,
      requires_quote: product.requires_quote || false,
      unit_of_measure: product.unit_of_measure || 'piece',
      minimum_order_quantity: product.minimum_order_quantity || '1',
      brand: product.brand_details?.slug || '',
      reference_product: product.reference_product_details?.slug || '',
      structured_specs: product.structured_specs || {},
    });
    setPriceTiers(product.price_tiers || []);
    setEditingId(product.slug);
    setEditingProductId(product.id);
    setVehicleIds(product.vehicle_ids ? product.vehicle_ids.map(String) : []);
    setOemPartNumber(product.oem_part_number || '');

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

  const handleQuickStockUpdate = async (productId: number) => {
    if (!quickStockValue || isNaN(Number(quickStockValue))) return;
    try {
      const formData = new FormData();
      formData.append('stock', quickStockValue);
      // Ensure product stays available if stock > 0
      if (Number(quickStockValue) > 0) {
        formData.append('is_available', 'true');
      }
      
      const targetSlug = products.find(p => p.id === productId)?.slug;
      if (!targetSlug) return;
      
      await api.patch(`/api/products/${targetSlug}/`, formData);
      toast.success('Stock updated');
      setEditingStockId(null);
      
      // Update local state to avoid full refetch if preferred, but fetch is safer
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: Number(quickStockValue) } : p));
    } catch (e: any) {
      toast.error('Failed to update stock');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">{t('my_products', 'My Products')}</h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            onClick={() => setShowBatchModal(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Package size={16} />
            Batch Import (CSV)
          </Button>
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setExistingImages([]);
              setNewVariants([]);
              setForm(INITIAL_FORM);
            }}
            disabled={user?.tier === 'customer'}
            variant={showForm ? 'outline' : 'default'}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            {showForm ? 'Cancel' : t('add_new', 'Add New')}
          </Button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition shadow-sm font-bold text-sm"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      {!showForm && (
        <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <input
            type="text"
            placeholder="Search by Name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full md:w-48 p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Categories</option>
            {flatCategories.map((c: any) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value)}
            className="w-full md:w-32 p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Any Condition</option>
            <option value="New">New</option>
            <option value="Used">Used</option>
          </select>
        </div>
      )}

      {/* Batch Upload Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Batch Import Products</h3>
            <p className="text-sm text-gray-500 mb-4">
              Upload a CSV file with your products. Ensure your CSV has columns like Name, Description, Price, Stock, Category ID, SKU, and Condition.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setBatchFile(e.target.files ? e.target.files[0] : null)}
              className="w-full mb-6 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file: file:text-brand-500 hover:file:"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowBatchModal(false)}>Cancel</Button>
              <Button onClick={handleBatchUpload} disabled={!batchFile || batchUploading}>
                {batchUploading ? 'Importing...' : 'Upload CSV'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {user?.tier === 'customer' && (
        <div className="  border-l-4 border-yellow-500 p-4 mb-6 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-500 dark:text-yellow-500">
                Your seller plan has expired. Your products are currently hidden from the public. Please <a href="/subscription" className="font-medium underline text-yellow-500 dark:text-yellow-500 hover:text-yellow-500 dark:hover:text-yellow-500">renew your plan</a> to continue selling.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PRODUCT FORM — MULTI-STEP WIZARD                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showForm && (() => {

        const canProceedStep1 = imagePreviews.length > 0 || existingImages.length > 0 || !!editingId;
        const canSubmit = form.name && form.price && form.stock && form.category && form.description;

        // XHR submit with real progress
        const handleSubmitWithProgress = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!canSubmit) { toast.error('Please fill in all required fields'); return; }
          setSubmitting(true);
          setUploadProgress(0);
          setUploadStatus('Preparing upload...');
          try {
            const fd = new FormData();
            fd.append('name', form.name);
            if (form.sku) fd.append('sku', form.sku);
            fd.append('description', form.description);
            fd.append('price', form.price);
            if (form.buying_price) fd.append('buying_price', form.buying_price);
            if (form.sale_price) fd.append('sale_price', form.sale_price);
            fd.append('stock', form.stock);
            fd.append('category', form.category);
            
            // Append Vehicle Fitment data
            if (vehicleIds.length > 0) {
              vehicleIds.forEach(vid => fd.append('vehicle_ids', vid));
            }
            if (oemPartNumber) {
              fd.append('oem_part_number', oemPartNumber);
            }
            fd.append('condition', form.condition);
            fd.append('is_available', String(form.is_available));
            fd.append('requires_quote', String(form.requires_quote));
            fd.append('unit_of_measure', form.unit_of_measure);
            fd.append('minimum_order_quantity', form.minimum_order_quantity);
            if (fulfillRequestId) fd.append('fulfill_request_id', String(fulfillRequestId));
            if (priceTiers.length > 0) fd.append('price_tiers', JSON.stringify(priceTiers));
            
            if (form.brand) fd.append('brand', form.brand);
            if (form.reference_product) fd.append('reference_product', form.reference_product);
            if (Object.keys(form.structured_specs).length > 0) {
              fd.append('structured_specs', JSON.stringify(form.structured_specs));
            }
            
            if (locData.latitude) fd.append('latitude', locData.latitude);
            if (locData.longitude) fd.append('longitude', locData.longitude);
            if (locData.location_name) fd.append('location_name', locData.location_name);
            
            // Compress images before upload to speed up network and backend processing
            const compressedFiles = await Promise.all(
              imageFiles.map(file => {
                return new Promise<File>((resolve) => {
                  const img = new Image();
                  const url = URL.createObjectURL(file);
                  img.onload = () => {
                    URL.revokeObjectURL(url);
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 1200;
                    if (width > MAX_WIDTH) {
                      height = Math.round((height * MAX_WIDTH) / width);
                      width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(file);
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                      if (!blob) return resolve(file);
                      resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    }, 'image/jpeg', 0.85);
                  };
                  img.onerror = () => resolve(file);
                  img.src = url;
                });
              })
            );
            
            compressedFiles.forEach((file) => fd.append('uploaded_images', file));

            const token = localStorage.getItem('access_token');
            const url = editingId ? `/api/products/${editingId}/` : '/api/products/';
            const method = editingId ? 'PUT' : 'POST';

            const result: any = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open(method, url);
              if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
              xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) {
                  const pct = Math.round((ev.loaded / ev.total) * 100);
                  setUploadProgress(pct);
                  setUploadStatus(pct < 50 ? 'Uploading photos...' : pct < 90 ? 'Almost there...' : 'Processing...');
                }
              };
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
                } else {
                  try { reject(JSON.parse(xhr.responseText)); } catch { reject({ detail: 'Upload failed' }); }
                }
              };
              xhr.onerror = () => reject({ detail: 'Network error' });
              xhr.send(fd);
            });

            setUploadProgress(100);
            setUploadStatus('Done!');
            const baseProductId = editingId ? editingProductId : result.id;
            toast.success(editingId ? 'Product updated!' : 'Product created!');

            if (newVariants.length > 0 && baseProductId) {
              for (const nv of newVariants) {
                const parts = variationColumns.map(col => nv.fields?.[col]).filter(Boolean);
                if (parts.length === 0) continue;
                const vData = new FormData();
                vData.append('product', String(baseProductId));
                vData.append('name', parts.join(' / '));
                vData.append('price_adjustment', nv.price_adj_sign === '-' ? `-${nv.price_adjustment || '0'}` : (nv.price_adjustment || '0'));
                vData.append('stock', nv.stock || '0');
                vData.append('is_available', 'true');
                if (nv.imageFile) vData.append('image', nv.imageFile);
                try {
                  if (nv.id) await api.put(`/api/variants/${nv.id}/`, vData, { headers: { 'Content-Type': 'multipart/form-data' } });
                  else await api.post('/api/variants/', vData, { headers: { 'Content-Type': 'multipart/form-data' } });
                } catch {}
              }
            }
            if (deletedVariantIds.length > 0) {
              for (const id of deletedVariantIds) {
                try { await api.patch(`/api/variants/${id}/`, { is_available: false, stock: 0 }); } catch {}
              }
            }

            setShowForm(false); setEditingId(null); setEditingProductId(null); setFulfillRequestId(null); setWizardStep(1); setShowAdvanced(false);
            setForm(INITIAL_FORM);
            imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
            setImagePreviews([]); setImageFiles([]); setExistingImages([]); setNewVariants([]); setDeletedVariantIds([]); setPriceTiers([]);
            fetchProducts(1, true);
          } catch (error: any) {
            toast.error(error?.detail || 'Failed to save product');
          } finally {
            setSubmitting(false); setUploadProgress(null); setUploadStatus('');
          }
        };

        const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
        const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };
        const handleDrop = (e: React.DragEvent) => {
          e.preventDefault(); setDragOver(false);
          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
          if (!files.length) return;
          setImageFiles(prev => [...prev, ...files]);
          const newPreviews = files.map(file => {
            const url = URL.createObjectURL(file);
            const item = { url, file, aspectStatus: 'Checking...' };
            const img = new Image(); img.onload = () => {
              const r = img.naturalWidth / img.naturalHeight;
              setImagePreviews(prev => prev.map(p => p.url === url ? { ...p, aspectStatus: r >= 0.85 && r <= 1.15 ? 'Perfect' : r < 0.85 ? 'Vertical' : 'Good' } : p));
            }; img.src = url;
            return item;
          });
          setImagePreviews(prev => [...prev, ...newPreviews]);
        };

        const cancelForm = () => {
          setShowForm(false); setEditingId(null); setEditingProductId(null); setWizardStep(1); setShowAdvanced(false);
          setForm(INITIAL_FORM);
          imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
          setImagePreviews([]); setImageFiles([]); setExistingImages([]); setNewVariants([]); setDeletedVariantIds([]);
        };

        return (
          <form onSubmit={handleSubmitWithProgress} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 shadow-lg overflow-hidden">

            {/* ─── UPLOAD PROGRESS OVERLAY ─── */}
            {submitting && uploadProgress !== null && (
              <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center space-y-5">
                  <div className="w-16 h-16 mx-auto rounded-full   flex items-center justify-center">
                    {uploadProgress < 100 ? (
                      <svg className="w-8 h-8 text-brand-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    ) : (
                      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{uploadStatus}</p>
                    <p className="text-sm text-gray-500 mt-1">{uploadProgress}%</p>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%`, background: uploadProgress >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #f97316)' }} />
                  </div>
                </div>
              </div>
            )}

            {/* ─── STEP INDICATOR ─── */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Product' : 'New Product'}</h3>
                {!editingId && locData.latitude && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                    Location captured
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {[1, 2].map(step => (
                  <React.Fragment key={step}>
                    <button type="button" onClick={() => { if (step < wizardStep || (step === 2 && canProceedStep1)) setWizardStep(step); }}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-all ${wizardStep === step ? 'text-brand-500 dark:text-brand-500' : wizardStep > step ? 'text-emerald-600 dark:text-emerald-400 cursor-pointer' : 'text-gray-400'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${wizardStep === step ? 'bg-brand-500 text-white' : wizardStep > step ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                        {wizardStep > step ? '✓' : step}
                      </span>
                      {step === 1 ? 'Photos' : 'Details'}
                    </button>
                    {step < 2 && <div className={`flex-1 h-0.5 rounded-full ${wizardStep > step ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="px-5 pb-5">
              {/* ═══ STEP 1: PHOTOS ═══ */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  {existingImages.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Images</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {existingImages.map((img: any) => (
                          <div key={img.id} className="w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 border-emerald-400">
                            <SafeImage src={img.image} alt="Product" category={categories.find(c => String(c.id) === String(form.category))?.name || ''} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={dropRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    className={`rounded-xl border-2 border-dashed transition-all duration-200 ${dragOver ? 'border-brand-500   scale-[1.01]' : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 hover:border-brand-500'} ${imagePreviews.length > 0 ? 'p-4' : 'p-8'}`}>
                    {imagePreviews.length === 0 ? (
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl   flex items-center justify-center">
                          <svg className="w-8 h-8 text-brand-500 dark:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <p className="text-base font-bold text-gray-700 dark:text-gray-200 mb-1">{dragOver ? 'Drop photos here!' : 'Add product photos'}</p>
                        <p className="text-sm text-gray-500 mb-4">Drag and drop or tap to browse</p>
                        <ImagePickerButton label="Choose Photos" multiple onChange={handleImageChange} />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                          {imagePreviews.map((p, idx) => (
                            <div key={p.url} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
                              <img src={p.url} alt="Preview" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => handleRemoveImage(idx)}
                                className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-500 text-white rounded-full transition opacity-0 group-hover:opacity-100" title="Remove">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          <ImagePickerButton label="Add More" compact multiple onChange={handleImageChange} />
                          <span className="text-xs text-gray-400">{imagePreviews.length} photo{imagePreviews.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={cancelForm} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm">Cancel</button>
                    <button type="button" onClick={() => setWizardStep(2)} disabled={!canProceedStep1 && !editingId}
                      className="flex-[2] py-2.5 bg-brand-500 hover:bg-brand-500 disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition text-sm flex items-center justify-center gap-2">
                      Next: Details <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ STEP 2: DETAILS ═══ */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Category *</label>
                      <select name="category" value={form.category} onChange={handleChange} required
                        className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition">
                        <option value="">Select Category</option>
                        {flatCategories.map((cat: any) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                      </select>
                    </div>
                  </div>
                  
                  {/* DYNAMIC VEHICLE FITMENT SECTION */}
                  {(() => {
                    const selectedCat = flatCategories.find(c => String(c.id) === String(form.category));
                    const isAuto = selectedCat && (selectedCat.slug.includes('vehicle') || selectedCat.slug.includes('part') || selectedCat.slug.includes('auto') || selectedCat.slug.includes('car'));
                    if (!isAuto) return null;
                    return (
                      <div className="mt-4 p-4 rounded-xl border border-brand-500/30 bg-brand-500/5">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          Vehicle Fitment (Optional)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Select Compatible Vehicle</label>
                            <VehicleSelector onVehicleSelect={(v) => {
                               if (v && !vehicleIds.includes(v)) setVehicleIds([...vehicleIds, v]);
                            }} />
                            {vehicleIds.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {vehicleIds.map(vid => (
                                  <span key={vid} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-600 text-xs font-bold">
                                    Vehicle ID: {vid}
                                    <button type="button" onClick={() => setVehicleIds(vehicleIds.filter(id => id !== vid))} className="hover:text-brand-800">&times;</button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">OEM Part Number</label>
                            <input type="text" value={oemPartNumber} onChange={(e) => setOemPartNumber(e.target.value)} placeholder="e.g. 17801-0T020"
                              className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition" />
                            <p className="text-[10px] text-gray-400 mt-1 uppercase">Helps buyers find exact matches</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* DYNAMIC PRODUCT SPECIFICATIONS */}
                  {specSchema.length > 0 && (
                    <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        Product Specifications
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Brand & Reference Product */}
                        {categoryBrands.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Brand</label>
                            <select value={form.brand} onChange={e => {
                               setForm(prev => ({ ...prev, brand: e.target.value, reference_product: '' }));
                            }} className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition">
                              <option value="">Select Brand...</option>
                              {categoryBrands.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                            </select>
                          </div>
                        )}
                        {form.brand && referenceProducts.length > 0 && (
                          <div>
                            <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Match Reference Product</label>
                            <select value={form.reference_product} onChange={e => {
                               const refSlug = e.target.value;
                               const ref = referenceProducts.find(r => r.slug === refSlug);
                               setForm(prev => ({ 
                                 ...prev, 
                                 reference_product: refSlug,
                                 structured_specs: ref ? { ...prev.structured_specs, ...ref.specifications } : prev.structured_specs
                               }));
                            }} className="w-full p-2.5 text-sm border border-emerald-300 dark:border-emerald-700/50 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                              <option value="">(Optional) Select Exact Model...</option>
                              {referenceProducts.map(r => <option key={r.slug} value={r.slug}>{r.model_name} {r.variant_name}</option>)}
                            </select>
                            <p className="text-[10px] text-emerald-600/70 mt-1 uppercase">Auto-fills verified specifications</p>
                          </div>
                        )}
                        {/* Render Schema Fields */}
                        {specSchema.map((spec: any) => {
                          if (spec.key === 'brand') return null; // handled above
                          return (
                            <div key={spec.key}>
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                {spec.label} {spec.required && '*'}
                              </label>
                              {spec.type === 'select' && spec.options ? (
                                <select 
                                  required={spec.required}
                                  value={form.structured_specs[spec.key] || ''} 
                                  onChange={e => setForm(prev => ({ ...prev, structured_specs: { ...prev.structured_specs, [spec.key]: e.target.value } }))}
                                  className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none"
                                >
                                  <option value="">Select {spec.label}</option>
                                  {spec.options.map((opt: string) => <option key={opt} value={opt}>{opt}{spec.unit ? ` ${spec.unit}` : ''}</option>)}
                                </select>
                              ) : (
                                <input 
                                  type={spec.type === 'number' ? 'number' : 'text'} 
                                  required={spec.required}
                                  placeholder={`Enter ${spec.label}`}
                                  value={form.structured_specs[spec.key] || ''}
                                  onChange={e => setForm(prev => ({ ...prev, structured_specs: { ...prev.structured_specs, [spec.key]: e.target.value } }))}
                                  className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Price *</label>
                      <input name="price" value={form.price} onChange={handleChange} placeholder="0" type="number" required
                        className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Stock *</label>
                      <input name="stock" value={form.stock} onChange={handleChange} placeholder="0" type="number" required
                        className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Condition</label>
                      <select name="condition" value={form.condition} onChange={handleChange}
                        className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition">
                        <option value="New">New</option><option value="Used">Used</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Description *</label>
                    <textarea name="description" value={form.description} onChange={handleChange} placeholder="Describe your product..." required rows={3}
                      className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white resize-none focus:ring-2 focus:ring-brand-500 outline-none transition" />
                  </div>

                  {/* ─── ADVANCED OPTIONS ACCORDION ─── */}
                  <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between py-2.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      Advanced Options
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 pl-1 border-l-2 border-brand-500 dark:border-brand-500 ml-1">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pl-3">
                        <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">SKU</label>
                          <input name="sku" value={form.sku} onChange={handleChange} placeholder="Optional" className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none" /></div>
                        <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Buying Price</label>
                          <input name="buying_price" value={form.buying_price} onChange={handleChange} placeholder="Cost" type="number" className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none" /></div>
                        <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Sale Price</label>
                          <input name="sale_price" value={form.sale_price} onChange={handleChange} placeholder="Discount" type="number" className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pl-3">
                        <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Unit</label>
                          <select value={['piece','kg','ton','liter','box','dozen','pair','meter'].includes(form.unit_of_measure) ? form.unit_of_measure : 'custom'}
                            onChange={(e) => setForm({...form, unit_of_measure: e.target.value === 'custom' ? '' : e.target.value})}
                            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none">
                            <option value="piece">Piece(s)</option><option value="kg">Kg</option><option value="ton">Ton</option>
                            <option value="liter">Liter</option><option value="box">Box</option><option value="dozen">Dozen</option>
                            <option value="pair">Pair</option><option value="meter">Meter</option><option value="custom">Custom...</option>
                          </select>
                          {!['piece','kg','ton','liter','box','dozen','pair','meter'].includes(form.unit_of_measure) && (
                            <input type="text" name="unit_of_measure" value={form.unit_of_measure} onChange={handleChange} placeholder="e.g. gallon" required className="w-full mt-2 p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none" />
                          )}
                        </div>
                        <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Min Order Qty</label>
                          <input name="minimum_order_quantity" value={form.minimum_order_quantity} onChange={handleChange} placeholder="1" type="number" step="0.01"
                            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white outline-none" /></div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 pl-3">
                        <label className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer flex-1">
                          <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({...form, is_available: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Available</span>
                        </label>
                        <label className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer flex-1">
                          <input type="checkbox" checked={form.requires_quote} onChange={(e) => setForm({...form, requires_quote: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Requires Quote</span>
                        </label>
                      </div>
                      <div className="pl-3">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Volume Pricing</p>
                        {priceTiers.map((tier, idx) => (
                          <div key={idx} className="flex gap-2 mb-2 items-center">
                            <input type="number" step="0.01" placeholder="Min" required value={tier.min_quantity} onChange={e => { const t=[...priceTiers]; t[idx].min_quantity=e.target.value; setPriceTiers(t); }} className="w-1/3 p-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
                            <input type="number" step="0.01" placeholder="Max" value={tier.max_quantity||''} onChange={e => { const t=[...priceTiers]; t[idx].max_quantity=e.target.value; setPriceTiers(t); }} className="w-1/3 p-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
                            <input type="number" step="0.01" placeholder="Price" required value={tier.unit_price} onChange={e => { const t=[...priceTiers]; t[idx].unit_price=e.target.value; setPriceTiers(t); }} className="w-1/3 p-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
                            <button type="button" onClick={() => setPriceTiers(priceTiers.filter((_,i)=>i!==idx))} className="text-red-500 font-bold px-1.5 text-sm">✕</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setPriceTiers([...priceTiers,{min_quantity:'',max_quantity:'',unit_price:''}])} className="text-xs text-brand-500 font-bold">+ Add Tier</button>
                      </div>
                      <div className="pl-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Variations</p>
                          <div className="flex gap-2">
                            {showCustomColumnInput ? (
                              <div className="flex items-center gap-1.5">
                                <input autoFocus placeholder="e.g. Size" value={customColumnName} onChange={e => setCustomColumnName(e.target.value)}
                                  onKeyDown={e => { if (e.key==='Enter'&&customColumnName.trim()) { setVariationColumns([...variationColumns,customColumnName.trim()]); setNewVariants(prev=>prev.map(v=>({...v,fields:{...v.fields,[customColumnName.trim()]:''}})));setCustomColumnName('');setShowCustomColumnInput(false);} else if (e.key==='Escape') setShowCustomColumnInput(false); }}
                                  className="text-xs p-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white outline-none w-20" />
                                <button type="button" onClick={() => { if(customColumnName.trim()){setVariationColumns([...variationColumns,customColumnName.trim()]);setNewVariants(prev=>prev.map(v=>({...v,fields:{...v.fields,[customColumnName.trim()]:''}})));setCustomColumnName('');} setShowCustomColumnInput(false); }} className="text-[10px] font-bold text-white bg-brand-500 px-2 py-1 rounded">Add</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setShowCustomColumnInput(true)} className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex items-center gap-1"><Plus size={10}/> Column</button>
                            )}
                            <button type="button" onClick={() => setNewVariants([...newVariants,{fields:{},price_adj_sign:'+',price_adjustment:'0',stock:'0'}])} className="text-[10px] font-bold text-brand-500   px-2 py-1 rounded flex items-center gap-1"><Plus size={10}/> Option</button>
                          </div>
                        </div>
                        {variationColumns.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {variationColumns.map((col,idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                {col} <button type="button" onClick={()=>setVariationColumns(variationColumns.filter((_,i)=>i!==idx))} className="text-gray-400 hover:text-red-500 ml-0.5">✕</button>
                              </span>
                            ))}
                          </div>
                        )}
                        {newVariants.map((v,i) => (
                          <div key={i} className="p-3 mb-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex flex-wrap gap-2 items-end">
                              {variationColumns.map((col,colIdx) => (
                                <div key={colIdx} className="w-24 shrink-0">
                                  <label className="text-[9px] uppercase font-bold text-gray-400 block mb-0.5 truncate">{col}</label>
                                  <input placeholder="Value" value={v.fields?.[col]||''} onChange={e=>{const nv=[...newVariants];if(!nv[i].fields)nv[i].fields={};nv[i].fields[col]=e.target.value;setNewVariants(nv);}}
                                    className="w-full p-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white outline-none" />
                                </div>
                              ))}
                              <div className="w-16 shrink-0"><label className="text-[9px] uppercase font-bold text-gray-400 block mb-0.5">Stock</label>
                                <input placeholder="0" type="number" value={v.stock} onChange={e=>{const nv=[...newVariants];nv[i].stock=e.target.value;setNewVariants(nv);}} className="w-full p-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white outline-none" /></div>
                              <div className="w-24 shrink-0"><label className="text-[9px] uppercase font-bold text-gray-400 block mb-0.5">Price Adj.</label>
                                <div className="flex border border-gray-200 dark:border-gray-600 rounded overflow-hidden">
                                  <select value={v.price_adj_sign} onChange={e=>{const nv=[...newVariants];nv[i].price_adj_sign=e.target.value;setNewVariants(nv);}} className="bg-gray-100 dark:bg-gray-800 text-xs px-1 py-1.5 outline-none border-r border-gray-200 dark:border-gray-600 font-bold"><option value="+">+</option><option value="-">-</option></select>
                                  <input placeholder="0" type="number" value={v.price_adjustment} onChange={e=>{const nv=[...newVariants];nv[i].price_adjustment=e.target.value;setNewVariants(nv);}} className="w-full p-1.5 text-xs bg-transparent dark:text-white outline-none" />
                                </div>
                              </div>
                              <button type="button" onClick={()=>{const nv=[...newVariants];const removed=nv.splice(i,1)[0];setNewVariants(nv);if(removed.id)setDeletedVariantIds(prev=>[...prev,removed.id]);}}
                                className="text-red-500   rounded p-1 self-end mb-0.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2 Actions */}
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setWizardStep(1)}
                      className="py-2.5 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg> Back
                    </button>
                    <button type="submit" disabled={submitting || !canSubmit}
                      className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-500 disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition text-sm">
                      {editingId ? 'Update Product' : 'Create Product'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        );
      })()}

      {/* Products Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('no_products_yet', 'No products yet. Create your first listing!')}
        />
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product: any) => (
            <div key={product.id}
              className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 hover:shadow-sm transition">
              <SafeImage src={product.images?.[0]?.image || ''} alt={product.name} category={product.category_name}
                className="w-16 h-16 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900 dark:text-white truncate">{product.name}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    product.stock === 0 ? ' text-red-500' : 
                    product.stock <= 3 ? ' text-yellow-500' : 
                    ' text-green-500'
                  }`}>
                    {product.stock === 0 ? 'Out of Stock' : product.stock <= 3 ? 'Low Stock' : 'In Stock'}
                  </span>
                </div>
                <p className="text-sm text-brand-500 dark:text-brand-500 font-bold mb-1 flex items-center gap-2">
                  <span>TSh {parseInt(product.price).toLocaleString()}</span>
                  {product.buying_price && (
                    <span className="text-xs text-gray-500 font-normal ml-2">Cost: TSh {parseInt(product.buying_price).toLocaleString()}</span>
                  )}
                  {product.sku && (
                    <span className="text-[9px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded border dark:border-gray-600 ml-auto">SKU: {product.sku}</span>
                  )}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {editingStockId === product.id ? (
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        value={quickStockValue} 
                        onChange={(e) => setQuickStockValue(e.target.value)}
                        className="w-16 px-1.5 py-0.5 border rounded text-gray-900 dark:text-white dark:bg-gray-700" 
                        autoFocus
                      />
                      <button onClick={() => handleQuickStockUpdate(product.id)} className="text-green-500 hover:text-green-500 px-1 font-bold">✓</button>
                      <button onClick={() => setEditingStockId(null)} className="text-red-500 hover:text-red-500 px-1 font-bold">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span>Stock: {product.stock}</span>
                      <button 
                        onClick={() => { setEditingStockId(product.id); setQuickStockValue(String(product.stock)); }}
                        className="opacity-0 group-hover:opacity-100 text-brand-500 hover:text-brand-500 ml-1 transition"
                        title="Quick Edit Stock"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                      </button>
                    </div>
                  )}
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
                  className="px-3 py-1.5 text-xs text-center border border-brand-500 dark:border-brand-500 text-brand-500 dark:text-brand-500 rounded-lg   transition">
                  Variants
                </button>
                <button onClick={() => handleDelete(product.slug)}
                  className="px-3 py-1.5 text-xs text-center border border-red-500 text-red-500 rounded-lg   transition">
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

      {/* Print View */}
      <div className="hidden print:block font-sans text-black bg-white absolute top-0 left-0 w-full h-full min-h-screen z-[9999]">
        <ReportPrintHeader 
          title="Inventory Report" 
          user={user} 
        />
        
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 px-1 w-12 font-black">S/N</th>
              <th className="py-2 px-2 font-black">PRODUCT</th>
              <th className="py-2 px-2 font-black">SKU/CODE</th>
              <th className="py-2 px-2 font-black">CATEGORY</th>
              <th className="py-2 px-2 font-black text-right">COST (TSH)</th>
              <th className="py-2 px-2 font-black text-right">PRICE (TSH)</th>
              <th className="py-2 px-2 font-black text-right">STOCK</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => (
              <tr key={product.id} className="border-b border-gray-200">
                <td className="py-2 px-1 font-bold">{idx + 1}</td>
                <td className="py-2 px-2 font-bold">{product.name}</td>
                <td className="py-2 px-2">{product.sku || '-'}</td>
                <td className="py-2 px-2">{product.category_name || product.category || '-'}</td>
                <td className="py-2 px-2 text-right font-mono">{product.buying_price ? parseFloat(product.buying_price).toLocaleString() : '-'}</td>
                <td className="py-2 px-2 text-right font-mono">{parseFloat(product.price || 0).toLocaleString()}</td>
                <td className="py-2 px-2 text-right font-mono">{product.stock}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-black">
              <td colSpan={4} className="py-2 px-2 text-right">TOTAL INVENTORY VALUE:</td>
              <td colSpan={2} className="py-2 px-2 text-right font-mono">
                {products.reduce((acc, p) => acc + (parseFloat(p.price || 0) * (p.stock || 0)), 0).toLocaleString()} TZS
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="py-1 px-2 text-right">TOTAL ITEMS IN STOCK:</td>
              <td colSpan={2} className="py-1 px-2 text-right font-mono">
                {products.reduce((acc, p) => acc + parseInt(p.stock || 0), 0).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};


export default DashboardProducts;
