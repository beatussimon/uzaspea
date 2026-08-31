import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  Package, Plus, Printer, Image as ImageIcon, Camera, DollarSign, 
  CheckCircle2, Sliders, Trash2, ArrowRight, ArrowLeft, Check, Tag,
  Star, ChevronLeft, ChevronRight, Search, X, Megaphone
} from 'lucide-react';
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
import { ProductGridSkeleton } from '../../components/Skeleton';
import { useLocation, useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
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
  const INITIAL_FORM = { name: '', sku: '', description: '', price: '', buying_price: '', sale_price: '', stock: '', category: '', condition: 'New', is_available: true, is_draft: false, requires_quote: false, unit_of_measure: '', minimum_order_quantity: '1', brand: '', reference_product: '', structured_specs: {} as Record<string, any> };
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'drafts'>('all');
  
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
  const [hasCustomUnit, setHasCustomUnit] = useState(false);
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customSpecKeys, setCustomSpecKeys] = useState<Record<string, boolean>>({});
  const [customAttributes, setCustomAttributes] = useState<Array<{ key: string; label: string; value: string }>>([]);
  const [showAddAttr, setShowAddAttr] = useState(false);
  const [newAttrLabel, setNewAttrLabel] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  // Wizard state — must be at component top level (React Rules of Hooks)
  const [wizardStep, setWizardStep] = useState(1);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
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

  const [selectedRootCatId, setSelectedRootCatId] = useState<number | null>(null);

  // Flatten the nested category tree from the API into a flat list
  const flatCategories = useMemo(() => {
    const result: any[] = [];
    const traverse = (catList: any[], depth = 0, parentObj: any = null) => {
      for (const cat of catList) {
        result.push({ 
          id: cat.id, 
          name: depth > 0 ? `${'  › '.repeat(depth)}${cat.name}` : cat.name, 
          rawName: cat.name,
          slug: cat.slug, 
          depth, 
          parent: parentObj,
          hasChildren: Boolean(cat.children && cat.children.length > 0),
          children: cat.children || []
        });
        if (cat.children?.length) {
          traverse(cat.children, depth + 1, cat);
        }
      }
    };
    traverse(categories);
    return result;
  }, [categories]);

  const activeSelectedCat = useMemo(() => {
    return flatCategories.find(c => String(c.id) === String(form.category)) || null;
  }, [flatCategories, form.category]);

  const currentRootCat = useMemo(() => {
    if (selectedRootCatId) {
      return categories.find(c => c.id === selectedRootCatId) || null;
    }
    if (activeSelectedCat) {
      if (activeSelectedCat.depth === 0) {
        return categories.find(c => c.id === activeSelectedCat.id) || null;
      }
      for (const root of categories) {
        if (root.id === activeSelectedCat.id) return root;
        const checkKids = (kids: any[]): boolean => {
          for (const k of kids) {
            if (k.id === activeSelectedCat.id) return true;
            if (k.children?.length && checkKids(k.children)) return true;
          }
          return false;
        };
        if (root.children && checkKids(root.children)) {
          return root;
        }
      }
    }
    return null;
  }, [categories, selectedRootCatId, activeSelectedCat]);

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
        api.get(`/api/categories/${selectedCat.slug}/spec-schema/?for_seller=true`)
          .then(res => setSpecSchema(res.data))
          .catch(() => setSpecSchema([]));

        api.get(`/api/categories/${selectedCat.slug}/brands/?for_seller=true`)
          .then(res => {
            if (Array.isArray(res.data)) {
              setCategoryBrands(res.data);
            } else {
              setCategoryBrands([]);
            }
          })
          .catch(() => {
            setCategoryBrands([]);
          });
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
      api.get(`/api/reference-products/?category=${catSlug}&brand=${form.brand}`)
        .then(res => setReferenceProducts(res.data.results || res.data || []))
        .catch(() => setReferenceProducts([]));
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
    if (filterStatus === 'drafts') params.append('is_draft', 'true');
    else if (filterStatus === 'published') params.append('is_draft', 'false');
    
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
  }, [currentUser, searchQuery, filterCategory, filterCondition, filterStatus]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts(1, true);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, filterCategory, filterCondition, filterStatus, fetchProducts]);

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

  const handleSetCoverImage = (index: number) => {
    if (index <= 0 || index >= imagePreviews.length) return;
    const updated = [...imagePreviews];
    const [selected] = updated.splice(index, 1);
    updated.unshift(selected);
    setImagePreviews(updated);
    setImageFiles(updated.map(p => p.file));
    toast.success('Cover photo updated!');
  };

  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= imagePreviews.length) return;
    const updated = [...imagePreviews];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setImagePreviews(updated);
    setImageFiles(updated.map(p => p.file));
  };

  const handleSetExistingCoverImage = (index: number) => {
    if (index <= 0 || index >= existingImages.length) return;
    const updated = [...existingImages];
    const [selected] = updated.splice(index, 1);
    updated.unshift(selected);
    setExistingImages(updated);
    toast.success('Cover photo updated!');
  };

  const handleMoveExistingImage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= existingImages.length) return;
    const updated = [...existingImages];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setExistingImages(updated);
  };

  const handleRemoveExistingImage = (idToRemove: number) => {
    setExistingImages(prev => prev.filter(img => img.id !== idToRemove));
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
      is_draft: Boolean(product.is_draft),
      requires_quote: product.requires_quote || false,
      unit_of_measure: product.unit_of_measure || '',
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
    setHasCustomUnit(Boolean(product.unit_of_measure && product.unit_of_measure !== 'piece'));

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
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('my_products', 'My Products')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('manage_inventory_desc', 'Manage inventory, update pricing, bulk import items, and track listing statuses.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowBatchModal(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5"
          >
            <Package size={14} />
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
            size="sm"
            className="flex items-center gap-1.5 font-bold"
          >
            <Plus size={14} />
            {showForm ? 'Cancel' : t('add_new', 'Add New')}
          </Button>
          <button 
            onClick={() => window.print()}
            className="btn-ghost border border-surface-border dark:border-surface-dark-border px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 rounded-btn hover:bg-surface-muted dark:hover:bg-[#161616]"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </header>

      {/* Search and Filters */}
      {!showForm && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Status Pills */}
          <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {([
              { key: 'all' as const, label: t('all', 'All') },
              { key: 'published' as const, label: t('published', 'Published') },
              { key: 'drafts' as const, label: t('drafts', 'Drafts') },
            ]).map((tab) => {
              const isActive = filterStatus === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterStatus(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Box & Dropdowns */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 sm:justify-end">
            <div className="relative flex-1 sm:max-w-xs min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('search_products', 'Search by Name or SKU...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-8 py-1.5 text-xs w-full"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input py-1.5 text-xs w-auto min-w-[140px]"
            >
              <option value="">All Categories</option>
              {flatCategories.map((c: any) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
              className="input py-1.5 text-xs w-auto min-w-[110px]"
            >
              <option value="">Any Condition</option>
              <option value="New">New</option>
              <option value="Used">Used</option>
            </select>
          </div>
        </div>
      )}

      {/* Batch Upload Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#121212] rounded-card w-full max-w-md overflow-hidden shadow-2xl border border-surface-border dark:border-surface-dark-border">
            <div className="p-5 border-b border-surface-border dark:border-surface-dark-border flex justify-between items-center bg-surface-muted dark:bg-[#161616]">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="text-brand-500" size={18} />
                Batch Import Products
              </h3>
              <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <p className="text-gray-500 dark:text-gray-400">
                Upload a CSV file with your products. Ensure your CSV includes columns: Name, Description, Price, Stock, Category ID, SKU, and Condition.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setBatchFile(e.target.files ? e.target.files[0] : null)}
                className="input w-full py-2 text-xs file:mr-3 file:py-1 file:px-3 file:rounded-btn file:border-0 file:text-xs file:font-bold file:bg-brand-500 file:text-white hover:file:bg-brand-600"
              />
            </div>

            <div className="p-4 bg-surface-muted dark:bg-[#161616] border-t border-surface-border dark:border-surface-dark-border flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowBatchModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleBatchUpload} disabled={!batchFile || batchUploading}>
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

        const selectedCat = flatCategories.find(c => String(c.id) === String(form.category));
        const isAuto = Boolean(
          selectedCat && (() => {
            const s = (selectedCat.slug || '').toLowerCase();
            const rootS = (currentRootCat?.slug || '').toLowerCase();

            // 1. Explicit exclusions for non-automotive categories (prevent substring collision like 'care' matching 'car' or 'party' matching 'part')
            if (
              s.includes('skin') || s.includes('care') || s.includes('beauty') || 
              s.includes('health') || s.includes('cosmetic') || s.includes('fashion') ||
              s.includes('cloth') || s.includes('apparel') || s.includes('phone') ||
              s.includes('computer') || s.includes('laptop') || s.includes('tv') ||
              s.includes('estate') || s.includes('property') || s.includes('service') ||
              s.includes('furniture') || s.includes('food') || s.includes('grocery')
            ) {
              return false;
            }

            // 2. Root category is vehicles/automotive
            if (rootS === 'vehicles' || rootS === 'vehicles-automotive' || rootS.startsWith('vehicle')) {
              return true;
            }

            // 3. Strict prefix or exact matches
            const autoPrefixes = ['vehicles-', 'vehicle-', 'automotive-', 'cars-', 'trucks-', 'motorcycles-', 'auto-spare-', 'auto-parts-', 'tyres-'];
            if (autoPrefixes.some(p => s.startsWith(p))) {
              return true;
            }

            const exactAutoSlugs = [
              'vehicles', 'cars', 'trucks', 'motorcycles', 'motorcycles-scooters',
              'tricycles-tuktuks', 'vehicle-parts', 'vehicle-parts-accessories', 
              'tyres-rims-wheels', 'auto-parts', 'spare-parts', 'commercial-vehicles',
              'car-accessories', 'car-electronics'
            ];
            if (exactAutoSlugs.includes(s)) {
              return true;
            }

            // 4. Parent traversal
            let p = selectedCat.parent;
            while (p) {
              const pSlug = (p.slug || '').toLowerCase();
              if (pSlug === 'vehicles' || pSlug.startsWith('vehicle') || exactAutoSlugs.includes(pSlug)) {
                return true;
              }
              p = p.parent;
            }

            return false;
          })()
        );

        const canProceedStep1 = Boolean(form.category && form.name.trim());
        const canProceedStep2 = Boolean(imagePreviews.length > 0 || existingImages.length > 0 || editingId);
        const canProceedStep3 = Boolean(form.description.trim());
        const canProceedStep4 = Boolean(
          form.price !== '' && !isNaN(Number(form.price)) && Number(form.price) >= 0 &&
          form.stock !== '' && !isNaN(Number(form.stock)) && Number(form.stock) >= 0
        );
        const canSubmit = canProceedStep1 && canProceedStep2 && canProceedStep3 && canProceedStep4;

        const WIZARD_STEPS = [
          { id: 1, title: 'Category & Identity', shortTitle: 'Identity', icon: Tag, desc: 'Category, Title & Condition' },
          { id: 2, title: 'Photos & Media', shortTitle: 'Media', icon: ImageIcon, desc: 'Upload product imagery' },
          { id: 3, title: isAuto ? 'Vehicle, Brand & Fitment' : (categoryBrands.length > 0 || specSchema.length > 0 ? 'Brand & Specifications' : 'Specs & Details'), shortTitle: 'Specs', icon: Sliders, desc: 'Brand, Model & Specs' },
          { id: 4, title: 'Pricing & Inventory', shortTitle: 'Pricing', icon: DollarSign, desc: 'Price, Stock & Variants' },
          { id: 5, title: 'Review & Publish', shortTitle: 'Publish', icon: CheckCircle2, desc: 'Final review & launch' },
        ];

        // XHR submit with real progress & draft support
        const handleSubmitWithProgress = async (e?: React.FormEvent, asDraft: boolean = false) => {
          if (e) e.preventDefault();
          if (!asDraft && !canSubmit) { toast.error('Please fill in all required fields to publish'); return; }
          setSubmitting(true);
          setUploadProgress(0);
          setUploadStatus(asDraft ? 'Saving draft...' : 'Preparing upload...');
          try {
            const fd = new FormData();
            const productName = form.name.trim() || (asDraft ? 'Untitled Draft' : '');
            fd.append('name', productName);
            if (form.sku) fd.append('sku', form.sku);
            fd.append('description', form.description.trim() || (asDraft ? 'Draft description' : ''));
            fd.append('price', form.price !== '' ? form.price : (asDraft ? '0.00' : '0'));
            if (form.buying_price) fd.append('buying_price', form.buying_price);
            if (form.sale_price) fd.append('sale_price', form.sale_price);
            fd.append('stock', form.stock !== '' ? form.stock : (asDraft ? '0' : '0'));
            if (form.category) fd.append('category', form.category);
            
            // Append Vehicle Fitment data
            if (vehicleIds.length > 0) {
              vehicleIds.forEach(vid => fd.append('vehicle_ids', vid));
            }
            if (oemPartNumber) {
              fd.append('oem_part_number', oemPartNumber);
            }
            fd.append('condition', form.condition || 'New');
            fd.append('is_available', asDraft ? 'false' : String(form.is_available));
            fd.append('is_draft', asDraft ? 'true' : 'false');
            fd.append('requires_quote', String(form.requires_quote));
            fd.append('unit_of_measure', hasCustomUnit && form.unit_of_measure.trim() ? form.unit_of_measure.trim() : 'piece');
            fd.append('minimum_order_quantity', form.minimum_order_quantity || '1');
            if (fulfillRequestId) fd.append('fulfill_request_id', String(fulfillRequestId));
            if (priceTiers.length > 0) fd.append('price_tiers', JSON.stringify(priceTiers));
            
            if (form.brand) fd.append('brand', form.brand);
            if (form.reference_product) fd.append('reference_product', form.reference_product);
            if (form.structured_specs && typeof form.structured_specs === 'object' && Object.keys(form.structured_specs).length > 0) {
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
            toast.success(asDraft ? (editingId ? 'Draft updated!' : 'Draft saved!') : (editingId ? 'Product updated!' : 'Product published!'));

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

            setShowForm(false); setEditingId(null); setEditingProductId(null); setFulfillRequestId(null); setWizardStep(1);
            setHasCustomUnit(false);
            setForm(INITIAL_FORM);
            imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
            setImagePreviews([]); setImageFiles([]); setExistingImages([]); setNewVariants([]); setDeletedVariantIds([]); setPriceTiers([]);
            fetchProducts(1, true);
          } catch (error: any) {
            let errorMsg = 'Failed to save product';
            if (error?.detail) {
              errorMsg = error.detail;
            } else if (typeof error === 'object' && error !== null) {
              const entries = Object.entries(error)
                .filter(([k]) => k !== 'status' && k !== 'detail')
                .map(([field, msgs]) => {
                  const formattedField = field.replace(/_/g, ' ');
                  const formattedMsgs = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
                  return `${formattedField}: ${formattedMsgs}`;
                });
              if (entries.length > 0) errorMsg = entries.join(' | ');
            }
            toast.error(errorMsg);
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
          setShowForm(false); setEditingId(null); setEditingProductId(null); setWizardStep(1);
          setSelectedRootCatId(null);
          setHasCustomUnit(false);
          setForm(INITIAL_FORM);
          imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
          setImagePreviews([]); setImageFiles([]); setExistingImages([]); setNewVariants([]); setDeletedVariantIds([]);
        };

        return (
          <form onSubmit={handleSubmitWithProgress} className="card mb-6 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0A0A0A] rounded-xl shadow-sm overflow-hidden">

            {/* ─── UPLOAD PROGRESS OVERLAY ─── */}
            {submitting && uploadProgress !== null && (
              <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-brand-500/10 flex items-center justify-center">
                    {uploadProgress < 100 ? (
                      <svg className="w-6 h-6 text-brand-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    ) : (
                      <Check className="w-6 h-6 text-emerald-500" strokeWidth={3} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{uploadStatus}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{uploadProgress}%</p>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* ─── CLEAN SUBTLE STEPPER HEADER ─── */}
            <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                    {editingId ? 'Edit Product' : 'New Product Listing'}
                  </h3>
                  {selectedCat && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      • {selectedCat.name.replace(/^[\s›]+/, '')}
                    </span>
                  )}
                </div>

                {/* Subtle Step Navigation */}
                <div className="flex items-center gap-6 overflow-x-auto">
                  {WIZARD_STEPS.map((s) => {
                    const isActive = wizardStep === s.id;
                    const isCompleted = wizardStep > s.id;
                    const canClick = isCompleted || Boolean(editingId) || (s.id === 1) || (s.id === 2 && canProceedStep1) || (s.id === 3 && canProceedStep1 && canProceedStep2) || (s.id === 4 && canProceedStep1 && canProceedStep2 && canProceedStep3) || (s.id === 5 && canProceedStep1 && canProceedStep2 && canProceedStep3 && canProceedStep4);

                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!canClick}
                        onClick={() => { if (canClick) setWizardStep(s.id); }}
                        className={`text-xs transition-colors whitespace-nowrap pb-1 border-b-2 ${
                          isActive 
                            ? 'text-brand-500 font-semibold border-brand-500' 
                            : isCompleted 
                              ? 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white border-transparent cursor-pointer' 
                              : 'text-neutral-400 dark:text-neutral-600 border-transparent cursor-not-allowed'
                        }`}
                      >
                        {s.shortTitle}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* ═══ STEP 1: PROGRESSIVE CATEGORY & BASIC INFO ═══ */}
              {wizardStep === 1 && (
                <div className="space-y-5 max-w-3xl">
                  {/* Category & Subcategory Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Category */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Category <span className="text-brand-500">*</span>
                      </label>
                      <select
                        value={currentRootCat?.id || ''}
                        onChange={(e) => {
                          const rootId = Number(e.target.value);
                          setSelectedRootCatId(rootId || null);
                          const root = categories.find(c => c.id === rootId);
                          if (!root) {
                            setForm(prev => ({ ...prev, category: '', brand: '', reference_product: '' }));
                          } else if (!root.children || root.children.length === 0) {
                            setForm(prev => ({ ...prev, category: String(root.id), brand: '', reference_product: '' }));
                          } else {
                            setForm(prev => ({ ...prev, category: '', brand: '', reference_product: '' }));
                          }
                        }}
                        required
                        className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
                      >
                        <option value="">Select Category...</option>
                        {categories.map((root: any) => (
                          <option key={root.id} value={root.id}>
                            {root.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subcategory */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Subcategory <span className="text-brand-500">*</span>
                      </label>
                      <select
                        value={form.category}
                        disabled={!currentRootCat || !currentRootCat.children || currentRootCat.children.length === 0}
                        onChange={(e) => {
                          setForm(prev => ({ ...prev, category: e.target.value, brand: '', reference_product: '' }));
                        }}
                        required
                        className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {!currentRootCat 
                            ? 'Select Category first...' 
                            : currentRootCat.children?.length 
                              ? 'Select Subcategory...' 
                              : 'No subcategories'}
                        </option>
                        {currentRootCat?.children?.map((sub: any) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Product Title */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Product Title <span className="text-brand-500">*</span>
                      </label>
                      <span className="text-xs text-neutral-400">{form.name.length}/120</span>
                    </div>
                    <input 
                      name="name" 
                      value={form.name} 
                      onChange={handleChange} 
                      placeholder="e.g. Toyota RAV4 2018 White or MacBook Pro 14 M3 Pro 512GB" 
                      maxLength={120}
                      required 
                      className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors" 
                    />
                  </div>

                  {/* Condition & SKU Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Condition <span className="text-brand-500">*</span>
                      </label>
                      <select
                        name="condition"
                        value={form.condition}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
                      >
                        <option value="New">Brand New</option>
                        <option value="Like_New">Like New</option>
                        <option value="Refurbished">Refurbished</option>
                        <option value="Used">Used / Pre-owned</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        SKU (Optional)
                      </label>
                      <input 
                        name="sku" 
                        value={form.sku} 
                        onChange={handleChange} 
                        placeholder="e.g. PRD-001" 
                        className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors" 
                      />
                    </div>
                  </div>

                  {/* Step 1 Actions */}
                  <div className="flex items-center justify-between pt-5 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={cancelForm} 
                        className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button" 
                        disabled={submitting} 
                        onClick={(e) => handleSubmitWithProgress(e, true)}
                        className="px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition"
                      >
                        Save as Draft
                      </button>
                    </div>
                    <button 
                      type="button" 
                      disabled={!canProceedStep1} 
                      onClick={() => setWizardStep(2)}
                      className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition flex items-center gap-1.5"
                    >
                      Next: Photos <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ STEP 2: PHOTOS & MEDIA ═══ */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                      Product Photos <span className="text-brand-500">*</span>
                    </label>
                    <p className="text-xs text-neutral-500">Upload images for your listing. The first image will be used as the cover photo.</p>
                  </div>

                  {existingImages.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Current Images ({existingImages.length})</p>
                        <span className="text-[10px] text-neutral-400">First image is current cover</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                        {existingImages.map((img: any, idx: number) => (
                          <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 group bg-neutral-100 dark:bg-neutral-900">
                            <SafeImage src={img.image} alt="Product" category={selectedCat?.name || ''} className="w-full h-full object-cover" />
                            
                            {idx === 0 ? (
                              <span className="absolute top-1.5 left-1.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5 z-10">
                                <Star size={10} className="fill-black" /> Cover
                              </span>
                            ) : (
                              <button 
                                type="button" 
                                onClick={() => handleSetExistingCoverImage(idx)}
                                className="absolute top-1.5 left-1.5 bg-black/80 hover:bg-amber-500 hover:text-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shadow z-10"
                                title="Make this the cover photo"
                              >
                                <Star size={9} /> Set Cover
                              </button>
                            )}

                            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <div className="flex items-center gap-0.5 bg-black/80 backdrop-blur-sm rounded p-0.5">
                                <button 
                                  type="button" 
                                  disabled={idx === 0} 
                                  onClick={() => handleMoveExistingImage(idx, 'left')} 
                                  className="p-1 text-white hover:bg-white/20 disabled:opacity-30 rounded transition"
                                  title="Move Left"
                                >
                                  <ChevronLeft size={12} />
                                </button>
                                <button 
                                  type="button" 
                                  disabled={idx === existingImages.length - 1} 
                                  onClick={() => handleMoveExistingImage(idx, 'right')} 
                                  className="p-1 text-white hover:bg-white/20 disabled:opacity-30 rounded transition"
                                  title="Move Right"
                                >
                                  <ChevronRight size={12} />
                                </button>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveExistingImage(img.id)}
                                className="p-1 bg-black/80 hover:bg-red-600 text-white rounded transition" 
                                title="Remove photo"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dropzone */}
                  <div 
                    ref={dropRef} 
                    onDragOver={handleDragOver} 
                    onDragLeave={handleDragLeave} 
                    onDrop={handleDrop}
                    className={`rounded-xl border-2 border-dashed transition-all ${
                      dragOver 
                        ? 'border-brand-500 bg-brand-500/5' 
                        : 'border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#0d0d0d] hover:border-neutral-400 dark:hover:border-neutral-700'
                    } ${imagePreviews.length > 0 ? 'p-4' : 'p-8 text-center'}`}
                  >
                    {imagePreviews.length === 0 ? (
                      <div className="max-w-xs mx-auto space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                          <Camera size={22} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">Drag photos here or browse</p>
                          <p className="text-xs text-neutral-500 mt-0.5">Supports PNG, JPG, WebP</p>
                        </div>
                        <ImagePickerButton label="Choose Photos" multiple onChange={handleImageChange} />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                            {imagePreviews.length} photo{imagePreviews.length !== 1 ? 's' : ''} selected
                          </p>
                          <p className="text-[11px] text-neutral-500">First image is the main Cover Photo. Click &quot;Set Cover&quot; or use arrows to reorder.</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                          {imagePreviews.map((p, idx) => (
                            <div key={p.url} className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 group bg-neutral-100 dark:bg-neutral-900">
                              <img src={p.url} alt="Preview" className="w-full h-full object-cover" />
                              
                              {idx === 0 ? (
                                <span className="absolute top-1.5 left-1.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5 z-10">
                                  <Star size={10} className="fill-black" /> Cover Photo
                                </span>
                              ) : (
                                <button 
                                  type="button" 
                                  onClick={() => handleSetCoverImage(idx)}
                                  className="absolute top-1.5 left-1.5 bg-black/80 hover:bg-amber-500 hover:text-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shadow z-10"
                                  title="Set as cover photo"
                                >
                                  <Star size={9} /> Set Cover
                                </button>
                              )}

                              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <div className="flex items-center gap-0.5 bg-black/80 backdrop-blur-sm rounded p-0.5">
                                  <button 
                                    type="button" 
                                    disabled={idx === 0} 
                                    onClick={() => handleMoveImage(idx, 'left')} 
                                    className="p-1 text-white hover:bg-white/20 disabled:opacity-30 rounded transition"
                                    title="Move Left"
                                  >
                                    <ChevronLeft size={12} />
                                  </button>
                                  <button 
                                    type="button" 
                                    disabled={idx === imagePreviews.length - 1} 
                                    onClick={() => handleMoveImage(idx, 'right')} 
                                    className="p-1 text-white hover:bg-white/20 disabled:opacity-30 rounded transition"
                                    title="Move Right"
                                  >
                                    <ChevronRight size={12} />
                                  </button>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveImage(idx)}
                                  className="p-1 bg-black/80 hover:bg-red-600 text-white rounded transition" 
                                  title="Remove photo"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
                          <ImagePickerButton label="Add More" compact multiple onChange={handleImageChange} />
                          <span className="text-xs text-neutral-500 font-medium">
                            {imagePreviews.length} photo{imagePreviews.length !== 1 ? 's' : ''} selected
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2 Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setWizardStep(1)} 
                        className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs transition flex items-center gap-1"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button 
                        type="button" 
                        disabled={submitting} 
                        onClick={(e) => handleSubmitWithProgress(e, true)}
                        className="px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition"
                      >
                        Save as Draft
                      </button>
                    </div>
                    <button 
                      type="button" 
                      disabled={!canProceedStep2} 
                      onClick={() => setWizardStep(3)}
                      className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-bold rounded-lg text-xs transition flex items-center gap-1.5"
                    >
                      Next: Specifications <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ STEP 3: SPECIFICATIONS & FITMENT ═══ */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  {/* Non-Auto: Brand & Model Catalog Selector */}
                  {!isAuto && (
                    <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111111] space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                          Brand & Model
                        </p>
                        {form.reference_product && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            Auto-fills Specifications
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                              Brand (Optional)
                            </label>
                            {categoryBrands.length > 0 && isCustomBrand && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomBrand(false);
                                  setForm(prev => ({ ...prev, brand: '', reference_product: '' }));
                                }}
                                className="text-[10px] text-brand-500 hover:underline font-semibold"
                              >
                                Pick from catalog list
                              </button>
                            )}
                          </div>
                          {categoryBrands.length > 0 && !isCustomBrand ? (
                            <select 
                              value={form.brand} 
                              onChange={e => {
                                const brandSlug = e.target.value;
                                if (brandSlug === '__custom__') {
                                  setIsCustomBrand(true);
                                  setForm(prev => ({ ...prev, brand: '', reference_product: '' }));
                                  return;
                                }
                                setForm(prev => {
                                  let updatedSpecs = { ...prev.structured_specs };
                                  const b = brandSlug.toLowerCase();
                                  const cat = (selectedCat?.slug || '').toLowerCase();
                                  
                                  // Smart auto-detection for OS & Processor ecosystem
                                  if (cat.includes('phone') || cat.includes('mobile')) {
                                    if (b.includes('apple')) {
                                      updatedSpecs.operating_system = 'iOS';
                                      updatedSpecs.processor_brand = 'Apple Silicon';
                                    } else if (b) {
                                      updatedSpecs.operating_system = 'Android';
                                      if (b.includes('google')) updatedSpecs.processor_brand = 'Google Tensor';
                                    }
                                  } else if (cat.includes('tablet')) {
                                    if (b.includes('apple')) {
                                      updatedSpecs.operating_system = 'iPadOS';
                                      updatedSpecs.processor_brand = 'Apple Silicon';
                                    } else if (b.includes('microsoft')) {
                                      updatedSpecs.operating_system = 'Windows 11';
                                    } else if (b) {
                                      updatedSpecs.operating_system = 'Android';
                                    }
                                  } else if (cat.includes('computer') || cat.includes('laptop') || cat.includes('desktop')) {
                                    if (b.includes('apple')) {
                                      updatedSpecs.operating_system = 'macOS';
                                      updatedSpecs.processor_brand = 'Apple Silicon';
                                    } else if (b && (!updatedSpecs.operating_system || updatedSpecs.operating_system === 'macOS')) {
                                      updatedSpecs.operating_system = 'Windows 11';
                                    }
                                  } else if (cat.includes('smartwatch') || cat.includes('wearable')) {
                                    if (b.includes('apple')) {
                                      updatedSpecs.operating_system = 'watchOS';
                                    } else if (b.includes('samsung')) {
                                      updatedSpecs.operating_system = 'Wear OS (Samsung One UI)';
                                    }
                                  }

                                  return {
                                    ...prev,
                                    brand: brandSlug,
                                    reference_product: '',
                                    structured_specs: updatedSpecs
                                  };
                                });
                              }} 
                              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500"
                            >
                              <option value="">Select Brand (Optional)...</option>
                              {categoryBrands.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                              <option value="__custom__">+ Enter Custom / Unlisted Brand...</option>
                            </select>
                          ) : (
                            <div className="space-y-1.5">
                              {categoryBrands.length > 0 && (
                                <span className="inline-block text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                                  Custom Brand (Will be added to catalog)
                                </span>
                              )}
                              <input 
                                type="text"
                                name="brand"
                                value={form.brand}
                                onChange={e => {
                                  const brandVal = e.target.value;
                                  setForm(prev => {
                                    let updatedSpecs = { ...prev.structured_specs };
                                    const b = brandVal.toLowerCase();
                                    const cat = (selectedCat?.slug || '').toLowerCase();
                                    if (cat.includes('phone') || cat.includes('mobile')) {
                                      if (b.includes('apple')) {
                                        updatedSpecs.operating_system = 'iOS';
                                        updatedSpecs.processor_brand = 'Apple Silicon';
                                      } else if (b) {
                                        updatedSpecs.operating_system = 'Android';
                                      }
                                    }
                                    return { ...prev, brand: brandVal, structured_specs: updatedSpecs };
                                  });
                                }}
                                placeholder="e.g. CeraVe, Garnier, The Ordinary, Generic..."
                                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500"
                              />
                            </div>
                          )}
                        </div>

                        {form.brand && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                                Model / Series Catalog
                              </label>
                              {referenceProducts.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCustomModel(!isCustomModel);
                                    setForm(prev => ({ ...prev, reference_product: '' }));
                                  }}
                                  className="text-[10px] font-bold text-brand-500 hover:underline"
                                >
                                  {isCustomModel ? 'Pick from catalog' : '+ Enter Custom Model'}
                                </button>
                              )}
                            </div>

                            {referenceProducts.length > 0 && !isCustomModel ? (
                              <select 
                                value={form.reference_product} 
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val === '__custom__') {
                                    setIsCustomModel(true);
                                    setForm(prev => ({ ...prev, reference_product: '' }));
                                    return;
                                  }
                                  const ref = referenceProducts.find(r => r.slug === val);
                                  setForm(prev => {
                                    const updatedSpecs = ref && ref.structured_specs ? { ...prev.structured_specs, ...ref.structured_specs } : prev.structured_specs;
                                    const brandObj = categoryBrands.find(b => b.slug === form.brand);
                                    const brandPrefix = brandObj?.name || ref?.brand_name || '';
                                    const autoTitle = ref && (!prev.name.trim() || prev.name === 'Untitled' || prev.name === 'Untitled Draft')
                                      ? `${brandPrefix ? brandPrefix + ' ' : ''}${ref.name}`.trim()
                                      : prev.name;
                                    return {
                                      ...prev,
                                      reference_product: val,
                                      name: autoTitle || prev.name,
                                      structured_specs: updatedSpecs,
                                    };
                                  });
                                }} 
                                className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500"
                              >
                                <option value="">Select Model (Auto-fill specs)...</option>
                                {referenceProducts.map(r => (
                                  <option key={r.slug} value={r.slug}>
                                    {r.name}
                                  </option>
                                ))}
                                <option value="__custom__">+ Enter Custom / Unlisted Model...</option>
                              </select>
                            ) : (
                              <div className="space-y-1.5">
                                {referenceProducts.length > 0 && (
                                  <span className="inline-block text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                                    Custom Model (Will be registered to brand catalog)
                                  </span>
                                )}
                                <input 
                                  type="text"
                                  value={form.reference_product}
                                  onChange={e => {
                                    const modelVal = e.target.value;
                                    setForm(prev => {
                                      const brandObj = categoryBrands.find(b => b.slug === form.brand);
                                      const brandPrefix = brandObj?.name || '';
                                      const autoTitle = modelVal && (!prev.name.trim() || prev.name === 'Untitled' || prev.name === 'Untitled Draft')
                                        ? `${brandPrefix ? brandPrefix + ' ' : ''}${modelVal}`.trim()
                                        : prev.name;
                                      return {
                                        ...prev,
                                        reference_product: modelVal,
                                        name: autoTitle || prev.name,
                                      };
                                    });
                                  }}
                                  placeholder="e.g. Galaxy S25 Ultra, Latitude 5450, Pavilion 15, iPhone 16 Pro..."
                                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Vehicle Fitment if Auto */}
                  {isAuto && (
                    <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111111] space-y-3">
                      <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        Vehicle Fitment (Optional)
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                            Compatible Vehicle
                          </label>
                          <VehicleSelector 
                            mode="manage"
                            onVehicleSelect={(v) => {
                              if (v && !vehicleIds.includes(v)) setVehicleIds([...vehicleIds, v]);
                            }} 
                          />
                          {vehicleIds.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {vehicleIds.map(vid => (
                                <span key={vid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-semibold">
                                  ID: {vid}
                                  <button type="button" onClick={() => setVehicleIds(vehicleIds.filter(id => id !== vid))} className="hover:text-red-500 ml-1">&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                            OEM Part Number
                          </label>
                          <input 
                            type="text" 
                            value={oemPartNumber} 
                            onChange={(e) => setOemPartNumber(e.target.value)} 
                            placeholder="e.g. 04465-42180"
                            className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500" 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Schema Specs */}
                  {specSchema.length > 0 && (
                    <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111111] space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                          Technical Specifications
                        </p>
                        {form.reference_product && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            Verified Master Data
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {specSchema.map((spec: any) => {
                          if (spec.key === 'brand') return null;
                          return (
                            <div key={spec.key}>
                              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                                {spec.label} {spec.required && <span className="text-brand-500">*</span>}
                              </label>
                              {spec.type === 'select' && spec.options ? (
                                customSpecKeys[spec.key] ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-bold text-amber-500 uppercase">Custom Option</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCustomSpecKeys(prev => ({ ...prev, [spec.key]: false }));
                                          setForm(prev => ({
                                            ...prev,
                                            structured_specs: { ...prev.structured_specs, [spec.key]: '' }
                                          }));
                                        }}
                                        className="text-[9px] text-brand-500 hover:underline font-semibold"
                                      >
                                        Pick list
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      placeholder={`Enter custom ${spec.label}`}
                                      value={form.structured_specs[spec.key] || ''}
                                      onChange={e => setForm(prev => ({ ...prev, structured_specs: { ...prev.structured_specs, [spec.key]: e.target.value } }))}
                                      className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500"
                                    />
                                  </div>
                                ) : (
                                  <select 
                                    required={spec.required}
                                    value={form.structured_specs[spec.key] || ''} 
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val === '__custom__') {
                                        setCustomSpecKeys(prev => ({ ...prev, [spec.key]: true }));
                                        setForm(prev => ({ ...prev, structured_specs: { ...prev.structured_specs, [spec.key]: '' } }));
                                      } else {
                                        setForm(prev => ({ ...prev, structured_specs: { ...prev.structured_specs, [spec.key]: val } }));
                                      }
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500"
                                  >
                                    <option value="">Select {spec.label}...</option>
                                    {spec.options.map((opt: string) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                    <option value="__custom__">+ Other / Enter custom value...</option>
                                  </select>
                                )
                              ) : (
                                <div className="relative flex items-center">
                                  <input 
                                    type={spec.type === 'number' ? 'number' : 'text'} 
                                    required={spec.required}
                                    placeholder={`Enter ${spec.label}`}
                                    value={form.structured_specs[spec.key] || ''}
                                    onChange={e => setForm(prev => ({ ...prev, structured_specs: { ...prev.structured_specs, [spec.key]: e.target.value } }))}
                                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500"
                                  />
                                  {spec.unit && (
                                    <span className="absolute right-3 text-xs text-neutral-400 pointer-events-none">
                                      {spec.unit}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom Specifications & Attributes Block */}
                  <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111111] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                          Additional Specifications & Attributes (Optional)
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          Add custom attributes like Warranty, Material, Shade, Capacity, or any unique specification.
                        </p>
                      </div>
                      {!showAddAttr && (
                        <button
                          type="button"
                          onClick={() => setShowAddAttr(true)}
                          className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-700 font-bold text-xs rounded transition flex items-center gap-1"
                        >
                          <Plus size={12} /> Add Field
                        </button>
                      )}
                    </div>

                    {/* List of Custom Attributes */}
                    {customAttributes.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {customAttributes.map(attr => (
                          <div key={attr.key} className="relative p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161616]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-neutral-500 uppercase">{attr.label}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomAttributes(prev => prev.filter(a => a.key !== attr.key));
                                  setForm(prev => {
                                    const updated = { ...prev.structured_specs };
                                    delete updated[attr.key];
                                    return { ...prev, structured_specs: updated };
                                  });
                                }}
                                className="text-neutral-400 hover:text-red-500 text-xs font-bold"
                              >
                                &times;
                              </button>
                            </div>
                            <input
                              type="text"
                              value={form.structured_specs[attr.key] || attr.value}
                              onChange={e => {
                                const val = e.target.value;
                                setForm(prev => ({
                                  ...prev,
                                  structured_specs: { ...prev.structured_specs, [attr.key]: val }
                                }));
                              }}
                              className="w-full text-xs font-semibold text-neutral-900 dark:text-white bg-transparent outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Custom Attribute Form */}
                    {showAddAttr && (
                      <div className="p-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#161616] space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Attribute Name (e.g. Shade, Warranty, Fabric)"
                            value={newAttrLabel}
                            onChange={e => setNewAttrLabel(e.target.value)}
                            className="px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500"
                          />
                          <input
                            type="text"
                            placeholder="Value (e.g. #02 Golden Sand, 2 Years, 100% Cotton)"
                            value={newAttrValue}
                            onChange={e => setNewAttrValue(e.target.value)}
                            className="px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddAttr(false);
                              setNewAttrLabel('');
                              setNewAttrValue('');
                            }}
                            className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newAttrLabel.trim() || !newAttrValue.trim()) return;
                              const cleanKey = newAttrLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                              const cleanLabel = newAttrLabel.trim();
                              const cleanVal = newAttrValue.trim();
                              setCustomAttributes(prev => [...prev.filter(a => a.key !== cleanKey), { key: cleanKey, label: cleanLabel, value: cleanVal }]);
                              setForm(prev => ({
                                ...prev,
                                structured_specs: { ...prev.structured_specs, [cleanKey]: cleanVal }
                              }));
                              setNewAttrLabel('');
                              setNewAttrValue('');
                              setShowAddAttr(false);
                            }}
                            className="px-3 py-1 bg-brand-500 text-black font-bold text-xs rounded transition"
                          >
                            Add Specification
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                      Description <span className="text-brand-500">*</span>
                    </label>
                    <textarea 
                      name="description" 
                      value={form.description} 
                      onChange={handleChange} 
                      placeholder="Provide full description of the item, features, warranty, condition..."
                      required 
                      rows={5}
                      className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 resize-none outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" 
                    />
                  </div>

                  {/* Step 3 Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setWizardStep(2)} 
                        className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs transition flex items-center gap-1"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button 
                        type="button" 
                        disabled={submitting} 
                        onClick={(e) => handleSubmitWithProgress(e, true)}
                        className="px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition"
                      >
                        Save as Draft
                      </button>
                    </div>
                    <button 
                      type="button" 
                      disabled={!canProceedStep3} 
                      onClick={() => setWizardStep(4)}
                      className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-bold rounded-lg text-xs transition flex items-center gap-1.5"
                    >
                      Next: Pricing & Stock <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ STEP 4: PRICING & INVENTORY ═══ */}
              {wizardStep === 4 && (
                <div className="space-y-5">
                  {/* Prices */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                        Price (TZS) <span className="text-brand-500">*</span>
                      </label>
                      <input 
                        name="price" 
                        value={form.price} 
                        onChange={handleChange} 
                        placeholder="0" 
                        type="number" 
                        min="0"
                        required
                        className="w-full px-3.5 py-2 text-sm font-bold border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Sale Price (Optional)
                      </label>
                      <input 
                        name="sale_price" 
                        value={form.sale_price} 
                        onChange={handleChange} 
                        placeholder="0" 
                        type="number" 
                        min="0"
                        className="w-full px-3.5 py-2 text-sm font-bold border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Cost / Buying Price
                      </label>
                      <input 
                        name="buying_price" 
                        value={form.buying_price} 
                        onChange={handleChange} 
                        placeholder="0" 
                        type="number" 
                        min="0"
                        className="w-full px-3.5 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500" 
                      />
                    </div>
                  </div>

                  {/* Stock Quantity & MOQ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                        Stock Quantity <span className="text-brand-500">*</span>
                      </label>
                      <input 
                        name="stock" 
                        value={form.stock} 
                        onChange={handleChange} 
                        placeholder="0" 
                        type="number" 
                        min="0"
                        required
                        className="w-full px-3.5 py-2 text-sm font-bold border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                        Min Order Qty (MOQ)
                      </label>
                      <input 
                        name="minimum_order_quantity" 
                        value={form.minimum_order_quantity} 
                        onChange={handleChange} 
                        placeholder="1" 
                        type="number" 
                        min="1"
                        step="1"
                        className="w-full px-3.5 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500" 
                      />
                    </div>
                  </div>

                  {/* Optional Unit of Measure Checkbox & Expanding Section */}
                  <div className="pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700 dark:text-neutral-300 select-none">
                      <input 
                        type="checkbox" 
                        checked={hasCustomUnit} 
                        onChange={(e) => {
                          setHasCustomUnit(e.target.checked);
                          if (!e.target.checked) {
                            setForm(prev => ({ ...prev, unit_of_measure: '' }));
                          }
                        }} 
                        className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-neutral-300 dark:border-neutral-700" 
                      />
                      <span>Specify custom unit of measure (e.g. kg, liter, carton, pair)</span>
                    </label>

                    {hasCustomUnit && (
                      <div className="mt-3 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111111] space-y-2">
                        <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                          Select or Enter Unit
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <select 
                            value={['piece','kg','ton','liter','box','dozen','pair','meter'].includes(form.unit_of_measure) ? form.unit_of_measure : (form.unit_of_measure ? 'custom' : 'piece')}
                            onChange={(e) => setForm({...form, unit_of_measure: e.target.value === 'custom' ? 'custom' : e.target.value})}
                            className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-500"
                          >
                            <option value="piece">Piece(s)</option>
                            <option value="kg">Kilogram (kg)</option>
                            <option value="ton">Metric Ton</option>
                            <option value="liter">Liter(s)</option>
                            <option value="box">Box / Carton</option>
                            <option value="dozen">Dozen</option>
                            <option value="pair">Pair(s)</option>
                            <option value="meter">Meter(s)</option>
                            <option value="custom">Custom unit...</option>
                          </select>
                          {(!['piece','kg','ton','liter','box','dozen','pair','meter'].includes(form.unit_of_measure) || form.unit_of_measure === 'custom') && (
                            <input 
                              type="text" 
                              name="unit_of_measure" 
                              value={form.unit_of_measure === 'custom' ? '' : form.unit_of_measure} 
                              onChange={(e) => setForm({...form, unit_of_measure: e.target.value})} 
                              placeholder="e.g. Gallon, Pack, Bundle" 
                              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none" 
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Volume Tiers */}
                  <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111111] space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        Volume Pricing Tiers
                      </p>
                      <button 
                        type="button" 
                        onClick={() => setPriceTiers([...priceTiers, { min_quantity: '', max_quantity: '', unit_price: '' }])}
                        className="text-xs font-bold text-brand-500 hover:text-brand-400"
                      >
                        + Add Tier
                      </button>
                    </div>

                    {priceTiers.map((tier, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="number" 
                          step="1" 
                          placeholder="Min Qty" 
                          required 
                          value={tier.min_quantity} 
                          onChange={e => { const t=[...priceTiers]; t[idx].min_quantity=e.target.value; setPriceTiers(t); }} 
                          className="w-1/3 px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none" 
                        />
                        <input 
                          type="number" 
                          step="1" 
                          placeholder="Max Qty" 
                          value={tier.max_quantity || ''} 
                          onChange={e => { const t=[...priceTiers]; t[idx].max_quantity=e.target.value; setPriceTiers(t); }} 
                          className="w-1/3 px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none" 
                        />
                        <input 
                          type="number" 
                          placeholder="Unit Price (TZS)" 
                          required 
                          value={tier.unit_price} 
                          onChange={e => { const t=[...priceTiers]; t[idx].unit_price=e.target.value; setPriceTiers(t); }} 
                          className="w-1/3 px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none font-bold" 
                        />
                        <button 
                          type="button" 
                          onClick={() => setPriceTiers(priceTiers.filter((_, i) => i !== idx))} 
                          className="text-neutral-400 hover:text-red-500 font-bold px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Variations */}
                  <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111111] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        Product Variants
                      </p>
                      <div className="flex gap-2">
                        {showCustomColumnInput ? (
                          <div className="flex items-center gap-1">
                            <input 
                              autoFocus 
                              placeholder="e.g. Size" 
                              value={customColumnName} 
                              onChange={e => setCustomColumnName(e.target.value)}
                              onKeyDown={e => { 
                                if (e.key==='Enter'&&customColumnName.trim()) { 
                                  setVariationColumns([...variationColumns, customColumnName.trim()]); 
                                  setNewVariants(prev=>prev.map(v=>({...v,fields:{...v.fields,[customColumnName.trim()]:''}})));
                                  setCustomColumnName('');
                                  setShowCustomColumnInput(false);
                                } else if (e.key==='Escape') setShowCustomColumnInput(false); 
                              }}
                              className="text-xs px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 outline-none w-20" 
                            />
                            <button 
                              type="button" 
                              onClick={() => { 
                                if(customColumnName.trim()){
                                  setVariationColumns([...variationColumns, customColumnName.trim()]);
                                  setNewVariants(prev=>prev.map(v=>({...v,fields:{...v.fields,[customColumnName.trim()]:''}})));
                                  setCustomColumnName('');
                                } 
                                setShowCustomColumnInput(false); 
                              }} 
                              className="text-[10px] font-bold text-black bg-brand-500 px-2 py-1 rounded"
                            >
                              Add
                            </button>
                          </div>
                        ) : (
                          <button 
                            type="button" 
                            onClick={() => setShowCustomColumnInput(true)} 
                            className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                          >
                            + Add Attribute
                          </button>
                        )}
                        <button 
                          type="button" 
                          onClick={() => setNewVariants([...newVariants, { fields: {}, price_adj_sign: '+', price_adjustment: '0', stock: '0' }])} 
                          className="text-xs font-bold text-brand-500 hover:text-brand-400"
                        >
                          + Add Variant
                        </button>
                      </div>
                    </div>

                    {variationColumns.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {variationColumns.map((col, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">
                            {col} 
                            <button type="button" onClick={() => setVariationColumns(variationColumns.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500">✕</button>
                          </span>
                        ))}
                      </div>
                    )}

                    {newVariants.map((v, i) => (
                      <div key={i} className="p-2.5 bg-white dark:bg-[#161616] rounded-lg border border-neutral-200 dark:border-neutral-800">
                        <div className="flex flex-wrap gap-2 items-end">
                          {variationColumns.map((col, colIdx) => (
                            <div key={colIdx} className="w-24 shrink-0">
                              <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-0.5 truncate">{col}</label>
                              <input 
                                placeholder="Value" 
                                value={v.fields?.[col] || ''} 
                                onChange={e => {
                                  const nv = [...newVariants];
                                  if (!nv[i].fields) nv[i].fields = {};
                                  nv[i].fields[col] = e.target.value;
                                  setNewVariants(nv);
                                }}
                                className="w-full px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none" 
                              />
                            </div>
                          ))}
                          <div className="w-16 shrink-0">
                            <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-0.5">Stock</label>
                            <input 
                              placeholder="0" 
                              type="number" 
                              value={v.stock} 
                              onChange={e => { const nv = [...newVariants]; nv[i].stock = e.target.value; setNewVariants(nv); }} 
                              className="w-full px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 outline-none" 
                            />
                          </div>
                          <div className="w-24 shrink-0">
                            <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-0.5">Price Adj.</label>
                            <div className="flex border border-neutral-300 dark:border-neutral-700 rounded overflow-hidden">
                              <select 
                                value={v.price_adj_sign} 
                                onChange={e => { const nv = [...newVariants]; nv[i].price_adj_sign = e.target.value; setNewVariants(nv); }} 
                                className="bg-neutral-100 dark:bg-neutral-800 text-xs px-1 py-1 outline-none border-r border-neutral-300 dark:border-neutral-700 font-bold"
                              >
                                <option value="+">+</option><option value="-">-</option>
                              </select>
                              <input 
                                placeholder="0" 
                                type="number" 
                                value={v.price_adjustment} 
                                onChange={e => { const nv = [...newVariants]; nv[i].price_adjustment = e.target.value; setNewVariants(nv); }} 
                                className="w-full px-1.5 py-1 text-xs bg-transparent dark:text-white outline-none" 
                              />
                            </div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => {
                              const nv = [...newVariants];
                              const removed = nv.splice(i, 1)[0];
                              setNewVariants(nv);
                              if (removed.id) setDeletedVariantIds(prev => [...prev, removed.id]);
                            }}
                            className="text-neutral-400 hover:text-red-500 p-1 mb-0.5"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Step 4 Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setWizardStep(3)} 
                        className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs transition flex items-center gap-1"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button 
                        type="button" 
                        disabled={submitting} 
                        onClick={(e) => handleSubmitWithProgress(e, true)}
                        className="px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition"
                      >
                        Save as Draft
                      </button>
                    </div>
                    <button 
                      type="button" 
                      disabled={!canProceedStep4} 
                      onClick={() => setWizardStep(5)}
                      className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-bold rounded-lg text-xs transition flex items-center gap-1.5"
                    >
                      Next: Review <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ STEP 5: REVIEW & PUBLISH ═══ */}
              {wizardStep === 5 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Summary */}
                    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 space-y-3">
                      <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        Listing Summary
                      </p>

                      <div className="flex gap-3">
                        <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                          {imagePreviews.length > 0 ? (
                            <img src={imagePreviews[0].url} alt="Cover" className="w-full h-full object-cover" />
                          ) : existingImages.length > 0 ? (
                            <SafeImage src={existingImages[0].image} alt="Cover" category={selectedCat?.name || ''} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-500">
                              <ImageIcon size={24} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                            {form.name || 'Untitled Listing'}
                          </p>
                          <p className="text-xs font-bold text-brand-500">
                            {form.requires_quote ? 'Price on Request' : `TZS ${parseInt(form.sale_price || form.price || '0').toLocaleString()}`}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {form.stock} {form.unit_of_measure ? `${form.unit_of_measure}s ` : ''}in stock • {form.condition}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                        <p><span className="font-semibold text-neutral-700 dark:text-neutral-300">Category:</span> {selectedCat?.name.replace(/^[\s›]+/, '')}</p>
                        {form.brand && <p><span className="font-semibold text-neutral-700 dark:text-neutral-300">Brand:</span> {form.brand}</p>}
                        {form.reference_product && <p><span className="font-semibold text-neutral-700 dark:text-neutral-300">Model:</span> {form.reference_product}</p>}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-[#111111] rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={form.is_available} 
                          onChange={(e) => setForm({...form, is_available: e.target.checked})} 
                          className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500" 
                        />
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-white">Active Listing</p>
                          <p className="text-[11px] text-neutral-500">Product will be immediately discoverable in search.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-[#111111] rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={form.requires_quote} 
                          onChange={(e) => setForm({...form, requires_quote: e.target.checked})} 
                          className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500" 
                        />
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-white">Request for Quote (RFQ)</p>
                          <p className="text-[11px] text-neutral-500">Buyers must request a custom price quote.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Step 5 Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setWizardStep(4)} 
                        className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs transition flex items-center gap-1"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button 
                        type="button" 
                        disabled={submitting} 
                        onClick={(e) => handleSubmitWithProgress(e, true)}
                        className="px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition"
                      >
                        Save as Draft
                      </button>
                    </div>
                    <button 
                      type="submit" 
                      disabled={submitting || !canSubmit}
                      className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-extrabold rounded-lg text-sm transition shadow-sm"
                    >
                      {submitting ? 'Saving...' : editingId ? (form.is_draft ? 'Publish Listing' : 'Update Product') : 'Publish Product'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        );
      })()}

      {/* Products Table */}
      {loading && products.length === 0 ? (
        <ProductGridSkeleton count={4} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('no_products_yet', 'No products yet. Create your first listing!')}
        />
      ) : (
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-card transition-all">
              <Spinner size="md" />
            </div>
          )}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {products.map((product: any) => (
            <div
              key={product.id}
              className="card p-4 hover:shadow-xs transition flex flex-col sm:flex-row items-start sm:items-center gap-4"
            >
              <SafeImage
                src={product.images?.[0]?.image || ''}
                alt={product.name}
                category={product.category_name}
                className="w-16 h-16 rounded-xl object-cover shrink-0 bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white truncate max-w-[200px]">
                    {product.name}
                  </h4>
                  {product.is_draft ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 capitalize">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      Draft
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${
                        product.stock === 0
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                          : product.stock <= 3
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        product.stock === 0 ? 'bg-red-500' : product.stock <= 3 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      {product.stock === 0 ? 'Out of Stock' : product.stock <= 3 ? 'Low Stock' : 'In Stock'}
                    </span>
                  )}
                  {product.sku && (
                    <span className="text-3xs font-mono text-gray-400 ml-auto">
                      SKU: {product.sku}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    TSh {parseInt(product.price).toLocaleString()}
                  </span>
                  {product.buying_price && (
                    <span className="text-2xs text-gray-400 font-normal">
                      Cost: TSh {parseInt(product.buying_price).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-2xs text-gray-400">
                  {editingStockId === product.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={quickStockValue}
                        onChange={(e) => setQuickStockValue(e.target.value)}
                        className="input py-0.5 px-1.5 text-xs w-16"
                        autoFocus
                      />
                      <button onClick={() => handleQuickStockUpdate(product.id)} className="text-emerald-500 hover:text-emerald-600 px-1 font-bold">✓</button>
                      <button onClick={() => setEditingStockId(null)} className="text-red-500 hover:text-red-600 px-1 font-bold">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span>Stock: <strong className="text-gray-700 dark:text-gray-300">{product.stock}</strong></span>
                      <button
                        onClick={() => { setEditingStockId(product.id); setQuickStockValue(String(product.stock)); }}
                        className="opacity-0 group-hover:opacity-100 text-brand-500 hover:text-brand-600 ml-1 transition text-3xs font-bold"
                        title="Quick Edit Stock"
                      >
                        Edit
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

              <div className="flex sm:flex-col gap-1.5 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-border dark:border-surface-dark-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/dashboard/promotions?tab=sponsored&new=true&product=${product.id}`)}
                  className="flex-1 sm:flex-initial text-xs py-1 text-brand-600 dark:text-brand-400 border-brand-500/30 hover:bg-brand-500/10 font-bold flex items-center justify-center gap-1"
                  title="Boost / Sponsor this product"
                >
                  <Megaphone size={12} />
                  Boost
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(product)}
                  className="flex-1 sm:flex-initial text-xs py-1"
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVariantProductId(product.id.toString())}
                  className="flex-1 sm:flex-initial text-xs py-1 text-gray-700 dark:text-gray-300 border-surface-border dark:border-surface-dark-border"
                >
                  Variants
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(product.slug)}
                  className="flex-1 sm:flex-initial text-xs py-1 text-red-500 border-red-500/30 hover:bg-red-500/10"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-4" />}
        {loadingMore && <div className="text-center py-4 text-gray-500 text-sm">Loading more...</div>}
        </div>
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
