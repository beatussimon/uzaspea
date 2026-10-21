import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  Package, Plus, Printer, Image as ImageIcon, Camera, DollarSign, 
  CheckCircle2, Sliders, Trash2, ArrowRight, ArrowLeft, Check, Tag,
  ChevronLeft, ChevronRight, Search, X, Megaphone,
  ChevronDown
} from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { useDialog } from '../../components/ui/Dialogs';
import ProductVariantsModal from './ProductVariantsModal';
import { useTranslation } from 'react-i18next';
import VehicleSelector from '../../components/VehicleSelector';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ReportPrintHeader } from '../../components/print/ReportPrintHeader';
import { DashboardProductListSkeleton } from '../../components/Skeleton';
import { useLocation, useNavigate } from 'react-router-dom';
import { printElement } from '../../utils/printHelper';
import { invalidateProductCache } from '../../components/layout/CategoryBar';
import { useUserLocation } from '../../context/LocationContext';




const CATEGORY_VARIATION_DEFAULTS: Record<string, string[]> = {
  'electronics': ['Color', 'Storage Capacity'],
  'electronics-mobile-phones': ['Color', 'Storage Capacity', 'RAM'],
  'electronics-computers-laptops': ['Color', 'RAM', 'Storage Capacity'],
  'electronics-tvs-audio': ['Color', 'Screen Size'],
  'mens-fashion': ['Color', 'Size'],
  'mens-fashion-clothing': ['Color', 'Size', 'Material'],
  'mens-fashion-shoes': ['Color', 'Shoe Size'],
  'mens-fashion-watches': ['Dial Color', 'Strap Color'],
  'womens-fashion': ['Color', 'Size', 'Material'],
  'vehicles-cars': ['Color', 'Trim Level'],
  'vehicles-vehicle-parts-accessories': ['Placement', 'Compatibility'],
  'food-groceries': ['Weight / Pack Size'],
  'home-furniture': ['Finish / Color', 'Dimensions'],
};

// ============ Dashboard Products ============
const DashboardProducts: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showConfirm } = useDialog();
  const { location: globalLocation } = useUserLocation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [quickStockValue, setQuickStockValue] = useState<string>('');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [variantProductId, setVariantProductId] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);
  const shouldJumpToEditRef = useRef(false);

  const jumpToEdit = useCallback(() => {
    // Force instantaneous jumping by disabling any smooth scrolling temporarily
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBehavior = html.style.scrollBehavior;
    const prevBodyBehavior = body.style.scrollBehavior;

    html.style.scrollBehavior = 'auto';
    body.style.scrollBehavior = 'auto';

    const executeScroll = () => {
      const target = formRef.current || formTopRef.current;
      if (target) {
        const navHeight = window.innerWidth >= 768 ? 84 : 64;
        const rect = target.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = Math.max(0, rect.top + scrollTop - navHeight);
        window.scrollTo(0, targetY);
      } else {
        window.scrollTo(0, 0);
      }
    };

    // Immediate jump in the current event tick
    executeScroll();

    // Secondary jump right after React mounts and renders the form elements
    requestAnimationFrame(() => {
      executeScroll();
      setTimeout(() => {
        html.style.scrollBehavior = prevHtmlBehavior;
        body.style.scrollBehavior = prevBodyBehavior;
      }, 60);
    });
  }, []);

  useLayoutEffect(() => {
    if (shouldJumpToEditRef.current && showForm) {
      shouldJumpToEditRef.current = false;
      jumpToEdit();
    }
  }, [showForm, editingId, jumpToEdit]);
  const INITIAL_FORM = { 
    name: '', sku: '', description: '', price: '', buying_price: '', sale_price: '', stock: '', category: '', condition: 'New', 
    is_available: true, is_draft: false, pos_only: false, requires_quote: false, unit_of_measure: '', minimum_order_quantity: '1', brand: '', 
    reference_product: '', structured_specs: {} as Record<string, any>,
    has_a_plus_content: false,
    a_plus_content: {
      headline: 'From the manufacturer',
      company_logo: '',
      modules: [] as Array<any>
    }
  };
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'pos_only' | 'drafts'>('all');
  
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
  const [pickingPhotoVariantIndex, setPickingPhotoVariantIndex] = useState<number | null>(null);
  const [photoPickerAnchor, setPhotoPickerAnchor] = useState<{ top: number; left: number; bottom: number } | null>(null);
  const [deletedVariantIds, setDeletedVariantIds] = useState<number[]>([]);

  useEffect(() => {
    if (pickingPhotoVariantIndex === null) return;
    const handleClose = () => {
      setPickingPhotoVariantIndex(null);
      setPhotoPickerAnchor(null);
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [pickingPhotoVariantIndex]);
  const [showMatrixGenerator, setShowMatrixGenerator] = useState(false);
  const [matrixValues, setMatrixValues] = useState<Record<string, string>>({});
  const [matrixUnits, setMatrixUnits] = useState<Record<string, string>>({});
  const [matrixDefaultStock, setMatrixDefaultStock] = useState('4');
  const [matrixDefaultPriceAdj] = useState('0');
  const [bulkStockVal, setBulkStockVal] = useState('');
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
  const dropRef = React.useRef<HTMLLabelElement>(null);

  // A+ Content (From the Manufacturer) State & Helpers
  const [uploadingAPlusIndex, setUploadingAPlusIndex] = useState<number | 'logo' | null>(null);

  const handleAPlusImageUpload = async (file: File, target: number | 'logo') => {
    try {
      setUploadingAPlusIndex(target);
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/api/products/upload_content_image/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.url) {
        if (target === 'logo') {
          setForm(prev => ({
            ...prev,
            a_plus_content: { ...prev.a_plus_content, company_logo: res.data.url }
          }));
        } else {
          setForm(prev => {
            const newModules = [...(prev.a_plus_content?.modules || [])];
            if (newModules[target]) {
              newModules[target] = { ...newModules[target], image: res.data.url };
            }
            return {
              ...prev,
              a_plus_content: { ...prev.a_plus_content, modules: newModules }
            };
          });
        }
        toast.success('Content image uploaded!');
      }
    } catch {
      toast.error('Failed to upload content image');
    } finally {
      setUploadingAPlusIndex(null);
    }
  };

  const addAPlusModule = (type: 'hero_banner' | 'feature_right' | 'feature_left' | 'infographic' | 'claim_banner') => {
    const newMod: any = {
      id: 'mod_' + Date.now(),
      type,
      headline: type === 'hero_banner' ? 'Engineered for Performance' : type === 'claim_banner' ? 'Quality Guaranteed' : 'Key Feature Spotlight',
      body: type === 'claim_banner' ? 'Designed to meet or exceed original equipment standards.' : 'Describe the key technological advantages, craftsmanship, or manufacturing standards.',
      image: '',
      badge: type === 'claim_banner' ? '100% QUALITY ASSURED' : 'HIGHLIGHT',
    };
    setForm(prev => ({
      ...prev,
      a_plus_content: {
        ...prev.a_plus_content,
        modules: [...(prev.a_plus_content?.modules || []), newMod]
      }
    }));
  };

  const removeAPlusModule = (idx: number) => {
    setForm(prev => ({
      ...prev,
      a_plus_content: {
        ...prev.a_plus_content,
        modules: (prev.a_plus_content?.modules || []).filter((_, i) => i !== idx)
      }
    }));
  };

  const moveAPlusModule = (idx: number, direction: 'up' | 'down') => {
    setForm(prev => {
      const modules = [...(prev.a_plus_content?.modules || [])];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= modules.length) return prev;
      const temp = modules[idx];
      modules[idx] = modules[targetIdx];
      modules[targetIdx] = temp;
      return {
        ...prev,
        a_plus_content: { ...prev.a_plus_content, modules }
      };
    });
  };

  const updateAPlusModule = (idx: number, field: string, val: any) => {
    setForm(prev => {
      const modules = [...(prev.a_plus_content?.modules || [])];
      if (modules[idx]) {
        modules[idx] = { ...modules[idx], [field]: val };
      }
      return {
        ...prev,
        a_plus_content: { ...prev.a_plus_content, modules }
      };
    });
  };


  // Prefill from demand card conversion
  useEffect(() => {
    if (location.state && (location.state as any).convert_request) {
      const req = (location.state as any).convert_request;
      setForm(prev => ({
        ...prev,
        name: req.name || '',
        description: req.description || '',
        price: req.price ? String(req.price) : '',
        buying_price: req.buying_price ? String(req.buying_price) : '',
        category: req.category?.id ? String(req.category.id) : (req.category ? String(req.category) : ''),
        condition: req.condition || 'New',
        requires_quote: req.requires_quote || false,
      }));
      if (req.image) {
        setExistingImages([{ id: 'demand-cover', image: req.image }]);
      }
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
    else if (filterStatus === 'published') {
      params.append('is_draft', 'false');
      params.append('pos_only', 'false');
    } else if (filterStatus === 'pos_only') {
      params.append('pos_only', 'true');
    }
    
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
      const profLoc = (user as any)?.profile?.location || '';
      const profLat = (user as any)?.profile?.latitude ? String((user as any).profile.latitude) : '';
      const profLng = (user as any)?.profile?.longitude ? String((user as any).profile.longitude) : '';

      // Prioritize profile coordinates if available, else global app location coords
      const lat = profLat || (globalLocation.coords ? globalLocation.coords.lat.toFixed(6) : '');
      const lng = profLng || (globalLocation.coords ? globalLocation.coords.lng.toFixed(6) : '');
      const locName = profLoc || globalLocation.address || (globalLocation.city ? `${globalLocation.city}, Tanzania` : 'Dar es Salaam, Tanzania');

      setLocData({
        latitude: lat,
        longitude: lng,
        location_name: locName,
      });
      setLocStatus(`Location: ${locName}`);
    }
  }, [showForm, editingId, user, globalLocation]);

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
    setWizardStep(1);
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
      pos_only: Boolean(product.pos_only),
      requires_quote: product.requires_quote || false,
      unit_of_measure: product.unit_of_measure || '',
      minimum_order_quantity: product.minimum_order_quantity || '1',
      brand: product.brand_details?.slug || '',
      reference_product: product.reference_product_details?.slug || '',
      structured_specs: product.structured_specs || {},
      has_a_plus_content: Boolean(product.has_a_plus_content),
      a_plus_content: product.a_plus_content && typeof product.a_plus_content === 'object' && Object.keys(product.a_plus_content).length > 0
        ? product.a_plus_content
        : { headline: 'From the manufacturer', company_logo: '', modules: [] },
    });
    setPriceTiers(product.price_tiers || []);
    setEditingId(product.slug);
    setEditingProductId(product.id);
    setVehicleIds(product.vehicle_ids ? product.vehicle_ids.map(String) : []);
    setOemPartNumber(product.oem_part_number || '');
    setHasCustomUnit(Boolean(product.unit_of_measure && product.unit_of_measure !== 'piece'));
    setLocData({
      latitude: product.latitude ? String(product.latitude) : '',
      longitude: product.longitude ? String(product.longitude) : '',
      location_name: product.location_name || (user as any)?.profile?.location || 'Dar es Salaam, Tanzania',
    });

    setExistingImages(product.images || []);
    setNewVariants([]);
    setShowForm(true);
    shouldJumpToEditRef.current = true;
    jumpToEdit();

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
      invalidateProductCache(slug);
      toast.success('Product deleted');
      fetchProducts(1, true);
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const handleTogglePosOnly = async (product: any) => {
    const nextVal = !product.pos_only;
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, pos_only: nextVal } : p));
    try {
      await api.patch(`/api/products/${product.slug}/`, { pos_only: nextVal });
      invalidateProductCache(product.slug);
      toast.success(nextVal ? t('product_set_pos', 'Product set to POS') : t('product_set_public', 'Product is now Public'));
    } catch {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, pos_only: !nextVal } : p));
      toast.error(t('failed_update_visibility', 'Failed to update visibility'));
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

  const printInventoryRef = React.useRef<HTMLDivElement>(null);
  const printCustomerCatalogRef = React.useRef<HTMLDivElement>(null);
  const [isPrintingReport, setIsPrintingReport] = useState(false);
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState(false);
  const printDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printDropdownRef.current && !printDropdownRef.current.contains(e.target as Node)) {
        setIsPrintDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handlePrintReport = async (type: 'inventory' | 'customer') => {
    const targetRef = type === 'inventory' ? printInventoryRef.current : printCustomerCatalogRef.current;
    if (!targetRef) return;
    try {
      setIsPrintingReport(true);
      await printElement(targetRef, {
        pageTitle: type === 'inventory' ? `Inventory Report - SokoniMax` : `Product Catalog - SokoniMax`,
        pageStyle: `@page { size: A4 portrait; margin: 10mm 12mm; }`,
      });
    } catch (err) {
      console.error('Failed to print report:', err);
    } finally {
      setIsPrintingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Screen Interactive UI */}
      <div className="print:hidden space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('my_products', 'My Products')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {t('manage_inventory_desc', 'Manage inventory, update pricing, bulk import items, and track listing statuses.')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-btn bg-surface-muted dark:bg-[#161616] hover:bg-surface-muted/80 dark:hover:bg-[#202020] text-gray-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer transition border-0"
            >
              <Package size={14} />
              <span>Batch Import (CSV)</span>
            </button>
            <Button
              onClick={() => {
                const nextShow = !showForm;
                setShowForm(nextShow);
                setEditingId(null);
                setExistingImages([]);
                setNewVariants([]);
                setForm(INITIAL_FORM);
                if (nextShow) {
                  shouldJumpToEditRef.current = true;
                  jumpToEdit();
                }
              }}
              disabled={user?.tier === 'customer'}
              variant={showForm ? 'outline' : 'default'}
              size="sm"
              className="flex items-center gap-1.5 font-bold text-xs px-3 py-1.5 whitespace-nowrap shrink-0"
            >
              <Plus size={14} />
              {showForm ? 'Cancel' : t('add_new', 'Add New')}
            </Button>

            {/* Simple Print Dropdown */}
            <div className="relative" ref={printDropdownRef}>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPrintDropdownOpen(prev => !prev);
                }}
                disabled={isPrintingReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-btn bg-surface-muted dark:bg-[#161616] hover:bg-surface-muted/80 dark:hover:bg-[#202020] text-gray-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer transition disabled:opacity-50"
                title="Print options"
              >
                <Printer size={14} />
                <span>{isPrintingReport ? 'Printing...' : 'Print'}</span>
                <ChevronDown size={12} className={`text-gray-400 transition-transform ${isPrintDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPrintDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#181818] border-0 rounded-xl shadow-lg z-50 py-1 overflow-hidden animate-scale-in">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintDropdownOpen(false);
                      handlePrintReport('inventory');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-surface-muted dark:hover:bg-[#242424] text-xs font-semibold text-gray-800 dark:text-gray-200 transition"
                  >
                    Owner / Staff
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintDropdownOpen(false);
                      handlePrintReport('customer');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-surface-muted dark:hover:bg-[#242424] text-xs font-semibold text-gray-800 dark:text-gray-200 transition"
                  >
                    Customer Ready
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

      {/* Search and Filters */}
      {!showForm && (
        <div className="space-y-2 md:space-y-0 md:flex md:items-center md:justify-between md:gap-3 pt-1">
          {/* Mobile Row 1 / Desktop Left: Status Pills (+ Search on mobile) */}
          <div className="flex items-center gap-2 md:gap-1.5 shrink-0">
            {/* Status Pills */}
            <div data-horizontal-scroll="true" className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none shrink-0">
              {([
                { key: 'all' as const, label: t('all', 'All') },
                { key: 'published' as const, label: t('published', 'Published') },
                { key: 'pos_only' as const, label: t('pos', 'POS') },
                { key: 'drafts' as const, label: t('drafts', 'Drafts') },
              ]).map((tab) => {
                const isActive = filterStatus === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilterStatus(tab.key)}
                    className={`h-8 px-2.5 sm:px-3 rounded-full text-xs font-semibold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                        : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search Box on Mobile (hidden on desktop) */}
            <div className="relative flex-1 min-w-[130px] md:hidden">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={t('search_products', 'Search products...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-7 pr-6 text-xs font-semibold rounded-full bg-surface-muted dark:bg-[#161616] text-gray-900 dark:text-white placeholder:text-xs placeholder:font-semibold placeholder:text-gray-600 dark:placeholder:text-gray-400 border-0 outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-neutral-700 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Row 2 / Desktop Right: (Desktop: Search + Category + Condition; Mobile: Category + Condition) */}
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
            {/* Search Box on Desktop (hidden on mobile) */}
            <div className="relative hidden md:block w-48 lg:w-64">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={t('search_products', 'Search products...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-7 pr-6 text-xs font-semibold rounded-full bg-surface-muted dark:bg-[#161616] text-gray-900 dark:text-white placeholder:text-xs placeholder:font-semibold placeholder:text-gray-600 dark:placeholder:text-gray-400 border-0 outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-neutral-700 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="relative w-full md:w-auto md:min-w-[140px]">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full h-8 pl-3 pr-8 text-xs font-semibold rounded-full bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-0 outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-neutral-700 truncate cursor-pointer transition appearance-none"
              >
                <option value="">All Categories</option>
                {flatCategories.map((c: any) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative w-full md:w-auto md:min-w-[110px]">
              <select
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
                className="w-full h-8 pl-3 pr-8 text-xs font-semibold rounded-full bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-0 outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-neutral-700 truncate cursor-pointer transition appearance-none"
              >
                <option value="">Any Condition</option>
                <option value="New">New</option>
                <option value="Used">Used</option>
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* Batch Upload Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#121212] rounded-card w-full max-w-md overflow-hidden shadow-2xl border-0 p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Batch Import Products
              </h3>
              <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4 text-xs">
              <p className="text-gray-500 dark:text-gray-400">
                Upload a CSV file with your products. Ensure your CSV includes columns: Name, Description, Price, Stock, Category ID, SKU, and Condition.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setBatchFile(e.target.files ? e.target.files[0] : null)}
                className="w-full px-3 py-2 text-xs rounded-btn bg-surface-muted dark:bg-[#161616] text-gray-900 dark:text-white border-0 outline-none file:mr-3 file:py-1 file:px-3 file:rounded-btn file:border-0 file:text-xs file:font-bold file:bg-brand-500 file:text-white hover:file:bg-brand-600 cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-3.5 py-1.5 text-xs font-bold rounded-btn text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-0 transition cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <Button size="sm" onClick={handleBatchUpload} disabled={!batchFile || batchUploading}>
                {batchUploading ? 'Importing...' : 'Upload CSV'}
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PRODUCT FORM — MULTI-STEP WIZARD                         */}
      <div ref={formTopRef} className="scroll-mt-20 md:scroll-mt-24" />
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
          { id: 2, title: 'Photos & A+ Content', shortTitle: 'Media & A+', icon: ImageIcon, desc: 'Upload gallery photos & A+ brand storytelling' },
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
            const variantTotalStock = newVariants.length > 0
              ? newVariants.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0)
              : null;
            fd.append('stock', variantTotalStock !== null ? String(variantTotalStock) : (form.stock !== '' ? form.stock : (asDraft ? '0' : '0')));
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
            fd.append('pos_only', String(form.pos_only));
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
            fd.append('has_a_plus_content', String(form.has_a_plus_content));
            if (form.a_plus_content) {
              fd.append('a_plus_content', JSON.stringify(form.a_plus_content));
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
                if (nv.imageFile) {
                  vData.append('image', nv.imageFile);
                } else if (nv.existingImageUrl) {
                  vData.append('copy_from_image', nv.existingImageUrl);
                }
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

            if (editingId) invalidateProductCache(editingId);
            if (result?.slug) invalidateProductCache(result.slug);
            if (baseProductId) invalidateProductCache(baseProductId);

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
          setShowForm(false); setEditingId(null); setEditingProductId(null); setFulfillRequestId(null); setWizardStep(1);
          setSelectedRootCatId(null);
          setHasCustomUnit(false);
          setForm(INITIAL_FORM);
          imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
          setImagePreviews([]); setImageFiles([]); setExistingImages([]); setNewVariants([]); setDeletedVariantIds([]);
        };

        return (
          <form ref={formRef} onSubmit={handleSubmitWithProgress} className="mb-6 space-y-4 scroll-mt-20 md:scroll-mt-24">

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
            <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                    {editingId ? 'Edit Product' : 'New Product Listing'}
                  </h3>
                  {fulfillRequestId && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Fulfilling Demand #{fulfillRequestId}
                    </span>
                  )}
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

            {/* ═══ STEP 1: PROGRESSIVE CATEGORY & BASIC INFO ═══ */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                {/* Card 1: Category & Product Title */}
                <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-4">
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
                        className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
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
                        className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500 transition-colors" 
                    />
                  </div>
                </div>

                {/* Card 2: Condition, SKU & Actions */}
                <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-4">
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
                        className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
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
                        className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500 transition-colors" 
                      />
                    </div>
                  </div>

                  {/* Step 1 Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 pt-2">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={cancelForm} 
                        className="h-9 px-3.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button" 
                        disabled={submitting} 
                        onClick={(e) => handleSubmitWithProgress(e, true)}
                        className="h-9 px-3.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Save as Draft
                      </button>
                    </div>
                    <button 
                      type="button" 
                      disabled={!canProceedStep1} 
                      onClick={() => setWizardStep(2)}
                      className="h-9 px-4.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Next: Photos <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

              {/* ═══ STEP 2: PHOTOS & MEDIA ═══ */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  {/* Card 1: Product Photos Gallery */}
                  <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-3">
                    <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        {existingImages.length > 0 
                          ? `Current Images (${existingImages.length + imagePreviews.length})` 
                          : `Product Photos (${imagePreviews.length})`} <span className="text-brand-500">*</span>
                      </p>
                      <span className="text-[10px] text-neutral-400">
                        First image is current cover • Click or drag to add photos
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {/* Existing Product Images */}
                      {existingImages.map((img: any, idx: number) => (
                        <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden group bg-neutral-100 dark:bg-neutral-900">
                          <SafeImage src={img.image} alt="Product" category={selectedCat?.name || ''} className="w-full h-full object-cover" />
                          
                          {idx === 0 ? (
                            <span className="absolute top-1.5 left-1.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow z-10">
                              Cover
                            </span>
                          ) : (
                            <button 
                              type="button" 
                              onClick={() => handleSetExistingCoverImage(idx)}
                              className="absolute top-1.5 left-1.5 bg-black/80 hover:bg-amber-500 hover:text-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition opacity-0 group-hover:opacity-100 shadow z-10"
                              title="Make this the cover photo"
                            >
                              Set Cover
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

                      {/* Newly Added Image Previews */}
                      {imagePreviews.map((p, idx) => (
                        <div key={p.url} className="relative aspect-square rounded-xl overflow-hidden group bg-neutral-100 dark:bg-neutral-900 ring-1 ring-brand-500/30">
                          <img src={p.url} alt="Preview" className="w-full h-full object-cover" />
                          
                          {existingImages.length === 0 && idx === 0 ? (
                            <span className="absolute top-1.5 left-1.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow z-10">
                              Cover
                            </span>
                          ) : (
                            <button 
                              type="button" 
                              onClick={() => handleSetCoverImage(idx)}
                              className="absolute top-1.5 left-1.5 bg-black/80 hover:bg-amber-500 hover:text-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition opacity-0 group-hover:opacity-100 shadow z-10"
                              title="Set as cover photo"
                            >
                              Set Cover
                            </button>
                          )}

                          {existingImages.length > 0 && (
                            <span className="absolute top-1.5 right-1.5 bg-brand-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow z-10">
                              New
                            </span>
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

                      {/* Dropzone Image Container Tile */}
                      <label 
                        ref={dropRef} 
                        onDragOver={handleDragOver} 
                        onDragLeave={handleDragLeave} 
                        onDrop={handleDrop}
                        className={`relative aspect-square rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-3 text-center cursor-pointer group select-none ${
                          dragOver 
                            ? 'border-neutral-400 dark:border-neutral-500 bg-neutral-100/50 dark:bg-neutral-800/50 scale-[1.02]' 
                            : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-[#141414] hover:bg-neutral-100/60 dark:hover:bg-[#181818]'
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handleImageChange(e);
                            e.target.value = '';
                          }}
                        />
                        <div className="w-9 h-9 rounded-full bg-neutral-200/80 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400 group-hover:scale-105 transition shrink-0 mb-2">
                          <Camera size={18} />
                        </div>
                        <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 leading-tight px-1">
                          Drag photos here or click to browse
                        </p>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 line-clamp-1">
                          Supports PNG, JPG, WebP
                        </p>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Card 2: A+ Content & Actions */}
                <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-4">
                  {/* ─── A+ CONTENT ("FROM THE MANUFACTURER") BUILDER ─── */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                            A+ Content (From the Manufacturer)
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500">
                          Show rich visual storytelling, infographic banners, and feature highlights on your product page.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={form.has_a_plus_content}
                          onChange={(e) => setForm({ ...form, has_a_plus_content: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                      </label>
                    </div>

                    {form.has_a_plus_content && (
                      <div className="space-y-4 pt-1">
                        {/* Brand & Section Headline */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                              Section Title / Headline
                            </label>
                            <input
                              type="text"
                              value={form.a_plus_content?.headline ?? 'From the manufacturer'}
                              onChange={(e) => setForm({
                                ...form,
                                a_plus_content: { ...form.a_plus_content, headline: e.target.value }
                              })}
                              placeholder="e.g. From the manufacturer"
                              className="w-full text-xs px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                              Brand Logo (Optional URL or Upload)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={form.a_plus_content?.company_logo || ''}
                                onChange={(e) => setForm({
                                  ...form,
                                  a_plus_content: { ...form.a_plus_content, company_logo: e.target.value }
                                })}
                                placeholder="https://... or upload logo"
                                className="flex-1 text-xs px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none"
                              />
                              <label className="cursor-pointer px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0">
                                <Camera size={13} />
                                <span>{uploadingAPlusIndex === 'logo' ? '...' : 'Upload'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingAPlusIndex === 'logo'}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleAPlusImageUpload(f, 'logo');
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Modules List */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                              Story Modules ({(form.a_plus_content?.modules || []).length})
                            </p>
                            <span className="text-[11px] text-neutral-400">
                              Combine hero banners, feature spotlights & infographics
                            </span>
                          </div>

                          {(!form.a_plus_content?.modules || form.a_plus_content.modules.length === 0) ? (
                            <div className="text-center py-6 px-4 bg-neutral-100/50 dark:bg-neutral-800/40 rounded-xl">
                              <p className="text-xs text-neutral-500 mb-1">No A+ content modules added yet.</p>
                              <p className="text-[11px] text-neutral-400">Click a button below to add your first marketing storytelling module.</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {form.a_plus_content.modules.map((mod: any, idx: number) => (
                                <div key={mod.id || idx} className="p-3.5 rounded-xl bg-neutral-100/70 dark:bg-[#1c1c1c] space-y-3">
                                  <div className="flex items-center justify-between pb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold">
                                        #{idx + 1}
                                      </span>
                                      <span className="text-xs font-bold text-neutral-900 dark:text-white capitalize">
                                        {mod.type === 'hero_banner' && 'Hero Banner'}
                                        {mod.type === 'feature_right' && 'Feature Spotlight (Image Left)'}
                                        {mod.type === 'feature_left' && 'Feature Spotlight (Text Left)'}
                                        {mod.type === 'infographic' && 'Infographic Showcase'}
                                        {mod.type === 'claim_banner' && 'Brand Claim / Guarantee'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => moveAPlusModule(idx, 'up')}
                                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white disabled:opacity-30 text-xs"
                                        title="Move Up"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === form.a_plus_content.modules.length - 1}
                                        onClick={() => moveAPlusModule(idx, 'down')}
                                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white disabled:opacity-30 text-xs"
                                        title="Move Down"
                                      >
                                        ▼
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeAPlusModule(idx)}
                                        className="p-1 text-red-500 hover:text-red-700"
                                        title="Remove Module"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Module form fields depending on type */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {mod.type !== 'claim_banner' && (
                                      <div className="sm:col-span-2 space-y-1.5">
                                        <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                                          Image (Banner or Visual Graphic)
                                        </label>
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            value={mod.image || ''}
                                            onChange={(e) => updateAPlusModule(idx, 'image', e.target.value)}
                                            placeholder="Image URL (or click Upload)"
                                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none"
                                          />
                                          <label className="cursor-pointer px-2.5 py-1.5 bg-neutral-200/70 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-md text-xs font-semibold flex items-center gap-1 shrink-0">
                                            <Camera size={12} />
                                            <span>{uploadingAPlusIndex === idx ? 'Uploading...' : 'Upload'}</span>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              disabled={uploadingAPlusIndex === idx}
                                              onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleAPlusImageUpload(f, idx);
                                              }}
                                            />
                                          </label>
                                        </div>
                                        {mod.image && (
                                          <div className="mt-1 h-24 max-w-xs rounded overflow-hidden bg-black/10 relative">
                                            <img src={mod.image} alt="Preview" className="w-full h-full object-cover" />
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {mod.type !== 'infographic' && (
                                      <>
                                        <div>
                                          <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                                            Badge / Eyebrow (Optional)
                                          </label>
                                          <input
                                            type="text"
                                            value={mod.badge || ''}
                                            onChange={(e) => updateAPlusModule(idx, 'badge', e.target.value)}
                                            placeholder="e.g. ADVANCED SPECIFICATION"
                                            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                                            Headline
                                          </label>
                                          <input
                                            type="text"
                                            value={mod.headline || ''}
                                            onChange={(e) => updateAPlusModule(idx, 'headline', e.target.value)}
                                            placeholder="e.g. Precision Engineering"
                                            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none"
                                          />
                                        </div>
                                        <div className="sm:col-span-2">
                                          <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                                            Description / Body
                                          </label>
                                          <textarea
                                            rows={2}
                                            value={mod.body || ''}
                                            onChange={(e) => updateAPlusModule(idx, 'body', e.target.value)}
                                            placeholder="Provide descriptive details, engineering highlights, materials, or features..."
                                            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none"
                                          />
                                        </div>
                                      </>
                                    )}

                                    {mod.type === 'infographic' && (
                                      <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                                          Caption / Headline (Optional)
                                        </label>
                                        <input
                                          type="text"
                                          value={mod.headline || ''}
                                          onChange={(e) => updateAPlusModule(idx, 'headline', e.target.value)}
                                          placeholder="e.g. Exploded View & Component Architecture"
                                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Module Buttons */}
                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1">Add Module:</span>
                            <button
                              type="button"
                              onClick={() => addAPlusModule('hero_banner')}
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Plus size={12} /> Hero Banner
                            </button>
                            <button
                              type="button"
                              onClick={() => addAPlusModule('feature_right')}
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Plus size={12} /> Feature (Image Left)
                            </button>
                            <button
                              type="button"
                              onClick={() => addAPlusModule('feature_left')}
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Plus size={12} /> Feature (Image Right)
                            </button>
                            <button
                              type="button"
                              onClick={() => addAPlusModule('infographic')}
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Plus size={12} /> Infographic
                            </button>
                            <button
                              type="button"
                              onClick={() => addAPlusModule('claim_banner')}
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Plus size={12} /> Claim Banner
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2 Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 pt-4">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setWizardStep(1)} 
                        className="h-9 px-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button 
                        type="button" 
                        disabled={submitting} 
                        onClick={(e) => handleSubmitWithProgress(e, true)}
                        className="h-9 px-3.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Save as Draft
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId && (
                        <button 
                          type="button" 
                          disabled={submitting || !canSubmit} 
                          onClick={(e) => handleSubmitWithProgress(e, false)}
                          className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          title="Save and update listing immediately"
                        >
                          <Check size={14} /> {submitting ? 'Updating...' : 'Update Product'}
                        </button>
                      )}
                      <button 
                        type="button" 
                        disabled={!canProceedStep2} 
                        onClick={() => setWizardStep(3)}
                        className="h-9 px-4.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Next: Specifications <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* ═══ STEP 3: SPECIFICATIONS & FITMENT ═══ */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  {/* Card 1: Brand & Model Selection / Fitment */}
                  <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-4">
                    {/* Non-Auto: Brand & Model Catalog Selector */}
                    {!isAuto && (
                      <div className="space-y-3">
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
                              className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
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
                                className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
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
                                className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
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
                                  className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
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
                      <div className="space-y-3">
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
                              className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500 transition-colors" 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Technical Specifications, Custom Attributes, Description & Actions */}
                  <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-5">
                    {/* Schema Specs */}
                    {specSchema.length > 0 && (
                      <div className="space-y-3">
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
                                      className="w-full px-3.5 py-2 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500"
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
                                    className="w-full px-3.5 py-2 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-brand-500"
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
                                    className="w-full px-3.5 py-2 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500"
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
                  <div className="space-y-3">
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
                          <div key={attr.key} className="relative p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase">{attr.label}</span>
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
                      <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Attribute Name (e.g. Shade, Warranty, Fabric)"
                            value={newAttrLabel}
                            onChange={e => setNewAttrLabel(e.target.value)}
                            className="px-3 py-2 text-xs border-0 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500"
                          />
                          <input
                            type="text"
                            placeholder="Value (e.g. #02 Golden Sand, 2 Years, 100% Cotton)"
                            value={newAttrValue}
                            onChange={e => setNewAttrValue(e.target.value)}
                            className="px-3 py-2 text-xs border-0 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500"
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
                      className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 resize-none outline-none focus:ring-1 focus:ring-brand-500" 
                    />
                  </div>

                  {/* Step 3 Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 pt-4">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setWizardStep(2)} 
                        className="h-9 px-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button 
                        type="button" 
                        disabled={submitting} 
                        onClick={(e) => handleSubmitWithProgress(e, true)}
                        className="h-9 px-3.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Save as Draft
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId && (
                        <button 
                          type="button" 
                          disabled={submitting || !canSubmit} 
                          onClick={(e) => handleSubmitWithProgress(e, false)}
                          className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          title="Save and update listing immediately"
                        >
                          <Check size={14} /> {submitting ? 'Updating...' : 'Update Product'}
                        </button>
                      )}
                      <button 
                        type="button" 
                        disabled={!canProceedStep3} 
                        onClick={() => setWizardStep(4)}
                        className="h-9 px-4.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Next: Pricing & Stock <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* ═══ STEP 4: PRICING & INVENTORY ═══ */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  {/* Card 1: Pricing & Stock Inventory */}
                  <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-4">
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
                        className="w-full px-3.5 py-2.5 text-sm font-bold border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500" 
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
                        className="w-full px-3.5 py-2.5 text-sm font-bold border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500" 
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
                        className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500" 
                      />
                    </div>
                  </div>

                  {/* Stock Quantity & MOQ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Stock Quantity <span className="text-brand-500">*</span></span>
                        {newVariants.length > 0 && (
                          <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 lowercase">
                            (auto-calculated from variants)
                          </span>
                        )}
                      </label>
                      <input 
                        name="stock" 
                        value={newVariants.length > 0 ? newVariants.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0) : form.stock} 
                        onChange={handleChange} 
                        placeholder="0" 
                        type="number" 
                        min="0"
                        required
                        readOnly={newVariants.length > 0}
                        className={`w-full px-3.5 py-2.5 text-sm font-bold border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500 ${newVariants.length > 0 ? 'bg-neutral-200/50 dark:bg-neutral-800/50 cursor-not-allowed opacity-90' : ''}`} 
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
                        className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500" 
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
                      <div className="mt-3 p-3.5 rounded-xl bg-neutral-50 dark:bg-[#141414] space-y-2">
                        <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                          Select or Enter Unit
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <select 
                            value={['piece','kg','ton','liter','box','dozen','pair','meter'].includes(form.unit_of_measure) ? form.unit_of_measure : (form.unit_of_measure ? 'custom' : 'piece')}
                            onChange={(e) => setForm({...form, unit_of_measure: e.target.value === 'custom' ? 'custom' : e.target.value})}
                            className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-brand-500"
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
                              className="w-full px-3.5 py-2.5 text-sm border-0 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-brand-500" 
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Volume Tiers */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                        Volume Pricing Tiers
                      </p>
                      <button 
                        type="button" 
                        onClick={() => setPriceTiers([...priceTiers, { min_quantity: '', max_quantity: '', unit_price: '' }])}
                        className="text-xs font-bold text-brand-500 hover:text-brand-400 cursor-pointer"
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
                          className="w-1/3 px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none" 
                        />
                        <input 
                          type="number" 
                          step="1" 
                          placeholder="Max Qty" 
                          value={tier.max_quantity || ''} 
                          onChange={e => { const t=[...priceTiers]; t[idx].max_quantity=e.target.value; setPriceTiers(t); }} 
                          className="w-1/3 px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none" 
                        />
                        <input 
                          type="number" 
                          placeholder="Unit Price (TZS)" 
                          required 
                          value={tier.unit_price} 
                          onChange={e => { const t=[...priceTiers]; t[idx].unit_price=e.target.value; setPriceTiers(t); }} 
                          className="w-1/3 px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none font-bold" 
                        />
                        <button 
                          type="button" 
                          onClick={() => setPriceTiers(priceTiers.filter((_, i) => i !== idx))} 
                          className="text-neutral-400 hover:text-red-500 font-bold px-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 2: Product Variants, Matrix & Actions */}
                <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-4">
                  {/* Variations */}
                  <div className="space-y-3">
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
                              className="text-xs px-2.5 py-1.5 border-0 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none w-20 focus:ring-1 focus:ring-brand-500" 
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
                        {variationColumns.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowMatrixGenerator(!showMatrixGenerator)}
                            className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                          >
                            ⚡ Quick Matrix
                          </button>
                        )}
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

                    {/* Quick Matrix Generator Panel */}
                    {showMatrixGenerator && variationColumns.length > 0 && (
                      <div className="p-3.5 bg-neutral-100/80 dark:bg-[#1a1a1a] rounded-xl space-y-2.5 animate-fade-in text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-800 dark:text-neutral-200">
                            ⚡ Quick Matrix Generator
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowMatrixGenerator(false)}
                            className="text-neutral-400 hover:text-red-500 text-xs font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-[11px] text-neutral-500">
                          Type values separated by commas (e.g. <code>Red, Blue, Black</code> for Color, <code>50, 55, 65</code> with unit <code>"</code> for Screen Size). All combinations will be generated automatically.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {variationColumns.map(col => {
                            const cLower = col.toLowerCase();
                            const suggestedUnit = cLower.includes('screen') || cLower.includes('display') || cLower.includes('tv') || cLower.includes('inch')
                              ? '"'
                              : cLower.includes('storage') || cLower.includes('ram') || cLower.includes('memory')
                                ? 'GB'
                                : cLower.includes('voltage') || cLower.includes('power') || cLower.includes('volt')
                                  ? 'V'
                                  : cLower.includes('weight')
                                    ? 'kg'
                                    : '';

                            return (
                              <div key={col} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] uppercase font-bold text-neutral-500 block truncate">{col} Values</label>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-neutral-400 font-medium">Unit:</span>
                                    <input
                                      type="text"
                                      placeholder={suggestedUnit || 'None'}
                                      value={matrixUnits[col] !== undefined ? matrixUnits[col] : suggestedUnit}
                                      onChange={e => setMatrixUnits({ ...matrixUnits, [col]: e.target.value })}
                                      className="w-14 px-1.5 py-1 text-[10px] rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none text-center font-bold"
                                      title={'Optional dimension unit/suffix appended to each value (e.g. ", GB, V, kg)'}
                                    />
                                  </div>
                                </div>
                                <input
                                  placeholder={col.toLowerCase().includes('color') ? 'e.g. Red, Blue, Black' : 'e.g. 50, 55, 60'}
                                  value={matrixValues[col] || ''}
                                  onChange={e => setMatrixValues({ ...matrixValues, [col]: e.target.value })}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-neutral-500">Default Stock per variant:</span>
                            <input
                              type="number"
                              value={matrixDefaultStock}
                              onChange={e => setMatrixDefaultStock(e.target.value)}
                              className="w-14 px-1.5 py-0.5 text-xs border-0 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:ring-1 focus:ring-brand-500 outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const colsWithValues = variationColumns.map(col => {
                                const raw = matrixValues[col] || '';
                                const rawVals = raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
                                const cLower = col.toLowerCase();
                                const defaultUnit = cLower.includes('screen') || cLower.includes('display') || cLower.includes('tv') || cLower.includes('inch')
                                  ? '"'
                                  : cLower.includes('storage') || cLower.includes('ram') || cLower.includes('memory')
                                    ? 'GB'
                                    : cLower.includes('voltage') || cLower.includes('power') || cLower.includes('volt')
                                      ? 'V'
                                      : cLower.includes('weight')
                                        ? 'kg'
                                        : '';
                                const unit = (matrixUnits[col] !== undefined ? matrixUnits[col] : defaultUnit).trim();
                                
                                const vals = rawVals.map(val => {
                                  if (!unit) return val;
                                  const lowerVal = val.toLowerCase();
                                  const lowerUnit = unit.toLowerCase();
                                  // Prevent double-suffixing
                                  if (lowerVal.endsWith(lowerUnit) || (unit === '"' && (val.endsWith('"') || val.endsWith("''")))) {
                                    return val;
                                  }
                                  if (unit === '"' || unit === "''") {
                                    return `${val}"`;
                                  }
                                  return `${val}${unit}`;
                                });

                                return { col, vals };
                              }).filter(c => c.vals.length > 0);

                              if (colsWithValues.length === 0) {
                                toast.error('Enter at least one value for your attributes');
                                return;
                              }

                              let combinations: Record<string, string>[] = [{}];
                              for (const { col, vals } of colsWithValues) {
                                const next: Record<string, string>[] = [];
                                for (const combo of combinations) {
                                  for (const val of vals) {
                                    next.push({ ...combo, [col]: val });
                                  }
                                }
                                combinations = next;
                              }

                              const generated = combinations.map(combo => ({
                                fields: combo,
                                price_adj_sign: '+' as const,
                                price_adjustment: matrixDefaultPriceAdj || '0',
                                stock: matrixDefaultStock || '0',
                              }));

                              setNewVariants(generated);
                              toast.success(`Generated ${generated.length} variant combinations!`);
                              setShowMatrixGenerator(false);
                            }}
                            className="px-3 py-1 bg-brand-500 hover:bg-brand-400 text-black font-bold text-xs rounded transition cursor-pointer"
                          >
                            Generate All Combinations
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bulk Actions Toolbar */}
                    {newVariants.length > 2 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-neutral-100/80 dark:bg-[#1a1a1a] rounded-xl text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-neutral-500">Bulk Stock:</span>
                          <input
                            type="number"
                            placeholder="e.g. 4"
                            value={bulkStockVal}
                            onChange={e => setBulkStockVal(e.target.value)}
                            className="w-16 px-2 py-1 text-xs rounded-lg border-0 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:ring-1 focus:ring-brand-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!bulkStockVal) return;
                              setNewVariants(prev => prev.map(v => ({ ...v, stock: bulkStockVal })));
                              toast.success(`Set stock to ${bulkStockVal} across all variants`);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-neutral-200 dark:bg-neutral-800 hover:bg-brand-500 hover:text-black rounded-lg transition cursor-pointer"
                          >
                            Apply to All
                          </button>
                        </div>
                        <span className="text-[11px] text-neutral-400 font-medium">
                          {newVariants.length} variants total
                        </span>
                      </div>
                    )}

                    {newVariants.map((v, i) => (
                      <div key={i} className="p-3 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xs">
                        <div className="flex flex-wrap gap-2.5 items-end">
                          {/* Variant Photo Picker */}
                          <div className="shrink-0 flex flex-col items-center relative">
                            <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-0.5">Photo</label>
                            <div className="relative group">
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (pickingPhotoVariantIndex === i) {
                                    setPickingPhotoVariantIndex(null);
                                    setPhotoPickerAnchor(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setPhotoPickerAnchor({ top: rect.top, left: rect.left, bottom: rect.bottom });
                                    setPickingPhotoVariantIndex(i);
                                  }
                                }}
                                className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-brand-500 dark:hover:border-brand-400 flex items-center justify-center cursor-pointer overflow-hidden bg-neutral-100 dark:bg-neutral-800 transition-colors shrink-0"
                                title="Click to choose or upload variant photo"
                              >
                                {v.previewUrl || v.existingImageUrl ? (
                                  <img
                                    src={v.previewUrl || v.existingImageUrl}
                                    alt={`Variant ${i + 1}`}
                                    className="w-full h-full object-cover shrink-0"
                                  />
                                ) : (
                                  <Camera size={13} className="text-neutral-400 group-hover:text-brand-500 transition-colors" />
                                )}
                              </button>
                              {(v.previewUrl || v.existingImageUrl) && (
                                <button
                                  type="button"
                                  title="Remove photo"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nv = [...newVariants];
                                    delete nv[i].imageFile;
                                    delete nv[i].previewUrl;
                                    delete nv[i].existingImageUrl;
                                    setNewVariants(nv);
                                    if (pickingPhotoVariantIndex === i) {
                                      setPickingPhotoVariantIndex(null);
                                      setPhotoPickerAnchor(null);
                                    }
                                  }}
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
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
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none" 
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
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border-0 focus:ring-1 focus:ring-brand-500 outline-none" 
                            />
                          </div>
                          <div className="w-24 shrink-0">
                            <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-0.5">Price Adj.</label>
                            <div className="flex rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                              <select 
                                value={v.price_adj_sign} 
                                onChange={e => { const nv = [...newVariants]; nv[i].price_adj_sign = e.target.value; setNewVariants(nv); }} 
                                className="bg-neutral-200/80 dark:bg-neutral-700/80 text-xs px-1.5 py-1.5 outline-none font-bold border-0 text-neutral-800 dark:text-neutral-200"
                              >
                                <option value="+">+</option><option value="-">-</option>
                              </select>
                              <input 
                                placeholder="0" 
                                type="number" 
                                value={v.price_adjustment} 
                                onChange={e => { const nv = [...newVariants]; nv[i].price_adjustment = e.target.value; setNewVariants(nv); }} 
                                className="w-full px-2 py-1.5 text-xs bg-transparent text-neutral-900 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400 outline-none border-0" 
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
                            className="text-neutral-400 hover:text-red-500 p-1 mb-0.5 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ─── VARIANT PHOTO PICKER POPUP (Top-level stacking layer attached directly to body) ─── */}
                  {pickingPhotoVariantIndex !== null && photoPickerAnchor && newVariants[pickingPhotoVariantIndex] && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[9999] pointer-events-none">
                      {/* Transparent click-away layer */}
                      <div 
                        className="absolute inset-0 pointer-events-auto bg-transparent"
                        onClick={() => {
                          setPickingPhotoVariantIndex(null);
                          setPhotoPickerAnchor(null);
                        }}
                      />

                      {/* Anchored Pop Up */}
                      {(() => {
                        const i = pickingPhotoVariantIndex;
                        const v = newVariants[i];
                        const popupHeight = 280;
                        const spaceBelow = window.innerHeight - photoPickerAnchor.bottom;
                        const topPos = spaceBelow < popupHeight && photoPickerAnchor.top > popupHeight
                          ? photoPickerAnchor.top - popupHeight - 4
                          : photoPickerAnchor.bottom + 4;
                        const leftPos = Math.max(8, Math.min(window.innerWidth - 224, photoPickerAnchor.left));

                        return (
                          <div
                            style={{
                              position: 'fixed',
                              top: `${topPos}px`,
                              left: `${leftPos}px`,
                            }}
                            className="pointer-events-auto p-2.5 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-800 w-52 text-left animate-fade-in"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-2 pb-1 border-b border-neutral-100 dark:border-neutral-800">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">Variant Photo</span>
                              <button 
                                type="button" 
                                onClick={() => {
                                  setPickingPhotoVariantIndex(null);
                                  setPhotoPickerAnchor(null);
                                }} 
                                className="text-neutral-400 hover:text-red-500 text-xs font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Photos from Product (Step 1 uploads or existing product images) */}
                            {((imagePreviews && imagePreviews.length > 0) || (existingImages && existingImages.length > 0)) && (
                              <div className="mb-2">
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-1">From Product Photos:</span>
                                <div className="grid grid-cols-4 gap-1.5 max-h-24 overflow-y-auto">
                                  {imagePreviews.map((img, imgIdx) => (
                                    <button
                                      key={`prev-${imgIdx}`}
                                      type="button"
                                      onClick={() => {
                                        const nv = [...newVariants];
                                        nv[i].imageFile = img.file;
                                        nv[i].previewUrl = img.url;
                                        delete nv[i].existingImageUrl;
                                        setNewVariants(nv);
                                        setPickingPhotoVariantIndex(null);
                                        setPhotoPickerAnchor(null);
                                      }}
                                      className="w-10 h-10 rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:border-brand-500 p-0.5 cursor-pointer"
                                    >
                                      <img src={img.url} alt="" className="w-full h-full object-cover rounded-xs" />
                                    </button>
                                  ))}
                                  {existingImages.map((img, imgIdx) => (
                                    <button
                                      key={`exist-${img.id || imgIdx}`}
                                      type="button"
                                      onClick={() => {
                                        const nv = [...newVariants];
                                        nv[i].existingImageUrl = img.image;
                                        nv[i].previewUrl = img.image;
                                        delete nv[i].imageFile;
                                        setNewVariants(nv);
                                        setPickingPhotoVariantIndex(null);
                                        setPhotoPickerAnchor(null);
                                      }}
                                      className="w-10 h-10 rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:border-brand-500 p-0.5 cursor-pointer"
                                    >
                                      <img src={img.image} alt="" className="w-full h-full object-cover rounded-xs" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Upload from Device Button */}
                            <label className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[11px] font-bold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded cursor-pointer transition">
                              <Camera size={12} /> Upload from device
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const nv = [...newVariants];
                                    nv[i].imageFile = file;
                                    nv[i].previewUrl = URL.createObjectURL(file);
                                    setNewVariants(nv);
                                  }
                                  setPickingPhotoVariantIndex(null);
                                  setPhotoPickerAnchor(null);
                                }}
                              />
                            </label>

                            {/* Apply to all matching primary variants */}
                            {(() => {
                              const primaryCol = variationColumns.find(c => /color|finish|style/i.test(c)) || variationColumns[0];
                              const primaryVal = primaryCol ? v.fields?.[primaryCol] : null;
                              const matchingCount = primaryCol && primaryVal ? newVariants.filter(other => other.fields?.[primaryCol]?.toLowerCase() === primaryVal.toLowerCase()).length : 0;
                              if (!primaryVal || matchingCount <= 1) return null;
                              return (
                                <div className="mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800">
                                  <span className="text-[9.5px] text-neutral-400 block mb-1">Apply chosen photo to all "{primaryVal}" ({matchingCount}):</span>
                                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                    {imagePreviews.map((img, imgIdx) => (
                                      <button
                                        key={`batch-prev-${imgIdx}`}
                                        type="button"
                                        onClick={() => {
                                          setNewVariants(prev => prev.map(variant => {
                                            if (variant.fields?.[primaryCol]?.toLowerCase() === primaryVal.toLowerCase()) {
                                              return { ...variant, imageFile: img.file, previewUrl: img.url, existingImageUrl: undefined };
                                            }
                                            return variant;
                                          }));
                                          toast.success(`Applied photo to all ${matchingCount} "${primaryVal}" variants!`);
                                          setPickingPhotoVariantIndex(null);
                                          setPhotoPickerAnchor(null);
                                        }}
                                        className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-brand-500 hover:text-black font-semibold transition cursor-pointer"
                                      >
                                        Photo #{imgIdx + 1} → All {primaryVal}
                                      </button>
                                    ))}
                                    {existingImages.map((img, imgIdx) => (
                                      <button
                                        key={`batch-exist-${img.id || imgIdx}`}
                                        type="button"
                                        onClick={() => {
                                          setNewVariants(prev => prev.map(variant => {
                                            if (variant.fields?.[primaryCol]?.toLowerCase() === primaryVal.toLowerCase()) {
                                              return { ...variant, existingImageUrl: img.image, previewUrl: img.image, imageFile: undefined };
                                            }
                                            return variant;
                                          }));
                                          toast.success(`Applied photo to all ${matchingCount} "${primaryVal}" variants!`);
                                          setPickingPhotoVariantIndex(null);
                                          setPhotoPickerAnchor(null);
                                        }}
                                        className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-brand-500 hover:text-black font-semibold transition cursor-pointer"
                                      >
                                        Photo #{imgIdx + 1} → All {primaryVal}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>,
                    document.body
                  )}

                  {/* Step 4 Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 pt-4">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setWizardStep(3)} 
                        className="h-9 px-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button 
                        type="button" 
                        disabled={submitting} 
                        onClick={(e) => handleSubmitWithProgress(e, true)}
                        className="h-9 px-3.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Save as Draft
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId && (
                        <button 
                          type="button" 
                          disabled={submitting || !canSubmit} 
                          onClick={(e) => handleSubmitWithProgress(e, false)}
                          className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          title="Save and update listing immediately"
                        >
                          <Check size={14} /> {submitting ? 'Updating...' : 'Update Product'}
                        </button>
                      )}
                      <button 
                        type="button" 
                        disabled={!canProceedStep4} 
                        onClick={() => setWizardStep(5)}
                        className="h-9 px-4.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Next: Review <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* ═══ STEP 5: REVIEW & PUBLISH ═══ */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  {/* Card 1: Listing Summary */}
                  <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-4">
                    <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      Listing Summary
                    </p>

                    <div className="flex gap-4 items-center">
                      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-neutral-900">
                        {existingImages.length > 0 ? (
                          <SafeImage src={existingImages[0].image} alt="Cover" category={selectedCat?.name || ''} className="w-full h-full object-cover" />
                        ) : imagePreviews.length > 0 ? (
                          <img src={imagePreviews[0].url} alt="Cover" className="w-full h-full object-cover" />
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-neutral-600 dark:text-neutral-400">
                      <p><span className="font-semibold text-neutral-700 dark:text-neutral-300">Category:</span> {selectedCat?.name.replace(/^[\s›]+/, '')}</p>
                      {form.brand && <p><span className="font-semibold text-neutral-700 dark:text-neutral-300">Brand:</span> {form.brand}</p>}
                      {form.reference_product && <p><span className="font-semibold text-neutral-700 dark:text-neutral-300">Model:</span> {form.reference_product}</p>}
                      <p><span className="font-semibold text-neutral-700 dark:text-neutral-300">Location:</span> {locData.location_name || 'Dar es Salaam, Tanzania'}</p>
                    </div>
                  </div>

                  {/* Card 2: Visibility & Publishing Options */}
                  <div className="card !border-none bg-white dark:bg-[#111111] rounded-2xl shadow-sm p-6 space-y-4">
                    <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      Visibility & Publishing Options
                    </p>

                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3.5 bg-neutral-50 dark:bg-[#141414] hover:bg-neutral-100/80 dark:hover:bg-[#1a1a1a] rounded-xl cursor-pointer transition">
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

                      <label className="flex items-center gap-3 p-3.5 bg-neutral-50 dark:bg-[#141414] hover:bg-neutral-100/80 dark:hover:bg-[#1a1a1a] rounded-xl cursor-pointer transition">
                        <input 
                          type="checkbox" 
                          checked={form.pos_only} 
                          onChange={(e) => setForm({...form, pos_only: e.target.checked})} 
                          className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500" 
                        />
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <span>Point of Sale (POS) Only</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">In-Store</span>
                          </p>
                          <p className="text-[11px] text-neutral-500">Item will only be available on your in-store POS register and hidden from public marketplace listings and your profile store.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 bg-neutral-50 dark:bg-[#141414] hover:bg-neutral-100/80 dark:hover:bg-[#1a1a1a] rounded-xl cursor-pointer transition">
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

                      <label className="flex items-center gap-3 p-3.5 bg-neutral-50 dark:bg-[#141414] hover:bg-neutral-100/80 dark:hover:bg-[#1a1a1a] rounded-xl cursor-pointer transition">
                        <input 
                          type="checkbox" 
                          checked={form.has_a_plus_content} 
                          onChange={(e) => setForm({...form, has_a_plus_content: e.target.checked})} 
                          className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500" 
                        />
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-white">A+ Content (From the Manufacturer)</p>
                          <p className="text-[11px] text-neutral-500">
                            {form.has_a_plus_content 
                              ? `Enabled with ${(form.a_plus_content?.modules || []).length} module(s). Configurable in Step 2.` 
                              : 'Enhance your listing with rich visual storytelling and brand modules.'}
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Step 5 Actions */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 pt-2">
                      <div className="flex items-center gap-2">
                        <button 
                          type="button" 
                          onClick={() => setWizardStep(4)} 
                          className="h-9 px-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <ArrowLeft size={14} /> Back
                        </button>
                        <button 
                          type="button" 
                          disabled={submitting} 
                          onClick={(e) => handleSubmitWithProgress(e, true)}
                          className="h-9 px-3.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Save as Draft
                        </button>
                      </div>
                      <button 
                        type="submit" 
                        disabled={submitting || !canSubmit}
                        className="h-9 px-5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-black font-bold rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {submitting ? 'Saving...' : editingId ? (form.is_draft ? 'Publish Listing' : 'Update Product') : 'Publish Product'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </form>
        );
      })()}

      {/* Products Table */}
      {loading && products.length === 0 ? (
        <DashboardProductListSkeleton count={6} />
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
              className="card !border-none p-3 sm:p-4 hover:shadow-xs transition flex flex-row items-start gap-3 sm:gap-4"
            >
              <SafeImage
                src={product.images?.[0]?.image || ''}
                alt={product.name}
                category={product.category_name}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl object-cover shrink-0 bg-surface-muted dark:bg-[#161616]"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Row 1: Title & Stock status */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <h4 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white truncate" title={product.name}>
                      {product.name}
                    </h4>
                    {Boolean(product.has_a_plus_content) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        A+ Content
                      </span>
                    )}
                  </div>
                  {product.is_draft ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      Draft
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        product.stock === 0 ? 'bg-red-500' : product.stock <= 3 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      {product.stock === 0 ? 'Out of Stock' : product.stock <= 3 ? 'Low Stock' : 'In Stock'}
                    </span>
                  )}
                </div>

                {/* Row 2: Price, Cost, Stock & Quick Edit */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-baseline gap-1.5 truncate">
                    <span className="font-extrabold text-gray-900 dark:text-white">
                      TSh {parseInt(product.price).toLocaleString()}
                    </span>
                    {product.buying_price && (
                      <span className="text-[10px] text-gray-400 font-normal hidden xs:inline">
                        (Cost: {parseInt(product.buying_price).toLocaleString()})
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-400 shrink-0">
                    {editingStockId === product.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={quickStockValue}
                          onChange={(e) => setQuickStockValue(e.target.value)}
                          className="input py-0.5 px-1.5 text-xs w-14"
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
                          className="text-brand-500 hover:text-brand-600 ml-0.5 text-3xs font-bold"
                          title="Quick Edit Stock"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3: Action Buttons placed beside the image and details */}
                <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/promotions?tab=sponsored&new=true&product=${product.id}`, { state: { boostedProduct: product } })}
                    className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition inline-flex items-center gap-1 shrink-0"
                    title="Boost / Sponsor this product"
                  >
                    <Megaphone size={11} />
                    <span>Boost</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(product)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition shrink-0"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariantProductId(product.id.toString())}
                    className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition shrink-0"
                  >
                    Variants
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePosOnly(product)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition shrink-0 flex items-center gap-1 ${
                      product.pos_only
                        ? 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700'
                    }`}
                    title={product.pos_only ? "Currently POS. Click to make Public" : "Currently Public. Click to make POS"}
                  >
                    {product.pos_only ? '📟 POS' : '🌐 Public'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.slug)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-gray-100 dark:bg-neutral-800 hover:bg-red-500/15 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300 rounded-lg transition shrink-0 ml-auto"
                  >
                    Delete
                  </button>
                </div>
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
      </div>

      {/* Hidden Isolated Print Canvases (Processed via printElement) */}
      <div className="hidden">
        {/* 1. Internal Inventory Report Canvas */}
        <div ref={printInventoryRef} className="p-4 bg-white text-black font-sans w-full">
          <ReportPrintHeader 
            title="Internal Inventory Stock Report" 
            user={user} 
            logoUrl="/logo_dark.png"
          />
          
          <table className="w-full text-left text-xs border-collapse table-fixed mt-4">
            <thead>
              <tr className="border-b-2 border-black bg-gray-100/70 text-black">
                <th className="py-2 px-1.5 w-8 font-black">S/N</th>
                <th className="py-2 px-2 w-auto font-black">PRODUCT / VARIATION</th>
                <th className="py-2 px-2 w-24 font-black">SKU/CODE</th>
                <th className="py-2 px-2 w-24 font-black">CATEGORY</th>
                <th className="py-2 px-2 w-24 font-black text-right">COST (TSH)</th>
                <th className="py-2 px-2 w-24 font-black text-right">PRICE (TSH)</th>
                <th className="py-2 px-2 w-32 font-black">QTY TIERS</th>
                <th className="py-2 px-2 w-16 font-black text-right">STOCK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product, idx) => (
                <React.Fragment key={product.id}>
                  <tr style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }} className={product.variants && product.variants.length > 0 ? 'bg-gray-50/50' : ''}>
                    <td className="py-2 px-1.5 font-bold text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-2 font-bold text-black">{product.name}</td>
                    <td className="py-2 px-2 text-gray-600 font-mono text-[11px]">{product.sku || '-'}</td>
                    <td className="py-2 px-2 text-gray-600">{product.category_name || product.category || '-'}</td>
                    <td className="py-2 px-2 text-right font-mono">{product.buying_price ? parseFloat(product.buying_price).toLocaleString() : '-'}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-black">{parseFloat(product.price || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-[10px] text-gray-600">
                      {product.price_tiers && product.price_tiers.length > 0 
                        ? product.price_tiers.map((t: any) => `${parseInt(t.min_quantity)}+: ${parseFloat(t.unit_price).toLocaleString()}`).join(', ')
                        : '-'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-black">{product.stock}</td>
                  </tr>

                  {/* Variation Sub-Rows */}
                  {product.variants && product.variants.map((v: any, vIdx: number) => (
                    <tr key={`var-${v.id || vIdx}`} className="bg-gray-50/30 text-[11px]" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <td className="py-1 px-1.5"></td>
                      <td className="py-1 px-2 pl-5 text-gray-700">
                        ↳ <span className="font-semibold text-gray-900">{v.name}</span>
                      </td>
                      <td className="py-1 px-2 font-mono text-gray-500 text-[10px]">{v.sku || '-'}</td>
                      <td className="py-1 px-2 text-gray-400">—</td>
                      <td className="py-1 px-2 text-right text-gray-400">—</td>
                      <td className="py-1 px-2 text-right font-mono font-semibold text-gray-800">
                        {parseFloat(v.final_price || (parseFloat(product.price) + parseFloat(v.price_adjustment || 0))).toLocaleString()}
                      </td>
                      <td className="py-1 px-2 text-gray-400">—</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-700">{v.stock}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-black bg-gray-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <td colSpan={4} className="py-2.5 px-2 text-right text-xs uppercase">TOTAL INVENTORY VALUE:</td>
                <td colSpan={2} className="py-2.5 px-2 text-right font-mono text-sm font-black">
                  {products.reduce((acc, p) => acc + (parseFloat(p.price || 0) * (p.stock || 0)), 0).toLocaleString()} TZS
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr className="bg-gray-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <td colSpan={4} className="py-1.5 px-2 text-right text-xs uppercase">TOTAL ITEMS IN STOCK:</td>
                <td colSpan={2} className="py-1.5 px-2 text-right font-mono font-bold">
                  {products.reduce((acc, p) => acc + parseInt(p.stock || 0), 0).toLocaleString()}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 2. Customer Price List / Catalog Canvas (NO Sensitive Cost / Margins) */}
        <div ref={printCustomerCatalogRef} className="p-4 bg-white text-black font-sans w-full">
          <ReportPrintHeader 
            title="Product Catalog & Price List" 
            user={user} 
            logoUrl="/logo_dark.png"
            qrCodeUrl={`${typeof window !== 'undefined' ? window.location.origin : 'https://sokonimax.com'}/${user?.username || ''}`}
          />
          
          <table className="w-full text-left text-xs border-collapse table-fixed mt-3">
            <thead>
              <tr className="border-b-2 border-black bg-gray-100/80 text-black">
                <th className="py-2 px-1.5 w-8 font-black">S/N</th>
                <th className="py-2 px-2 w-auto font-black">PRODUCT / VARIATION</th>
                <th className="py-2 px-2 w-24 font-black">CODE / SKU</th>
                <th className="py-2 px-2 w-28 font-black">CATEGORY</th>
                <th className="py-2 px-2 w-28 font-black text-right">PRICE (TSH)</th>
                <th className="py-2 px-2 w-36 font-black">VOLUME / TIER PRICING</th>
                <th className="py-2 px-2 w-24 font-black text-center">AVAILABILITY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product, idx) => (
                <React.Fragment key={`cust-${product.id}`}>
                  <tr style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }} className={product.variants && product.variants.length > 0 ? 'bg-gray-50/50' : ''}>
                    <td className="py-2 px-1.5 font-bold text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-2 font-bold text-black">{product.name}</td>
                    <td className="py-2 px-2 text-gray-600 font-mono text-[11px]">{product.sku || '-'}</td>
                    <td className="py-2 px-2 text-gray-600">{product.category_name || product.category || '-'}</td>
                    <td className="py-2 px-2 text-right font-mono font-black text-black">
                      {parseFloat(product.price || 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-[10px] text-gray-700">
                      {product.price_tiers && product.price_tiers.length > 0 
                        ? product.price_tiers.map((t: any) => `${parseInt(t.min_quantity)}${t.max_quantity ? `-${parseInt(t.max_quantity)}` : '+'} pcs: ${parseFloat(t.unit_price).toLocaleString()}`).join(' | ')
                        : '-'}
                    </td>
                    <td className="py-2 px-2 text-center text-[11px]">
                      {product.stock > 0 ? (
                        <span className="font-bold text-emerald-700">In Stock</span>
                      ) : (
                        <span className="text-gray-500">On Request</span>
                      )}
                    </td>
                  </tr>

                  {/* Customer Variant Sub-Rows */}
                  {product.variants && product.variants.map((v: any, vIdx: number) => (
                    <tr key={`cust-var-${v.id || vIdx}`} className="bg-gray-50/30 text-[11px]" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <td className="py-1 px-1.5"></td>
                      <td className="py-1 px-2 pl-5 text-gray-700">
                        ↳ <span className="font-semibold text-gray-900">{v.name}</span>
                      </td>
                      <td className="py-1 px-2 font-mono text-gray-500 text-[10px]">{v.sku || '-'}</td>
                      <td className="py-1 px-2 text-gray-400">—</td>
                      <td className="py-1 px-2 text-right font-mono font-bold text-black">
                        {parseFloat(v.final_price || (parseFloat(product.price) + parseFloat(v.price_adjustment || 0))).toLocaleString()}
                      </td>
                      <td className="py-1 px-2 text-gray-400">—</td>
                      <td className="py-1 px-2 text-center text-[10px]">
                        {v.stock > 0 ? (
                          <span className="font-semibold text-emerald-700">In Stock</span>
                        ) : (
                          <span className="text-gray-400">Out of Stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black bg-gray-50 text-[11px]" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <td colSpan={7} className="py-2.5 px-3 text-center text-gray-600 italic">
                  * Prices are in Tanzanian Shillings (TSh). Contact our store for custom orders, bulk orders, and delivery services.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardProducts;
