import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Plus, Trash, X } from 'lucide-react';
import SafeImage from '../../components/SafeImage';

export default function ProductVariantsModal({ productId, onClose }: { productId: string, onClose: () => void }) {
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', price_adjustment: '0', stock: '0', is_available: true });
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
    const formData = new FormData();
    formData.append('product', productId);
    formData.append('name', form.name);
    formData.append('price_adjustment', form.price_adjustment);
    formData.append('stock', form.stock);
    formData.append('is_available', String(form.is_available));
    if (imageFile) formData.append('image', imageFile);

    try {
      await api.post('/api/variants/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Variant added!');
      setShowForm(false);
      setForm({ name: '', price_adjustment: '0', stock: '0', is_available: true });
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manage Variants</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {variants.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No variants yet.</p>
              ) : (
                variants.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      {v.image && (
                        <div className="w-10 h-10 rounded overflow-hidden shrink-0">
                          <SafeImage src={v.image} alt={v.name} category="product" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{v.name}</p>
                        <p className="text-xs text-gray-500">
                          Price Adj: TSh {parseFloat(v.price_adjustment).toLocaleString()} | Stock: {v.stock}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(v.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                      <Trash size={16} />
                    </button>
                  </div>
                ))
              )}

              {!showForm ? (
                <button onClick={() => setShowForm(true)} className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-brand-600 hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition flex items-center justify-center gap-2">
                  <Plus size={16} /> Add Variant
                </button>
              ) : (
                <form onSubmit={handleSubmit} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-3">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">New Variant</h3>
                  <input name="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Variant Name (e.g. XL - Blue)" required className="w-full p-2.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white" />
                  <div className="grid grid-cols-2 gap-3">
                    <input name="price_adjustment" value={form.price_adjustment} onChange={e => setForm({...form, price_adjustment: e.target.value})} placeholder="Price Adjustment" type="number" required className="w-full p-2.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white" />
                    <input name="stock" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="Stock" type="number" required className="w-full p-2.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Image (Optional)</label>
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-brand-50 file:text-brand-700" />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button type="submit" className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-bold transition">Save</button>
                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-bold transition">Cancel</button>
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
