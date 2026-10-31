import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Plus, Trash, X, Camera } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';

export default function ProductVariantsModal({ 
  productId, 
  onClose,
  onUpdated 
}: { 
  productId: string | number; 
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    color: '', 
    size: '', 
    material: '', 
    custom: '', 
    format_type: 'PHYSICAL',
    is_unlimited_stock: false,
    price_adjustment: '0', 
    stock: '0', 
    is_available: true 
  });
  const [digitalFile, setDigitalFile] = useState<File | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [productPhotos, setProductPhotos] = useState<string[]>([]);
  const [selectedProductPhoto, setSelectedProductPhoto] = useState<string | null>(null);
  const [editingPhotoVariantId, setEditingPhotoVariantId] = useState<number | null>(null);

  useEffect(() => {
    fetchVariants();
    api.get(`/api/products/${productId}/`)
      .then(res => {
        const imgs = (res.data.images || []).map((img: any) => img.image).filter(Boolean);
        if (imgs.length === 0 && res.data.image) imgs.push(res.data.image);
        setProductPhotos(imgs);
      })
      .catch(() => {});
  }, [productId]);

  const fetchVariants = () => {
    setLoading(true);
    api.get(`/api/variants/?product=${productId}`)
      .then(res => setVariants(res.data.results || res.data))
      .catch(() => toast.error('Failed to load variants'))
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const attributes = [];
    if (form.color.trim()) attributes.push(form.color.trim());
    if (form.size.trim()) attributes.push(form.size.trim());
    if (form.material.trim()) attributes.push(form.material.trim());
    if (form.custom.trim()) attributes.push(form.custom.trim());
    
    const finalName = attributes.length > 0 ? attributes.join(' / ') : 'Default Variation';

    const finalStock = form.is_unlimited_stock ? '99999' : form.stock;
    const formData = new FormData();
    formData.append('product', String(productId));
    formData.append('name', finalName);
    formData.append('format_type', form.format_type);
    formData.append('is_unlimited_stock', String(form.is_unlimited_stock));
    formData.append('price_adjustment', form.price_adjustment);
    formData.append('stock', finalStock);
    formData.append('is_available', String(form.is_available));
    if (imageFile) {
      formData.append('image', imageFile);
    } else if (selectedProductPhoto) {
      formData.append('copy_from_image', selectedProductPhoto);
    }

    try {
      const res = await api.post('/api/variants/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const createdVariant = res.data;

      // If a digital master file was selected, upload it to /api/digital/assets/
      if (digitalFile && createdVariant?.id) {
        toast('Uploading digital master file to private vault...', { icon: '🔐' });
        const assetFd = new FormData();
        assetFd.append('product', String(productId));
        assetFd.append('variant', String(createdVariant.id));
        assetFd.append('title', `${finalName}`);
        
        let fileType = 'PDF';
        if (form.format_type === 'AUDIOBOOK' || digitalFile.name.match(/\.(mp3|m4b|m4a|wav)$/i)) {
          fileType = 'AUDIO';
        } else if (form.format_type === 'LICENSE_KEY') {
          fileType = 'KEY';
        }
        assetFd.append('file_type', fileType);
        assetFd.append('file', digitalFile);
        if (sampleFile) {
          assetFd.append('sample_preview_file', sampleFile);
        }
        assetFd.append('delivery_mode', fileType === 'AUDIO' ? 'STREAM_AND_DOWNLOAD' : 'STREAM_AND_DOWNLOAD');
        assetFd.append('watermark_enabled', fileType === 'PDF' ? 'true' : 'false');
        
        await api.post('/digital/assets/', assetFd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      toast.success('Variant added successfully!');
      setShowForm(false);
      setForm({ 
        color: '', size: '', material: '', custom: '', 
        format_type: 'PHYSICAL', is_unlimited_stock: false,
        price_adjustment: '0', stock: '0', is_available: true 
      });
      setImageFile(null);
      setDigitalFile(null);
      setSampleFile(null);
      setSelectedProductPhoto(null);
      fetchVariants();
      onUpdated?.();
    } catch {
      toast.error('Failed to add variant');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/variants/${id}/`);
      toast.success('Variant deleted');
      fetchVariants();
      onUpdated?.();
    } catch {
      toast.error('Failed to delete variant');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#121212] rounded-card w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] border-0 overflow-hidden animate-scale-in">
        <div className="p-4 bg-surface-muted/50 dark:bg-[#161616]/50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Manage Product Variants</h2>
            <p className="text-2xs text-gray-400">Configure size, color, material, and price differences</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-btn transition">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : (
            <div className="space-y-3">
              {variants.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">No variants created for this product yet.</div>
              ) : (
                variants.map(v => (
                  <div key={v.id} className="card !border-none p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative group/varimg shrink-0">
                        {v.image ? (
                          <div className="w-10 h-10 rounded-btn overflow-hidden bg-surface-muted dark:bg-[#161616]">
                            <SafeImage src={v.image} alt={v.name} category="product" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-btn border border-dashed border-surface-border dark:border-surface-dark-border bg-surface-muted/30 flex items-center justify-center text-gray-400">
                            <Camera size={14} />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingPhotoVariantId(editingPhotoVariantId === v.id ? null : v.id)}
                          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-btn opacity-0 group-hover/varimg:opacity-100 transition-opacity cursor-pointer"
                          title="Change variant photo"
                        >
                          <Camera size={14} />
                        </button>
                        {editingPhotoVariantId === v.id && (
                          <div className="absolute left-0 top-full mt-1.5 z-30 p-2 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl border border-surface-border dark:border-surface-dark-border w-48 text-left animate-fade-in">
                            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-surface-border dark:border-surface-dark-border">
                              <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Choose Photo</span>
                              <button type="button" onClick={() => setEditingPhotoVariantId(null)} className="text-gray-400 hover:text-red-500 text-xs font-bold">✕</button>
                            </div>
                            {productPhotos.length > 0 && (
                              <div className="mb-2">
                                <span className="text-[9px] text-gray-400 block mb-1">From Product:</span>
                                <div className="grid grid-cols-4 gap-1 max-h-20 overflow-y-auto">
                                  {productPhotos.map((pImg, pIdx) => (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await api.patch(`/api/variants/${v.id}/`, { copy_from_image: pImg });
                                          toast.success('Variant photo updated');
                                          fetchVariants();
                                          onUpdated?.();
                                        } catch {
                                          toast.error('Failed to update photo');
                                        }
                                        setEditingPhotoVariantId(null);
                                      }}
                                      className="w-8 h-8 rounded border border-surface-border overflow-hidden hover:border-brand-500 p-0.5 cursor-pointer"
                                    >
                                      <img src={pImg} alt="" className="w-full h-full object-cover rounded-xs" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <label className="flex items-center justify-center gap-1.5 w-full py-1 text-[10px] font-bold bg-surface-muted dark:bg-[#202020] hover:bg-surface-border rounded cursor-pointer transition">
                              <Camera size={11} /> Upload from device
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const fd = new FormData();
                                    fd.append('image', file);
                                    try {
                                      await api.patch(`/api/variants/${v.id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                      toast.success('Variant photo updated');
                                      fetchVariants();
                                      onUpdated?.();
                                    } catch {
                                      toast.error('Failed to update photo');
                                    }
                                  }
                                  setEditingPhotoVariantId(null);
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                          <span>{v.name}</span>
                          {v.format_type && v.format_type !== 'PHYSICAL' && (
                            <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-black text-white dark:bg-white dark:text-black">
                              {v.format_type === 'DIGITAL_FILE' ? 'PDF' : v.format_type === 'AUDIOBOOK' ? 'AUDIO' : v.format_type}
                            </span>
                          )}
                        </p>
                        <p className="text-2xs text-gray-500 mt-0.5">
                          Price Adj: <span className="font-bold text-brand-600 dark:text-brand-400">+TSh {parseFloat(v.price_adjustment).toLocaleString()}</span> • Stock: {v.is_unlimited_stock ? 'Unlimited' : v.stock}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(v.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition">
                      <Trash size={14} />
                    </button>
                  </div>
                ))
              )}

              {!showForm ? (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="w-full py-2.5 border-2 border-dashed border-surface-border dark:border-surface-dark-border rounded-card text-gray-500 dark:text-gray-400 hover:text-brand-600 hover:border-brand-500 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Add Variant Option
                </button>
              ) : (
                <form onSubmit={handleSubmit} className="card p-4 space-y-3.5 text-xs animate-fade-in">
                  <div>
                    <h3 className="font-semibold text-xs text-gray-900 dark:text-white">Add New Variation</h3>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Format Type</label>
                    <select
                      value={form.format_type}
                      onChange={e => setForm({...form, format_type: e.target.value, is_unlimited_stock: e.target.value !== 'PHYSICAL'})}
                      className="input py-1.5 text-xs w-full bg-surface dark:bg-[#1a1a1a]"
                    >
                      <option value="PHYSICAL">Physical Edition / Hardcopy (Requires Shipping)</option>
                      <option value="DIGITAL_FILE">Digital PDF / eBook (Forensic Watermarking)</option>
                      <option value="AUDIOBOOK">Audiobook / Audio Course (Encrypted Streaming)</option>
                      <option value="LICENSE_KEY">License Key / Activation Code</option>
                    </select>
                  </div>

                  {form.format_type !== 'PHYSICAL' && (
                    <div className="p-3 bg-surface-muted/60 dark:bg-[#1a1a1e] rounded-lg space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">Digital Vault Settings</span>
                        <label className="flex items-center gap-1.5 text-3xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.is_unlimited_stock}
                            onChange={e => setForm({...form, is_unlimited_stock: e.target.checked})}
                            className="rounded"
                          />
                          <span>Unlimited Digital Stock</span>
                        </label>
                      </div>

                      <div>
                        <label className="text-3xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                          Protected Master File ({form.format_type === 'AUDIOBOOK' ? 'MP3, M4B, M4A' : 'PDF, EPUB, ZIP'})
                        </label>
                        <input
                          type="file"
                          accept={form.format_type === 'AUDIOBOOK' ? '.mp3,.m4b,.m4a,.wav' : '.pdf,.epub,.zip'}
                          onChange={e => setDigitalFile(e.target.files?.[0] || null)}
                          className="input py-1 text-xs w-full file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-surface-muted"
                        />
                        <p className="text-3xs text-gray-400 mt-0.5">
                          Stored securely in vault storage outside public web directory.
                        </p>
                      </div>

                      <div>
                        <label className="text-3xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                          Free Sample / Preview (Optional)
                        </label>
                        <input
                          type="file"
                          accept={form.format_type === 'AUDIOBOOK' ? '.mp3,.m4a' : '.pdf'}
                          onChange={e => setSampleFile(e.target.files?.[0] || null)}
                          className="input py-1 text-xs w-full file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-surface-muted"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Color</label>
                      <input name="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} placeholder="e.g. Red, Matte Black" className="input py-1.5 text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Size</label>
                      <input name="size" value={form.size} onChange={e => setForm({...form, size: e.target.value})} placeholder="e.g. XL, 42, 13-inch" className="input py-1.5 text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Material</label>
                      <input name="material" value={form.material} onChange={e => setForm({...form, material: e.target.value})} placeholder="e.g. Leather, Cotton" className="input py-1.5 text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Other (Custom)</label>
                      <input name="custom" value={form.custom} onChange={e => setForm({...form, custom: e.target.value})} placeholder="e.g. 128GB, v2.0" className="input py-1.5 text-xs w-full" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Price Adjustment (+ / -)</label>
                      <input name="price_adjustment" value={form.price_adjustment} onChange={e => setForm({...form, price_adjustment: e.target.value})} placeholder="0" type="number" required className="input py-1.5 text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Stock Available</label>
                      <input name="stock" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="0" type="number" required className="input py-1.5 text-xs w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Image (Optional)</label>
                    {productPhotos.length > 0 && (
                      <div className="mb-2">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">From Product Photos:</span>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {productPhotos.map((pImg, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => {
                                setSelectedProductPhoto(selectedProductPhoto === pImg ? null : pImg);
                                setImageFile(null);
                              }}
                              className={`w-9 h-9 rounded border overflow-hidden p-0.5 cursor-pointer transition ${
                                selectedProductPhoto === pImg
                                  ? 'border-brand-500 ring-2 ring-brand-500/20'
                                  : 'border-surface-border dark:border-surface-dark-border hover:border-brand-400'
                              }`}
                            >
                              <img src={pImg} alt="" className="w-full h-full object-cover rounded-xs" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        setImageFile(e.target.files?.[0] || null);
                        if (e.target.files?.[0]) setSelectedProductPhoto(null);
                      }}
                      className="input py-1 text-xs w-full file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-surface-muted"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button type="submit" size="sm" className="font-medium">Save Variant</Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
