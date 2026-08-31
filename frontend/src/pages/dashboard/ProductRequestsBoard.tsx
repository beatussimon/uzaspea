import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, TrendingUp, Plus, BarChart2, Package, Users, ChevronUp, ChevronDown, Calendar, Image as ImageIcon, ArrowRightCircle, Printer, DollarSign, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { ReportPrintHeader } from '../../components/print/ReportPrintHeader';
import { KpiCard } from '../../components/ui/KpiCard';
import {
  KpiGridSkeleton,
  CardGridSkeleton
} from '../../components/Skeleton';

const formatCompactCurrency = (num: number, currency = 'TSh') => {
  if (!num) return `${currency} 0`;
  if (num >= 1000000) {
    return `${currency} ${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${currency} ${(num / 1000).toFixed(1)}k`;
  }
  return `${currency} ${num.toLocaleString()}`;
};

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
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  
  // Form State
  const [newReqName, setNewReqName] = useState('');
  const [newReqDesc, setNewReqDesc] = useState('');
  const [newReqCategory, setNewReqCategory] = useState('');
  const [newReqPrice, setNewReqPrice] = useState('');
  const [newReqBuyingPrice, setNewReqBuyingPrice] = useState('');
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
      if (newReqBuyingPrice) formData.append('buying_price', newReqBuyingPrice);
      formData.append('condition', newReqCondition);
      formData.append('requires_quote', newReqRequiresQuote.toString());
      if (newReqImage) formData.append('image', newReqImage);

      if (editingRequestId) {
        await api.patch(`/api/product-requests/${editingRequestId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(t('request_updated', 'Demand Card updated successfully!'));
      } else {
        await api.post('/api/product-requests/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(t('request_created', 'Demand Card created successfully!'));
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchRequests(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || t('request_error', 'Failed to save demand card'));
    } finally {
      setCreating(false);
    }
  };

  const handleConvert = (req: any) => {
    navigate('/dashboard/products', { state: { convert_request: req } });
  };

  const handleEditClick = (req: any) => {
    setEditingRequestId(req.id);
    setNewReqName(req.name || '');
    setNewReqDesc(req.description || '');
    setNewReqCategory(req.category || '');
    setNewReqPrice(req.price || '');
    setNewReqBuyingPrice(req.buying_price || '');
    setNewReqCondition(req.condition || 'New');
    setNewReqRequiresQuote(req.requires_quote || false);
    setNewReqImage(null);
    setIsModalOpen(true);
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
    setEditingRequestId(null);
    setNewReqName('');
    setNewReqDesc('');
    setNewReqCategory('');
    setNewReqPrice('');
    setNewReqBuyingPrice('');
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
  const projectedRevenue = activeRequests.reduce((acc, req) => acc + (req.price ? parseFloat(req.price) * req.request_count : 0), 0);
  const totalMissedCost = activeRequests.reduce((acc, req) => acc + (req.buying_price ? parseFloat(req.buying_price) * req.request_count : 0), 0);
  const potentialProfit = projectedRevenue - totalMissedCost;

  const chartData = useMemo(() => {
    return activeRequests
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      })
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
          <p className="text-brand-500 dark:text-brand-500 font-semibold">{payload[0].value} Votes</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 print:m-0 print:space-y-0">
      <div className="print:hidden space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('product_requests', 'Demand Analytics')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {t('product_requests_desc', 'Analyze customer demand and convert requested items directly into your inventory.')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsModalOpen(true)}
              size="sm"
              className="flex items-center gap-1.5 font-bold"
            >
              <Plus size={14} />
              {t('create_demand', 'Create Demand')}
            </Button>
            <button 
              onClick={() => window.print()}
              className="btn-ghost border border-surface-border dark:border-surface-dark-border px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 rounded-btn hover:bg-surface-muted dark:hover:bg-[#161616]"
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </header>

        {loading && requests.length === 0 ? (
          <div className="space-y-6">
            <KpiGridSkeleton count={4} cols={4} />
            <CardGridSkeleton count={2} cols={2} />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title={t('no_requests', 'No Requests Yet')}
            description={t('no_requests_desc', 'Create a demand card to gauge interest on a "Product in Making".')}
          />
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              <KpiCard
                label="Active Cards"
                value={totalRequests}
                icon={Package}
              />
              <KpiCard
                label="Total Demand"
                value={totalVotes}
                sub="votes"
                icon={Users}
              />
              <KpiCard
                label="Top Trending"
                value={topRequested?.name || 'N/A'}
                sub={topRequested ? `${topRequested.request_count} votes` : undefined}
                icon={TrendingUp}
                color="#f59e0b"
              />
              <KpiCard
                label="Missed Cost"
                value={formatCompactCurrency(totalMissedCost)}
                fullValue={`TZS ${totalMissedCost.toLocaleString()}`}
                icon={DollarSign}
                color="#10b981"
              />
              <KpiCard
                label="Potential Profit"
                value={formatCompactCurrency(potentialProfit)}
                fullValue={`TZS ${potentialProfit.toLocaleString()}`}
                icon={TrendingUp}
                color="#a855f7"
                className="col-span-2 md:col-span-1"
              />
            </div>

            {/* Chart Section */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-brand-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Demand Curve (All Active Requests)</h3>
              </div>
              {chartData.length > 0 && chartData.some(d => d.votes > 0) ? (
                <div className="h-[260px] w-full min-h-[260px]">
                  <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={260} debounce={50}>
                    <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVotes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} angle={-45} textAnchor="end" height={60} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(107, 114, 128, 0.2)', strokeWidth: 2, fill: 'transparent' }} />
                      <Area type="monotone" dataKey="votes" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVotes)">
                        <LabelList dataKey="votes" position="top" fill="#6B7280" fontSize={11} fontWeight={600} offset={10} />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[220px] w-full flex flex-col items-center justify-center text-gray-400">
                  <BarChart2 size={36} className="mb-2 opacity-30" />
                  <p className="text-xs font-medium">Not enough votes yet to display chart.</p>
                </div>
              )}
            </div>

            {/* Data Table */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active Demand Requests</h3>
                <span className="text-2xs text-gray-400">{sortedRequests.length} total items</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                    <tr>
                      <th scope="col" className="p-3 cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-1">
                          {t('product_name', 'Product Info')} {getSortIcon('name')}
                        </div>
                      </th>
                      <th scope="col" className="p-3 text-center w-24 cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none" onClick={() => handleSort('request_count')}>
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp size={12} />
                          Demand {getSortIcon('request_count')}
                        </div>
                      </th>
                      <th scope="col" className="p-3">Status</th>
                      <th scope="col" className="p-3 cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none" onClick={() => handleSort('created_at')}>
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          Created {getSortIcon('created_at')}
                        </div>
                      </th>
                      <th scope="col" className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {sortedRequests.map((req) => (
                      <tr key={req.id} className={`hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition ${req.is_fulfilled ? 'opacity-60' : ''}`}>
                        <td className="p-3 max-w-[250px] align-middle">
                          <div className="flex items-center gap-3">
                            {req.image ? (
                              <img src={req.image} alt={req.name} className="w-10 h-10 rounded-lg object-cover bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border flex items-center justify-center shrink-0">
                                <ImageIcon size={18} className="text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-white truncate">{req.name}</p>
                              <div className="flex items-center gap-2 text-2xs text-gray-400 mt-0.5">
                                {req.buying_price && (
                                  <span>Buy: <strong className="text-blue-500">{formatCompactCurrency(req.buying_price)}</strong></span>
                                )}
                                {req.price && (
                                  <span>Sell: <strong className="text-emerald-500">{formatCompactCurrency(req.price)}</strong></span>
                                )}
                                {req.condition && <span>• {req.condition}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center align-middle">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-brand-500/10 text-brand-600 dark:text-brand-400">
                            {req.request_count}
                          </span>
                        </td>
                        <td className="p-3 align-middle">
                          {req.is_fulfilled ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 capitalize">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              In Inventory
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 capitalize">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Gathering Demand
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-2xs text-gray-400 align-middle">
                          {req.created_at ? new Date(req.created_at).toLocaleDateString() : '--'}
                        </td>
                        <td className="p-3 text-right align-middle">
                          <div className="flex justify-end gap-1.5 items-center">
                            {!req.is_fulfilled ? (
                              <>
                                <Button 
                                  type="button"
                                  size="sm" 
                                  variant="outline"
                                  className="text-xs py-1"
                                  onClick={() => handleEditClick(req)}
                                >
                                  <Edit size={12} className="mr-1" /> Edit
                                </Button>
                                <Button 
                                  type="button"
                                  size="sm" 
                                  variant="outline"
                                  className="text-xs py-1"
                                  loading={votingId === req.id}
                                  onClick={() => handleVote(req)}
                                >
                                  +1 Demand
                                </Button>
                                <Button 
                                  type="button"
                                  size="sm" 
                                  variant="default"
                                  className="text-xs py-1 font-bold"
                                  loading={convertingId === req.id}
                                  onClick={() => handleConvert(req)}
                                >
                                  <ArrowRightCircle size={12} className="mr-1" />
                                  Convert
                                </Button>
                              </>
                            ) : (
                              <span className="text-gray-400 text-2xs italic">Fulfilled</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingRequestId ? "Edit Demand Card" : "Create Product in Making"}>
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
                  Estimated Selling Price
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Estimated Buying Price
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newReqBuyingPrice}
                  onChange={(e) => setNewReqBuyingPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
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
                className="w-4 h-4 text-brand-500 border-gray-300 rounded focus:ring-brand-500"
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
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file: file:text-brand-500 hover:file:"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating} className="whitespace-nowrap text-sm">
              {editingRequestId ? 'Save Changes' : 'Create Demand'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Print View */}
      <div className="hidden print:block font-sans text-black bg-white absolute top-0 left-0 w-full h-full min-h-screen z-[9999]">
        <ReportPrintHeader 
          title="Demand Analytics Report" 
          user={user} 
        />
        
        <table className="w-full text-left text-sm border-collapse mt-6">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 px-1 w-12 font-black">S/N</th>
              <th className="py-2 px-2 font-black">PRODUCT</th>
              <th className="py-2 px-2 font-black">CATEGORY</th>
              <th className="py-2 px-2 font-black text-center">VOTES</th>
              <th className="py-2 px-2 font-black text-right">EST. COST (TSH)</th>
              <th className="py-2 px-2 font-black text-right">EST. PRICE (TSH)</th>
              <th className="py-2 px-2 font-black text-center">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {sortedRequests.map((req, idx) => (
              <tr key={req.id} className="border-b border-gray-200">
                <td className="py-2 px-1 font-bold">{idx + 1}</td>
                <td className="py-2 px-2 font-bold">{req.name}</td>
                <td className="py-2 px-2">{req.category_name || '-'}</td>
                <td className="py-2 px-2 text-center">{req.request_count}</td>
                <td className="py-2 px-2 text-right font-mono">{req.buying_price ? parseFloat(req.buying_price).toLocaleString() : '-'}</td>
                <td className="py-2 px-2 text-right font-mono">{req.price ? parseFloat(req.price).toLocaleString() : '-'}</td>
                <td className="py-2 px-2 text-center">{req.is_fulfilled ? 'Fulfilled' : 'Active'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-black">
              <td colSpan={4} className="py-2 px-2 text-right">TOTAL MISSED COST:</td>
              <td colSpan={3} className="py-2 px-2 text-right font-mono text-rose-700">
                {totalMissedCost.toLocaleString()} TZS
              </td>
            </tr>
            <tr className="font-black">
              <td colSpan={4} className="py-2 px-2 text-right">PROJECTED REVENUE:</td>
              <td colSpan={3} className="py-2 px-2 text-right font-mono text-emerald-700">
                {projectedRevenue.toLocaleString()} TZS
              </td>
            </tr>
            <tr className="font-black border-t border-gray-200">
              <td colSpan={4} className="py-2 px-2 text-right">POTENTIAL PROFIT:</td>
              <td colSpan={3} className="py-2 px-2 text-right font-mono text-brand-500">
                {potentialProfit.toLocaleString()} TZS
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ProductRequestsBoard;
