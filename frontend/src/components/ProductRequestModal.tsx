import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { X, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerId?: number;
  sellerUsername?: string;
  initialName?: string;
  onSuccess?: (createdRequest: any) => void;
}

interface CategoryOption {
  id: number;
  name: string;
  slug: string;
}

const ProductRequestModal: React.FC<ProductRequestModalProps> = ({ 
  isOpen, 
  onClose, 
  sellerId, 
  sellerUsername, 
  initialName = '',
  onSuccess 
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [condition, setCondition] = useState<string>('New');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (isOpen) {
      api.get('/api/categories/').then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setCategories(data);
      }).catch(err => console.error('Failed to load categories', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImageChange = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('name', name.trim());
      if (description.trim()) fd.append('description', description.trim());
      if (sellerId) fd.append('seller_id', String(sellerId));
      if (sellerUsername) fd.append('seller_username', sellerUsername);
      if (categoryId) fd.append('category', categoryId);
      if (targetPrice.trim()) fd.append('price', targetPrice.trim());
      if (condition) fd.append('condition', condition);
      if (imageFile) fd.append('image', imageFile);

      const res = await api.post('/api/product-requests/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(t('request_submitted', 'Your product request has been submitted!'));
      if (onSuccess) {
        onSuccess(res.data);
      }
      setName('');
      setDescription('');
      setCategoryId('');
      setTargetPrice('');
      setImageFile(null);
      setImagePreview(null);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('error_submitting_request', 'Failed to submit request.'));
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-neutral-200 dark:border-neutral-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              {t('request_product', 'Request an Item')}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {sellerUsername ? `Ask @${sellerUsername} to source or stock this item` : 'Submit a product request'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Product Name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
                Product name or model <span className="text-brand-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500 transition placeholder-neutral-400 dark:placeholder-neutral-500"
                placeholder="e.g. iPhone 15 Pro 256GB Natural Titanium, Bosch Fuel Pump 0580..."
              />
            </div>

            {/* Category & Condition Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
                  Category (optional)
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500 transition cursor-pointer"
                >
                  <option value="">Select category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500 transition cursor-pointer"
                >
                  <option value="New">New</option>
                  <option value="Refurbished">Refurbished</option>
                  <option value="Used">Used</option>
                  <option value="Any">Any condition</option>
                </select>
              </div>
            </div>

            {/* Target Budget / Price */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
                Target budget or expected price (optional)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500 transition placeholder-neutral-400 dark:placeholder-neutral-500"
                placeholder="e.g. 350000"
              />
            </div>

            {/* Additional Details */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
                Specifications or requirements (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-brand-500 resize-none transition placeholder-neutral-400 dark:placeholder-neutral-500"
                placeholder="Specify color, RAM, storage, OEM part number, exact year, etc."
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
                Reference photo (optional)
              </label>
              {imagePreview ? (
                <div className="relative w-24 h-24 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden group">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleImageChange(null)}
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 hover:bg-red-500 transition cursor-pointer"
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 cursor-pointer transition text-xs text-neutral-500">
                  <ImageIcon size={15} className="text-neutral-400" />
                  <span>Attach a reference photo or screenshot</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="w-full py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-black text-xs font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer text-center"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default ProductRequestModal;
