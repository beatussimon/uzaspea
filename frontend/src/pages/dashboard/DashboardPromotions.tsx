import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Plus, Megaphone } from 'lucide-react';
// ============ Dashboard Promotions ============
const DashboardPromotions: React.FC = () => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product: '', title: '', description: '', duration_days: 7 });
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchPromotions = () => {
    setLoading(true);
    api.get('/api/sponsored/')
      .then(res => setPromotions(res.data.results || res.data))
      .catch(() => toast.error('Failed to load promotions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPromotions();
    api.get('/api/products/').then(res => setProducts(res.data.results || res.data)).catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/sponsored/', form);
      toast.success('Promotion requested successfully!');
      setShowForm(false);
      setForm({ product: '', title: '', description: '', duration_days: 7 });
      fetchPromotions();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to submit promotion request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Promotions</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition text-sm"
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'New Promotion'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-6 mb-6 shadow-sm space-y-4 animate-fade-in">
          <select name="product" value={form.product} onChange={handleChange} required className="input">
            <option value="">Select Product to Promote</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input name="title" value={form.title} onChange={handleChange} placeholder="Promo Title (e.g. 50% Off Summer Sale)" required className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Details about this promotion..." required rows={3} className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white resize-none" />
          
          <select name="duration_days" value={form.duration_days} onChange={handleChange} required className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
            <option value={3}>3 Days - 3,000 TSh</option>
            <option value={7}>7 Days - 7,000 TSh</option>
            <option value={14}>14 Days - 14,000 TSh</option>
            <option value={30}>30 Days - 30,000 TSh</option>
          </select>
          
          <div className="bg-brand-50 dark:bg-brand-900/20 p-3 rounded-lg border border-brand-100 dark:border-brand-900/30">
            <p className="text-sm font-bold text-brand-800 dark:text-brand-300">
              Total Cost: {(Number(form.duration_days) * 1000).toLocaleString()} TSh
            </p>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
              Note: Staff will review your promotion and request payment upon approval.
            </p>
          </div>

          <button type="submit" disabled={submitting} className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold rounded-lg transition">
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : promotions.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
          <Megaphone size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No active promotions. Request one now!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map((p: any) => (
            <div key={p.id} className="card p-4 border-l-4 border-l-brand-600 animate-fade-in">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${p.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {p.approved ? 'Live' : 'Pending'}
                </span>
                <span className="text-[10px] text-gray-400">{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-1">{p.title}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{p.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


export default DashboardPromotions;
