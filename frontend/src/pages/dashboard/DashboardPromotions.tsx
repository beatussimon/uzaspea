import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Plus, Megaphone, Upload, Smartphone } from 'lucide-react';

// ============ Dashboard Promotions ============
const DashboardPromotions: React.FC = () => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product: '', title: '', description: '', duration_days: 7 });
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Payment State
  const [refId, setRefId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [adminLipa, setAdminLipa] = useState<any[]>([]);
  const [loadingLipa, setLoadingLipa] = useState(false);

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

  useEffect(() => {
    if (showForm) {
      setLoadingLipa(true);
      api.get('/api/lipa-numbers/?seller=admin')
        .then(res => setAdminLipa(res.data.results || res.data || []))
        .catch(() => {})
        .finally(() => setLoadingLipa(false));
    }
  }, [showForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product) return toast.error('Please select a product');
    if (!refId) return toast.error('Please enter the transaction reference');
    if (!proofFile) return toast.error('Please upload your payment screenshot proof');

    setSubmitting(true);
    const fd = new FormData();
    fd.append('product', form.product);
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('duration_days', String(form.duration_days));
    fd.append('transaction_reference', refId);
    fd.append('payment_proof', proofFile);

    try {
      await api.post('/api/sponsored/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Promotion requested and payment submitted successfully!');
      setShowForm(false);
      setForm({ product: '', title: '', description: '', duration_days: 7 });
      setRefId('');
      setProofFile(null);
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
          <input name="title" value={form.title} onChange={handleChange} placeholder="Promo Title (Optional, e.g. 50% Off Summer Sale)" className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Details about this promotion (Optional)..." rows={3} className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white resize-none" />
          
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
              Transfer the amount to one of our mobile numbers below to complete the promotion request.
            </p>
          </div>

          {loadingLipa ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                Pay to these numbers:
              </p>
              {adminLipa.length === 0 ? (
                <p className="text-xs text-yellow-600">No official payment numbers configured. Please contact support.</p>
              ) : (
                <div className="space-y-2">
                  {adminLipa.map((lipa: any) => (
                    <div key={lipa.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5">
                      <div className={`rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 ${lipa.network_logo ? 'w-16 h-8' : 'w-8 h-8'}`}>
                        {lipa.network_logo ? (
                          <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                        ) : (
                          <Smartphone size={16} className="text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">{lipa.network_name}</p>
                        <p className="font-mono font-black text-gray-900 dark:text-white text-xs mt-0.5">{lipa.number}</p>
                        <p className="text-[10px] text-gray-500 leading-none">{lipa.name}</p>
                      </div>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(lipa.number); toast.success('Copied!'); }}
                          className="ml-auto btn-ghost text-[10px] py-0.5 px-1.5 border border-gray-300 dark:border-gray-600 rounded">Copy</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Transaction ID / Reference</label>
              <input 
                type="text" 
                required
                value={refId} 
                onChange={(e) => setRefId(e.target.value)}
                placeholder="e.g. PP260618.1746"
                className="input text-sm h-10 bg-gray-50 dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Receipt Screenshot (Required)</label>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <div className="flex flex-col items-center justify-center pt-3 pb-4">
                  <Upload size={20} className="text-gray-400 mb-1" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-4">
                    {proofFile ? proofFile.name : 'Click to upload screenshot proof'}
                  </p>
                </div>
                <input type="file" required className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold rounded-lg transition">
            {submitting ? 'Submitting...' : 'Submit Promotion Request'}
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
              <h4 className="font-bold text-gray-900 dark:text-white mb-1">{p.title || `${p.product_name || 'Product'} Promotion`}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{p.description || 'No description provided.'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


export default DashboardPromotions;
