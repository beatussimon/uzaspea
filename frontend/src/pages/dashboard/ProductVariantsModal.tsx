import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Plus, Trash, X } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';

export default function ProductVariantsModal({ productId, onClose }: { productId: string, onClose: () => void }) {
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ color: '', size: '', material: '', custom: '', price_adjustment: '0', stock: '0', is_available: true });
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    fetchVariants();
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

    const formData = new FormData();
    formData.append('product', productId);
    formData.append('name', finalName);
    formData.append('price_adjustment', form.price_adjustment);
    formData.append('stock', form.stock);
    formData.append('is_available', String(form.is_available));
    if (imageFile) formData.append('image', imageFile);

    try {
      await api.post('/api/variants/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Variant added!');
      setShowForm(false);
      setForm({ color: '', size: '', material: '', custom: '', price_adjustment: '0', stock: '0', is_available: true });
      setImageFile(null);
      fetchVariants();
    } catch {
      toast.error('Failed to add variant');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/variants/${id}/`);
      toast.success('Variant deleted');
      fetchVariants();
    } catch {
      toast.error('Failed to delete variant');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#121212] rounded-card w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] border border-surface-border dark:border-surface-dark-border overflow-hidden animate-scale-in">
        <div className="p-4 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/50 dark:bg-[#161616]/50 flex items-center justify-between">
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
                  <div key={v.id} className="card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {v.image && (
                        <div className="w-10 h-10 rounded-btn overflow-hidden shrink-0 bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border">
                          <SafeImage src={v.image} alt={v.name} category="product" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white text-xs truncate">{v.name}</p>
                        <p className="text-2xs text-gray-500 mt-0.5">
                          Price Adj: <span className="font-bold text-brand-600 dark:text-brand-400">+TSh {parseFloat(v.price_adjustment).toLocaleString()}</span> • Stock: {v.stock}
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
                <form onSubmit={handleSubmit} className="card p-4 space-y-3 text-xs animate-fade-in">
                  <div className="pb-2 border-b border-surface-border dark:border-surface-dark-border">
                    <h3 className="font-bold text-xs text-gray-900 dark:text-white">Add New Variation</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-2xs font-bold text-gray-400 mb-1 block uppercase tracking-wider">Color</label>
                      <input name="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} placeholder="e.g. Red, Matte Black" className="input py-1.5 text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-2xs font-bold text-gray-400 mb-1 block uppercase tracking-wider">Size</label>
                      <input name="size" value={form.size} onChange={e => setForm({...form, size: e.target.value})} placeholder="e.g. XL, 42, 13-inch" className="input py-1.5 text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-2xs font-bold text-gray-400 mb-1 block uppercase tracking-wider">Material</label>
                      <input name="material" value={form.material} onChange={e => setForm({...form, material: e.target.value})} placeholder="e.g. Leather, Cotton" className="input py-1.5 text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-2xs font-bold text-gray-400 mb-1 block uppercase tracking-wider">Other (Custom)</label>
                      <input name="custom" value={form.custom} onChange={e => setForm({...form, custom: e.target.value})} placeholder="e.g. 128GB, v2.0" className="input py-1.5 text-xs w-full" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="text-2xs font-bold text-gray-400 mb-1 block uppercase tracking-wider">Price Adjustment (+ / -)</label>
                      <input name="price_adjustment" value={form.price_adjustment} onChange={e => setForm({...form, price_adjustment: e.target.value})} placeholder="0" type="number" required className="input py-1.5 text-xs w-full" />
                    </div>
                    <div>
                      <label className="text-2xs font-bold text-gray-400 mb-1 block uppercase tracking-wider">Stock Available</label>
                      <input name="stock" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="0" type="number" required className="input py-1.5 text-xs w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="text-2xs font-bold text-gray-400 block mb-1 uppercase tracking-wider">Image (Optional)</label>
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="input py-1 text-xs w-full file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-surface-muted" />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button type="submit" size="sm" className="font-bold">Save Variant</Button>
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
