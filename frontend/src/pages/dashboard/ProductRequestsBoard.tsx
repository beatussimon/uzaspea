import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, TrendingUp, Clock, Plus, BarChart2, Package, Users, ChevronUp, ChevronDown, Calendar, Image as ImageIcon, ArrowRightCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList } from 'recharts';
import { useNavigate } from 'react-router-dom';
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

const ProductRequestsBoard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form State
  const [newReqName, setNewReqName] = useState('');
  const [newReqDesc, setNewReqDesc] = useState('');
  const [newReqCategory, setNewReqCategory] = useState('');
  const [newReqPrice, setNewReqPrice] = useState('');
  const [newReqCondition, setNewReqCondition] = useState('New');
  const [newReqRequiresQuote, setNewReqRequiresQuote] = useState(false);
  const [newReqImage, setNewReqImage] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert State
  const [convertingId] = useState<number | null>(null);
  const [votingId, setVotingId] = useState<number | null>(null);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'request_count', direction: 'desc' });

  useEffect(() => {
    fetchRequests();
    fetchCategories();
  }, []);

  const fetchRequests = async (showLoader = true) => {
    try {
      if (showLoader && requests.length === 0) setLoading(true);
      const res = await api.get('/api/product-requests/');
      setRequests(res.data.results || res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/api/categories/');
      setCategories(res.data.results || res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReqName.trim()) return;
    
    try {
      setCreating(true);
      const formData = new FormData();
      formData.append('name', newReqName);
      formData.append('description', newReqDesc);
      formData.append('seller_username', (user as any)?.username || '');
      
      if (newReqCategory) formData.append('category', newReqCategory);
      if (newReqPrice) formData.append('price', newReqPrice);
      formData.append('condition', newReqCondition);
      formData.append('requires_quote', newReqRequiresQuote.toString());
      if (newReqImage) formData.append('image', newReqImage);

      await api.post('/api/product-requests/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(t('request_created', 'Demand card created successfully!'));
      setIsModalOpen(false);
      resetForm();
      fetchRequests(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create request');
    } finally {
      setCreating(false);
    }
  };

  const handleConvert = (req: any) => {
    navigate('/dashboard/products', { state: { convert_request: req } });
  };

  const handleVote = async (req: any) => {
    try {
      setVotingId(req.id);
      await api.post('/api/product-requests/', {
        name: req.name,
        seller_username: req.seller_username || (user as any)?.username
      });
      toast.success(`Vote added to ${req.name}!`);
      fetchRequests(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to vote");
    } finally {
      setVotingId(null);
    }
  };

  const resetForm = () => {
    setNewReqName('');
    setNewReqDesc('');
    setNewReqCategory('');
    setNewReqPrice('');
    setNewReqCondition('New');
    setNewReqRequiresQuote(false);
    setNewReqImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeRequests = requests.filter(r => !r.is_fulfilled);
  
  const sortedRequests = useMemo(() => {
    let sortableItems = [...requests];
    sortableItems.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      if (sortConfig.key === 'created_at' || sortConfig.key === 'last_requested') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sortableItems;
  }, [requests, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    } else if (sortConfig.key === key) {
      direction = 'desc';
    } else {
      direction = 'desc'; 
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const totalRequests = activeRequests.length;
  const totalVotes = activeRequests.reduce((acc, curr) => acc + (curr.request_count || 0), 0);
  const topRequested = activeRequests.length > 0 ? activeRequests.reduce((max, curr) => (curr.request_count > max.request_count ? curr : max), activeRequests[0]) : null;

  const chartData = useMemo(() => {
    return activeRequests
      .sort((a, b) => b.request_count - a.request_count)
      .slice(0, 5)
      .map(req => ({
        name: req.name.length > 12 ? req.name.substring(0, 12) + '...' : req.name,
        fullName: req.name,
        votes: req.request_count
      }));
  }, [activeRequests]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
          <p className="font-bold text-gray-900 dark:text-white mb-1">{payload[0].payload.fullName}</p>
          <p className="text-brand-600 dark:text-brand-400 font-semibold">{payload[0].value} Votes</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('product_requests', 'Demand Analytics')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('product_requests_desc', 'Analyze customer demand and convert requested items directly into your inventory.')}
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 shadow-sm">
          <Plus size={16} />
          {t('create_demand_card', 'Create Demand Card')}
        </Button>
      </header>

      {requests.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={t('no_requests', 'No Requests Yet')}
          description={t('no_requests_desc', 'Create a demand card to gauge interest on a "Product in Making".')}
        />
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-start gap-4 hover:shadow-md transition">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                <Package size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Active Unfulfilled Cards</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{totalRequests}</p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-start gap-4 hover:shadow-md transition">
              <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Active Demand</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{totalVotes} <span className="text-sm text-gray-400 font-normal">votes</span></p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-start gap-4 hover:shadow-md transition">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl">
                <TrendingUp size={24} />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Top Trending Item</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1 truncate">
                  {topRequested?.name || 'N/A'}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
                  {topRequested?.request_count || 0} votes
                </p>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-6">
              <BarChart2 size={20} className="text-brand-500" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top 5 Trending Unfulfilled Requests</h3>
            </div>
            {chartData.length > 0 && chartData.some(d => d.votes > 0) ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(107, 114, 128, 0.05)' }} />
                    <Bar dataKey="votes" radius={[6, 6, 0, 0]} barSize={40}>
                      <LabelList dataKey="votes" position="top" fill="#6B7280" fontSize={12} fontWeight={600} />
                      {chartData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} className="transition-all duration-300 hover:opacity-80" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] w-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <BarChart2 size={40} className="mb-3 opacity-20" />
                <p>Not enough votes yet to display chart.</p>
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Raw Data</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition select-none" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        {t('product_name', 'Product Info')} {getSortIcon('name')}
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition select-none" onClick={() => handleSort('request_count')}>
                      <div className="flex items-center gap-1">
                        <TrendingUp size={14} />
                        Demand {getSortIcon('request_count')}
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition select-none" onClick={() => handleSort('created_at')}>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        Created {getSortIcon('created_at')}
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRequests.map((req) => (
                    <tr key={req.id} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${req.is_fulfilled ? 'bg-gray-50 dark:bg-gray-800/50 opacity-75' : 'bg-white dark:bg-gray-800'}`}>
                      <td className="px-6 py-4 max-w-[250px]">
                        <div className="flex items-start gap-3">
                          {req.image ? (
                            <img src={req.image} alt={req.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                              <ImageIcon size={20} className="text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white truncate">{req.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                              {req.price && <span className="font-medium text-brand-600">${req.price}</span>}
                              {req.condition && <span>• {req.condition}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300 font-bold">
                          {req.request_count}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {req.is_fulfilled ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 size={14} /> In Inventory
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                            <Clock size={14} /> Gathering Demand
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {req.created_at ? new Date(req.created_at).toLocaleDateString() : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                        {!req.is_fulfilled ? (
                           <>
                             <Button 
                               type="button"
                               size="sm" 
                               variant="outline"
                               className="text-xs h-8"
                               loading={votingId === req.id}
                               onClick={() => handleVote(req)}
                             >
                               +1 Demand
                             </Button>
                             <Button 
                               type="button"
                               size="sm" 
                               variant="default"
                               className="text-xs h-8"
                               loading={convertingId === req.id}
                               onClick={() => handleConvert(req)}
                             >
                               <ArrowRightCircle size={14} className="mr-1" />
                               Convert to Product
                             </Button>
                           </>
                        ) : (
                          <span className="text-gray-400 text-sm">Fulfilled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title="Create Product in Making">
        <form onSubmit={handleCreateRequest} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Build a demand card that looks exactly like a product. Once demand is high enough, you can seamlessly add it to your inventory!
          </p>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Product Name *
            </label>
            <Input
              value={newReqName}
              onChange={(e) => setNewReqName(e.target.value)}
              required
              placeholder="e.g. iPhone 16 Pro Max Case"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Estimated Price (Optional)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newReqPrice}
                onChange={(e) => setNewReqPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <select
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                value={newReqCategory}
                onChange={(e) => setNewReqCategory(e.target.value)}
              >
                <option value="">-- Select Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Condition</label>
              <select
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                value={newReqCondition}
                onChange={(e) => setNewReqCondition(e.target.value)}
              >
                <option value="New">New</option>
                <option value="Used">Used</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                id="reqQuote"
                checked={newReqRequiresQuote}
                onChange={(e) => setNewReqRequiresQuote(e.target.checked)}
                className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
              />
              <label htmlFor="reqQuote" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Requires Quote
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description (Optional)
            </label>
            <textarea
              className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              rows={3}
              value={newReqDesc}
              onChange={(e) => setNewReqDesc(e.target.value)}
              placeholder="e.g. Premium leather cases in multiple colors"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Product Image (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(e) => setNewReqImage(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create Demand Card
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProductRequestsBoard;
