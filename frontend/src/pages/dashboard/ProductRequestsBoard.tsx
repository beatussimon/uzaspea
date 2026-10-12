import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, TrendingUp, Plus, BarChart2, Package, Users, ChevronUp, ChevronDown, Calendar, Image as ImageIcon, ArrowRightCircle, Printer, DollarSign, Edit, PieChart as PieChartIcon, List, CheckCircle2, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, PieChart, Pie, Cell, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { ReportPrintHeader } from '../../components/print/ReportPrintHeader';
import { cn } from '../../lib/utils';
import { KpiCard } from '../../components/ui/KpiCard';
import { DemandAnalyticsSkeleton } from '../../components/Skeleton';
import { printElement } from '../../utils/printHelper';
import { DateRangePicker, type DateRange } from '../../components/ui/DateRangePicker';

const formatCompactCurrency = (rawNum: number | string | undefined | null, currency = 'TSh') => {
  if (rawNum === undefined || rawNum === null) return `${currency} 0`;
  const num = typeof rawNum === 'string' ? parseFloat(rawNum.replace(/,/g, '')) : Number(rawNum);
  if (!num || isNaN(num)) return `${currency} 0`;
  if (num >= 1_000_000_000) {
    return `${currency} ${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (num >= 1_000_000) {
    return `${currency} ${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    return `${currency} ${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${currency} ${num.toLocaleString()}`;
};

const ProductRequestThumbnail: React.FC<{
  src?: string | null;
  alt: string;
}> = ({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div 
        className="w-10 h-10 rounded-lg bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border flex items-center justify-center shrink-0"
        title={alt}
      >
        <ImageIcon size={18} className="text-gray-400 opacity-60" />
      </div>
    );
  }

  return (
    <div className="relative w-10 h-10 rounded-lg bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border overflow-hidden shrink-0">
      {/* Low-res blurred preview placeholder while decoding */}
      {!loaded && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover filter blur-[4px] scale-110 opacity-60 pointer-events-none transition-opacity duration-300"
          loading="eager"
          decoding="async"
        />
      )}

      {/* Crisp image that fades in smoothly once decoded */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-all duration-300 ease-out ${
          loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      />
    </div>
  );
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
  const [votingId, setVotingId] = useState<number | null>(null);
  
  // Action Dropdown State (Convert / Cancel)
  const [actionDropdownId, setActionDropdownId] = useState<number | null>(null);

  // Profitability Display State (List vs Pie Chart)
  const [productDisplayType, setProductDisplayType] = useState<'list' | 'chart'>('list');


  // Date Range Filter State (Matches Store Analytics)
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    label: t('all_time', 'All Time')
  });
  
  // Custom Demand Increment Amount per row (default 1)
  const [demandAmounts, setDemandAmounts] = useState<Record<number, string>>({});
  
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
  const printDemandRef = useRef<HTMLDivElement>(null);
  const [isPrintingDemand, setIsPrintingDemand] = useState(false);

  const handlePrintDemand = async () => {
    if (!printDemandRef.current) return;
    try {
      setIsPrintingDemand(true);
      await printElement(printDemandRef.current, {
        pageTitle: `Demand Analytics Report - SokoniMax`,
        pageStyle: `@page { size: A4 portrait; margin: 12mm 14mm; }`,
      });
    } catch (err) {
      console.error('Failed to print demand report:', err);
    } finally {
      setIsPrintingDemand(false);
    }
  };

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'request_count', direction: 'desc' });

  useEffect(() => {
    fetchRequests();
    fetchCategories();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.action-dropdown-container')) {
        setActionDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchRequests = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const res = await api.get('/api/product-requests/?mine=true');
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

  const handleCancelDemand = async (req: any) => {
    try {
      setActionDropdownId(null);
      await api.post(`/api/product-requests/${req.id}/cancel/`);
      toast.success(t('demand_cancelled', `Demand for "${req.name}" cancelled.`));
      fetchRequests(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || t('cancel_error', 'Failed to cancel demand'));
    }
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

  const getDemandAmount = (id: number): number => {
    const val = demandAmounts[id];
    if (!val) return 1;
    const num = parseInt(val, 10);
    return isNaN(num) || num < 1 ? 1 : Math.min(1000, num);
  };

  const handleDemandAmountChange = (id: number, val: string) => {
    const cleanVal = val.replace(/\D/g, '');
    if (cleanVal === '') {
      setDemandAmounts(prev => ({ ...prev, [id]: '' }));
      return;
    }
    const parsed = parseInt(cleanVal, 10);
    if (parsed > 1000) {
      setDemandAmounts(prev => ({ ...prev, [id]: '1000' }));
    } else {
      setDemandAmounts(prev => ({ ...prev, [id]: String(parsed) }));
    }
  };

  const handleDemandAmountBlur = (id: number) => {
    setDemandAmounts(prev => {
      const val = prev[id];
      if (!val || parseInt(val, 10) < 1) {
        return { ...prev, [id]: '1' };
      }
      return prev;
    });
  };

  const handleDemandKeyDown = (e: React.KeyboardEvent, req: any) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const curr = getDemandAmount(req.id);
      const next = Math.min(1000, curr + 1);
      setDemandAmounts(prev => ({ ...prev, [req.id]: String(next) }));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const curr = getDemandAmount(req.id);
      const next = Math.max(1, curr - 1);
      setDemandAmounts(prev => ({ ...prev, [req.id]: String(next) }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleIncrementDemand(req);
    }
  };

  const handleIncrementDemand = async (req: any, customAmount?: number) => {
    if (req.is_fulfilled) {
      toast.error(t('fulfilled_demand_error', 'Cannot add demand to a fulfilled request'));
      return;
    }

    const amountToAdd = customAmount !== undefined ? customAmount : getDemandAmount(req.id);
    const validAmount = Math.max(1, Math.min(amountToAdd, 1000));
    const previousCount = req.request_count || 0;
    const newCount = previousCount + validAmount;

    // Optimistic UI update for instant feedback
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, request_count: newCount } : r));

    try {
      setVotingId(req.id);
      const res = await api.post(`/api/product-requests/${req.id}/increment_demand/`, { amount: validAmount });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, request_count: res.data.request_count } : r));
      toast.success(`+${validAmount} demand recorded for ${req.name}! (${res.data.request_count} total)`);
      // Reset input back to default 1
      setDemandAmounts(prev => ({ ...prev, [req.id]: '1' }));
    } catch (err: any) {
      // Revert optimistic update on failure
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, request_count: previousCount } : r));
      toast.error(err.response?.data?.error || t('increment_error', 'Failed to increment demand'));
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

  const filteredRequests = useMemo(() => {
    if (!dateRange.startDate && !dateRange.endDate) return requests;
    return requests.filter(req => {
      const dateVal = req.created_at || req.last_requested;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;

      if (dateRange.startDate && localDateStr < dateRange.startDate) return false;
      if (dateRange.endDate && localDateStr > dateRange.endDate) return false;
      return true;
    });
  }, [requests, dateRange]);

  const activeRequests = useMemo(() => filteredRequests.filter(r => !r.is_fulfilled && !r.is_cancelled), [filteredRequests]);
  const fulfilledRequests = useMemo(() => filteredRequests.filter(r => r.is_fulfilled || r.is_cancelled), [filteredRequests]);
  
  const sortItems = (items: any[]) => {
    let sortableItems = [...items];
    sortableItems.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      if (sortConfig.key === 'created_at' || sortConfig.key === 'last_requested') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else if (sortConfig.key === 'projected_profit') {
        const sellA = parseFloat(a.price || '0') || 0;
        const buyA = parseFloat(a.buying_price || '0') || 0;
        aValue = Math.max(0, sellA - buyA) * (a.request_count || 0);

        const sellB = parseFloat(b.price || '0') || 0;
        const buyB = parseFloat(b.buying_price || '0') || 0;
        bValue = Math.max(0, sellB - buyB) * (b.request_count || 0);
      } else if (sortConfig.key === 'buying_price' || sortConfig.key === 'price') {
        aValue = parseFloat(a[sortConfig.key] || '0') || 0;
        bValue = parseFloat(b[sortConfig.key] || '0') || 0;
      } else if (sortConfig.key === 'request_count') {
        aValue = a.request_count || 0;
        bValue = b.request_count || 0;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue || '').toString().toLowerCase();
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
  };

  const sortedActiveRequests = useMemo(() => sortItems(activeRequests), [activeRequests, sortConfig]);
  const sortedFulfilledRequests = useMemo(() => sortItems(fulfilledRequests), [fulfilledRequests, sortConfig]);
  const sortedRequests = useMemo(() => sortItems(filteredRequests), [filteredRequests, sortConfig]);

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
  const profitMargin = projectedRevenue > 0 ? Math.round((potentialProfit / projectedRevenue) * 100) : 0;

  // Fulfilled history statistics
  const fulfilledVotes = fulfilledRequests.reduce((acc, curr) => acc + (curr.request_count || 0), 0);
  const fulfilledRevenue = fulfilledRequests.reduce((acc, req) => acc + (!req.is_cancelled && req.price ? parseFloat(req.price) * req.request_count : 0), 0);
  const fulfilledCost = fulfilledRequests.reduce((acc, req) => acc + (!req.is_cancelled && req.buying_price ? parseFloat(req.buying_price) * req.request_count : 0), 0);
  const fulfilledProfit = fulfilledRevenue - fulfilledCost;

  // Demand-weighted projected profitability per product
  const productProfits = useMemo(() => {
    return activeRequests
      .map(req => {
        const sell = req.price ? parseFloat(req.price) : 0;
        const buy = req.buying_price ? parseFloat(req.buying_price) : 0;
        const unitProfit = Math.max(0, sell - buy);
        const demand = req.request_count || 0;
        const projectedProfit = unitProfit * demand;
        const margin = sell > 0 ? Math.round(((sell - buy) / sell) * 100) : 0;
        return {
          ...req,
          sell,
          buy,
          unitProfit,
          demand,
          projectedProfit,
          margin
        };
      })
      .filter(item => item.projectedProfit > 0)
      .sort((a, b) => b.projectedProfit - a.projectedProfit);
  }, [activeRequests]);

  const topProfitableProduct = productProfits.length > 0 ? productProfits[0] : null;
  const maxProjectedProfit = topProfitableProduct ? topProfitableProduct.projectedProfit : 0;

  const PRODUCT_COLORS = ['#10b981', '#059669', '#0d9488', '#0284c7', '#64748b'];

  const productProfitDonutData = useMemo(() => {
    // Only display top 5 products in pie chart so legend fits comfortably without clipping
    return productProfits.slice(0, 5).map((item, idx) => ({
      name: item.name.length > 12 ? item.name.substring(0, 10) + '...' : item.name,
      fullName: item.name,
      value: Math.round(item.projectedProfit),
      votes: item.request_count,
      unitProfit: item.unitProfit,
      margin: item.margin,
      color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length]
    }));
  }, [productProfits]);

  const ProductCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 text-xs">
          <p className="font-bold text-gray-900 dark:text-white mb-1">{data.fullName}</p>
          <p className="text-emerald-500 font-extrabold mb-1">
            Proj. Profit: TZS {Number(data.value || 0).toLocaleString()}
          </p>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
            <p>Demand: <span className="font-semibold text-gray-900 dark:text-white">{data.votes} votes</span></p>
            <p>Unit Profit: <span className="font-semibold text-gray-900 dark:text-white">TZS {Number(data.unitProfit || 0).toLocaleString()}</span></p>
            <p>Margin: <span className="font-semibold text-emerald-500">{data.margin}%</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

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
        <header className="space-y-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('product_requests', 'Demand Analytics')}
            </h1>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Button
                onClick={() => setIsModalOpen(true)}
                size="sm"
                className="flex items-center gap-1.5 font-bold text-xs px-3 py-1.5 whitespace-nowrap shrink-0"
              >
                <Plus size={14} />
                <span>{t('create_demand', 'Create Demand')}</span>
              </Button>
              <button 
                type="button"
                onClick={handlePrintDemand}
                disabled={isPrintingDemand}
                className="inline-flex items-center gap-1.5 border border-surface-border dark:border-surface-dark-border px-3 py-1.5 text-xs font-bold rounded-btn hover:bg-surface-muted dark:hover:bg-[#161616] text-gray-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer transition disabled:opacity-50"
                title="Print Demand Report"
              >
                <Printer size={14} /> <span>{isPrintingDemand ? 'Printing...' : 'Print'}</span>
              </button>
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t('product_requests_desc', 'Analyze customer demand and convert requested items directly into your inventory.')}
          </p>
        </header>

        {loading && requests.length === 0 ? (
          <DemandAnalyticsSkeleton />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title={t('no_requests', 'No Requests Yet')}
            description={t('no_requests_desc', 'Create a demand card to gauge interest on a "Product in Making".')}
          />
        ) : (
          <div className={cn("space-y-6", loading && "opacity-75 transition-opacity")}>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5">
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
                value={topRequested?.name ? (topRequested.name.length > 15 ? topRequested.name.substring(0, 13) + '...' : topRequested.name) : 'N/A'}
                fullValue={topRequested?.name || 'N/A'}
                sub={topRequested ? `${topRequested.request_count} votes` : undefined}
                icon={TrendingUp}
              />
              <KpiCard
                label="Missed Cost"
                value={formatCompactCurrency(totalMissedCost)}
                fullValue={`TZS ${totalMissedCost.toLocaleString()}`}
                icon={DollarSign}
              />
              <KpiCard
                label="Potential Profit"
                value={formatCompactCurrency(potentialProfit)}
                fullValue={`TZS ${potentialProfit.toLocaleString()}`}
                icon={TrendingUp}
                color="#10b981"
                className="col-span-2 sm:col-span-1 lg:col-span-1"
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Demand Curve */}
              <div className="lg:col-span-2 card p-5 flex flex-col h-[350px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Demand Curve (All Active Requests)</h3>
                  </div>
                  {chartData.length > 0 && chartData.some(d => d.votes > 0) ? (
                    <div className="h-[270px] w-full min-h-[270px] flex-1">
                      <ResponsiveContainer width="100%" height={270} minWidth={0} minHeight={270} debounce={50}>
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
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <BarChart2 size={36} className="mb-2 opacity-30" />
                      <p className="text-xs font-medium">Not enough votes yet to display chart.</p>
                    </div>
                  )}
                </div>

              {/* Profitability Card */}
              <div className="card p-5 flex flex-col h-[350px]">
                  <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      Projected Profitability
                    </h3>
                    
                    {productProfits.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setProductDisplayType('list')}
                          className={`p-1.5 rounded-lg transition ${
                            productDisplayType === 'list'
                              ? 'bg-neutral-800 text-white shadow-sm'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          title="List view"
                        >
                          <List size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductDisplayType('chart')}
                          className={`p-1.5 rounded-lg transition ${
                            productDisplayType === 'chart'
                              ? 'bg-neutral-800 text-white shadow-sm'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          title="Chart view"
                        >
                          <PieChartIcon size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {productProfits.length > 0 ? (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                      {/* Display Mode: List vs Chart */}
                      {productDisplayType === 'list' ? (
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0 scrollbar-thin">
                          {productProfits.map((item, index) => {
                            const percentOfMax = maxProjectedProfit > 0 ? Math.round((item.projectedProfit / maxProjectedProfit) * 100) : 0;
                            const isTop = index === 0;

                            return (
                              <div key={item.id} className="space-y-1">
                                <div className="flex items-center justify-between text-xs gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`text-[11px] font-bold w-4 shrink-0 ${isTop ? 'text-emerald-400' : 'text-gray-500'}`}>
                                      #{index + 1}
                                    </span>
                                    <span className="font-medium text-gray-900 dark:text-gray-200 truncate" title={item.name}>
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className={`text-xs ${isTop ? 'font-extrabold text-emerald-400' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>
                                      {formatCompactCurrency(item.projectedProfit)}
                                    </span>
                                  </div>
                                </div>
                                <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isTop ? 'bg-emerald-500' : 'bg-emerald-500/40 dark:bg-emerald-500/35'
                                    }`}
                                    style={{ width: `${percentOfMax}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-neutral-500">
                                  <span>{item.request_count} votes · {formatCompactCurrency(item.unitProfit)}/unit</span>
                                  <span>{item.margin}% margin</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-[270px] w-full min-h-[270px] flex-1">
                          <ResponsiveContainer width="100%" height={270} minWidth={0} minHeight={270} debounce={50}>
                            <PieChart margin={{ top: 0, bottom: 4, left: 0, right: 0 }}>
                              <Pie
                                data={productProfitDonutData}
                                cx="50%"
                                cy="42%"
                                innerRadius={48}
                                outerRadius={70}
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                              >
                                {productProfitDonutData.map((entry, index) => (
                                  <Cell key={`prod-cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                              </Pie>
                              <Tooltip content={<ProductCustomTooltip />} />
                              <Legend
                                verticalAlign="bottom"
                                height={44}
                                iconType="circle"
                                wrapperStyle={{
                                  fontSize: 10,
                                  lineHeight: '16px',
                                  paddingTop: '4px'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                      <DollarSign size={36} className="mb-2 opacity-30 text-emerald-500" />
                      <p className="text-xs font-semibold">No price or cost data available</p>
                      <p className="text-3xs text-gray-500 mt-1">Set selling and buying prices on requests to view profitability ranking</p>
                    </div>
                  )}
                </div>
            </div>

            {/* Active Data Table */}
            <div className="card !border-none !rounded-none">
              <div className="h-12 px-3 border-b border-surface-border dark:border-surface-dark-border bg-transparent flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active Demand Requests</h3>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300">
                    {sortedActiveRequests.length} active
                  </span>
                </div>
                <span className="text-2xs text-gray-400">
                  {dateRange.startDate || dateRange.endDate ? `Filtered: ${dateRange.label}` : 'Products gathering customer interest'}
                </span>
              </div>
              <div className="overflow-x-auto min-h-[160px]">
                <table className="w-full text-left text-xs min-w-[900px]">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-2xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                    <tr>
                      <th scope="col" className="p-3 cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-1">
                          {t('product_name', 'Product Info')} {getSortIcon('name')}
                        </div>
                      </th>
                      <th scope="col" className="p-3 text-right w-28 cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none" onClick={() => handleSort('buying_price')}>
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          Buy Price {getSortIcon('buying_price')}
                        </div>
                      </th>
                      <th scope="col" className="p-3 text-right w-28 cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none" onClick={() => handleSort('price')}>
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          Sell Price {getSortIcon('price')}
                        </div>
                      </th>
                      <th scope="col" className="p-3 text-center w-24 cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none" onClick={() => handleSort('request_count')}>
                        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                          <Users size={12} className="opacity-60" />
                          Demand {getSortIcon('request_count')}
                        </div>
                      </th>
                      <th scope="col" className="p-3 text-center w-36 cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none" onClick={() => handleSort('projected_profit')}>
                        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                          <DollarSign size={12} className="opacity-60" />
                          Projected Profit {getSortIcon('projected_profit')}
                        </div>
                      </th>
                      <th scope="col" className="p-3 whitespace-nowrap w-28 cursor-pointer hover:text-gray-900 dark:hover:text-white transition select-none" onClick={() => handleSort('created_at')}>
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="opacity-60" />
                          Created {getSortIcon('created_at')}
                        </div>
                      </th>
                      <th scope="col" className="p-3 text-right whitespace-nowrap w-72 min-w-[280px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {sortedActiveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400">
                          <Package size={28} className="mx-auto mb-2 opacity-30 text-gray-400" />
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                            {dateRange.startDate || dateRange.endDate ? `No active demands in ${dateRange.label}` : 'No active demands'}
                          </p>
                          <p className="text-3xs text-gray-400 mt-0.5">
                            {dateRange.startDate || dateRange.endDate 
                              ? `No active customer demands were recorded during "${dateRange.label}".`
                              : 'All customer demand requests have been fulfilled or none have been created yet.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      sortedActiveRequests.map((req) => {
                        const sell = parseFloat(req.price || '0') || 0;
                        const buy = parseFloat(req.buying_price || '0') || 0;
                        const unitProfit = Math.max(0, sell - buy);
                        const projProfit = unitProfit * (req.request_count || 0);
                        const isTop = topProfitableProduct && topProfitableProduct.id === req.id && projProfit > 0;

                        return (
                          <tr key={req.id} className={`hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition ${actionDropdownId === req.id ? 'relative z-20' : ''}`}>
                            <td className="p-3 align-middle min-w-[200px]">
                              <div className="flex items-center gap-3">
                                <ProductRequestThumbnail src={req.image} alt={req.name} />
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-gray-900 dark:text-white truncate" title={req.name}>{req.name}</p>
                                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-2xs text-gray-400 dark:text-gray-500 mt-0.5">
                                    {req.category_name && <span className="truncate">{req.category_name}</span>}
                                    {req.condition && <span>• {req.condition}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-right align-middle whitespace-nowrap w-28 font-mono text-xs">
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {req.buying_price ? formatCompactCurrency(req.buying_price) : '--'}
                              </span>
                            </td>
                            <td className="p-3 text-right align-middle whitespace-nowrap w-28 font-mono text-xs">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {req.price ? formatCompactCurrency(req.price) : '--'}
                              </span>
                            </td>
                            <td className="p-3 text-center align-middle whitespace-nowrap w-24">
                              <span className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                                {req.request_count}
                              </span>
                            </td>
                            <td className="p-3 text-center align-middle whitespace-nowrap w-36">
                              {sell > 0 && projProfit > 0 ? (
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                                      {formatCompactCurrency(projProfit)}
                                    </span>
                                    {isTop && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="Highest projected return">
                                        #1 Return
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                    {formatCompactCurrency(unitProfit)}/ea
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">--</span>
                              )}
                            </td>
                            <td className="p-3 text-2xs text-gray-400 dark:text-gray-500 align-middle whitespace-nowrap w-28">
                              {req.created_at ? new Date(req.created_at).toLocaleDateString() : '--'}
                            </td>
                            <td className="p-3 text-right align-middle whitespace-nowrap w-72 min-w-[280px]">
                              <div className="flex justify-end gap-1.5 items-center">
                                <Button 
                                  type="button"
                                  size="sm" 
                                  variant="ghost"
                                  className="text-xs py-1 px-2.5 whitespace-nowrap shrink-0 flex items-center gap-1 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/5 rounded-btn transition-colors"
                                  onClick={() => handleEditClick(req)}
                                >
                                  <Edit size={12} className="shrink-0" /> Edit
                                </Button>

                                <div 
                                  className="inline-flex items-center h-8 rounded-btn bg-transparent hover:bg-surface-muted/40 dark:hover:bg-white/[0.04] transition-colors shrink-0 select-none"
                                  title={`Record +${getDemandAmount(req.id)} customer demand`}
                                >
                                  <button
                                    type="button"
                                    disabled={votingId === req.id}
                                    onClick={() => handleIncrementDemand(req)}
                                    className="h-full pl-1.5 pr-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white active:scale-90 transition-colors flex items-center justify-center shrink-0 disabled:opacity-50"
                                    title={`Add ${getDemandAmount(req.id)} demand`}
                                  >
                                    <Plus size={12} className="shrink-0" />
                                  </button>

                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={demandAmounts[req.id] ?? '1'}
                                    onChange={(e) => handleDemandAmountChange(req.id, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={() => handleDemandAmountBlur(req.id)}
                                    onKeyDown={(e) => handleDemandKeyDown(e, req)}
                                    disabled={votingId === req.id}
                                    className="w-6 h-6 text-center font-bold font-mono text-xs bg-transparent hover:bg-surface-muted/60 dark:hover:bg-white/10 focus:bg-surface-muted/80 dark:focus:bg-white/10 rounded text-gray-900 dark:text-white outline-none transition-colors px-0 cursor-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    title="Demand quantity (Default: 1. Press Up/Down to adjust, Enter to submit)"
                                  />

                                  <button
                                    type="button"
                                    disabled={votingId === req.id}
                                    onClick={() => handleIncrementDemand(req)}
                                    className="h-full pl-0.5 pr-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white active:scale-95 transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
                                    title={`Record +${getDemandAmount(req.id)} customer demand`}
                                  >
                                    {votingId === req.id ? (
                                      <Loader2 size={12} className="animate-spin text-brand-500 shrink-0" />
                                    ) : (
                                      <span>Demand</span>
                                    )}
                                  </button>
                                </div>

                                <div className="relative inline-block text-left action-dropdown-container">
                                  <button
                                    type="button"
                                    onClick={() => setActionDropdownId(actionDropdownId === req.id ? null : req.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-semibold bg-neutral-900 hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    <ArrowRightCircle size={12} className="shrink-0" />
                                    <span>Convert</span>
                                    <ChevronDown size={12} className={`transition-transform duration-200 ${actionDropdownId === req.id ? 'rotate-180' : ''}`} />
                                  </button>

                                  {actionDropdownId === req.id && (
                                    <div className="absolute inset-x-0 top-full mt-1 w-full rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-lg z-50 p-0.5 flex flex-col whitespace-normal animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionDropdownId(null);
                                          handleConvert(req);
                                        }}
                                        className="w-full text-center px-1 py-1 rounded text-[9.5px] font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition cursor-pointer whitespace-nowrap tracking-tight"
                                      >
                                        Convert to Product
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCancelDemand(req)}
                                        className="w-full text-center px-1 py-1 rounded text-[9.5px] font-semibold text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer whitespace-nowrap tracking-tight"
                                      >
                                        Cancel Demand
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {sortedActiveRequests.length > 0 && (
                    <tfoot className="bg-neutral-50 dark:bg-neutral-900/60 font-semibold border-t-2 border-surface-border dark:border-surface-dark-border">
                      <tr>
                        <td className="p-3 align-middle min-w-[200px]">
                          <div className="font-bold text-gray-900 dark:text-white text-xs">Total Active Demands</div>
                          <div className="text-3xs text-gray-400 font-normal">{sortedActiveRequests.length} products</div>
                        </td>
                        <td className="p-3 text-right align-middle whitespace-nowrap w-28 font-mono">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                            {formatCompactCurrency(totalMissedCost)}
                          </div>
                          <div className="text-3xs text-gray-400 font-normal">total buy cost</div>
                        </td>
                        <td className="p-3 text-right align-middle whitespace-nowrap w-28 font-mono">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                            {formatCompactCurrency(projectedRevenue)}
                          </div>
                          <div className="text-3xs text-gray-400 font-normal">total sell value</div>
                        </td>
                        <td className="p-3 text-center align-middle whitespace-nowrap w-24">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                            {totalVotes}
                          </div>
                          <div className="text-3xs text-gray-400 font-normal">total votes</div>
                        </td>
                        <td className="p-3 text-center align-middle whitespace-nowrap w-36 font-mono">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {formatCompactCurrency(potentialProfit)}
                          </div>
                          <div className="text-3xs text-emerald-600/70 dark:text-emerald-400/70 font-normal">total profit</div>
                        </td>
                        <td colSpan={2} className="p-3 text-right text-3xs text-gray-400 align-middle">
                          Overall Margin: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{profitMargin}%</span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Fulfilled Requests Table (In Inventory History) */}
            <div className="card overflow-hidden !border-none !rounded-none">
              <div className="h-12 px-3 border-b border-surface-border dark:border-surface-dark-border bg-transparent flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Fulfilled Requests / History</h3>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300">
                    Converted & Cancelled
                  </span>
                </div>
                <span className="text-2xs text-gray-400">
                  {dateRange.startDate || dateRange.endDate ? `${sortedFulfilledRequests.length} in ${dateRange.label}` : `${sortedFulfilledRequests.length} historical items`}
                </span>
              </div>

              {sortedFulfilledRequests.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30 text-emerald-500" />
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {dateRange.startDate || dateRange.endDate ? `No fulfilled requests in ${dateRange.label}` : 'No fulfilled requests yet'}
                  </p>
                  <p className="text-3xs text-gray-400 mt-0.5">
                    {dateRange.startDate || dateRange.endDate 
                      ? `No demand requests in your inventory history match "${dateRange.label}".`
                      : 'When active demand requests are converted into inventory, they will appear here as history.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[800px]">
                    <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-2xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                      <tr>
                        <th scope="col" className="p-3">
                          {t('product_name', 'Product Info')}
                        </th>
                        <th scope="col" className="p-3 text-right w-28">Buy Price</th>
                        <th scope="col" className="p-3 text-right w-28">Sell Price</th>
                        <th scope="col" className="p-3 text-center w-24">Final Demand</th>
                        <th scope="col" className="p-3 text-center w-36">Realized / Proj. Profit</th>
                        <th scope="col" className="p-3 whitespace-nowrap w-28">Created</th>
                        <th scope="col" className="p-3 text-right whitespace-nowrap w-36">Record</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                      {sortedFulfilledRequests.map((req) => {
                        const sell = parseFloat(req.price || '0') || 0;
                        const buy = parseFloat(req.buying_price || '0') || 0;
                        const unitProfit = Math.max(0, sell - buy);
                        const projProfit = unitProfit * (req.request_count || 0);

                        return (
                          <tr key={req.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition opacity-85 hover:opacity-100">
                            <td className="p-3 align-middle min-w-[200px]">
                              <div className="flex items-center gap-3">
                                <ProductRequestThumbnail src={req.image} alt={req.name} />
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-gray-900 dark:text-white truncate" title={req.name}>{req.name}</p>
                                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-2xs text-gray-400 dark:text-gray-500 mt-0.5">
                                    {req.category_name && <span className="truncate">{req.category_name}</span>}
                                    {req.condition && <span>• {req.condition}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-right align-middle whitespace-nowrap w-28 font-mono text-xs">
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {req.buying_price ? formatCompactCurrency(req.buying_price) : '--'}
                              </span>
                            </td>
                            <td className="p-3 text-right align-middle whitespace-nowrap w-28 font-mono text-xs">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {req.price ? formatCompactCurrency(req.price) : '--'}
                              </span>
                            </td>
                            <td className="p-3 text-center align-middle whitespace-nowrap w-24">
                              <span className="font-semibold text-xs text-gray-700 dark:text-gray-300">
                                {req.request_count}
                              </span>
                            </td>
                            <td className="p-3 text-center align-middle whitespace-nowrap w-36">
                              {!req.is_cancelled && sell > 0 && projProfit > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                                    {formatCompactCurrency(projProfit)}
                                  </span>
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                    {formatCompactCurrency(unitProfit)}/ea
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs font-mono">--</span>
                              )}
                            </td>
                            <td className="p-3 text-2xs text-gray-400 dark:text-gray-500 align-middle whitespace-nowrap w-28">
                              {req.created_at ? new Date(req.created_at).toLocaleDateString() : '--'}
                            </td>
                            <td className="p-3 text-right align-middle whitespace-nowrap w-36">
                              {req.is_cancelled ? (
                                <span className="inline-flex items-center gap-1 text-2xs text-rose-500 font-medium">
                                  <XCircle size={13} className="text-rose-500 shrink-0" /> Cancelled
                                </span>
                              ) : req.fulfilled_product_slug ? (
                                <a
                                  href={`/products/${req.fulfilled_product_slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-2xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                                  title="View converted product"
                                >
                                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                  <span>Converted</span>
                                  <ExternalLink size={10} className="shrink-0 opacity-70" />
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-2xs text-gray-400 dark:text-gray-500 font-medium">
                                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Converted
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-neutral-50 dark:bg-neutral-900/60 font-semibold border-t-2 border-surface-border dark:border-surface-dark-border">
                      <tr>
                        <td className="p-3 align-middle min-w-[200px]">
                          <div className="font-bold text-gray-900 dark:text-white text-xs">Total History</div>
                          <div className="text-3xs text-gray-400 font-normal">{sortedFulfilledRequests.length} items</div>
                        </td>
                        <td className="p-3 text-right align-middle whitespace-nowrap w-28 font-mono">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                            {formatCompactCurrency(fulfilledCost)}
                          </div>
                          <div className="text-3xs text-gray-400 font-normal">fulfilled cost</div>
                        </td>
                        <td className="p-3 text-right align-middle whitespace-nowrap w-28 font-mono">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                            {formatCompactCurrency(fulfilledRevenue)}
                          </div>
                          <div className="text-3xs text-gray-400 font-normal">fulfilled revenue</div>
                        </td>
                        <td className="p-3 text-center align-middle whitespace-nowrap w-24">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                            {fulfilledVotes}
                          </div>
                          <div className="text-3xs text-gray-400 font-normal">total votes</div>
                        </td>
                        <td className="p-3 text-center align-middle whitespace-nowrap w-36 font-mono">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {formatCompactCurrency(fulfilledProfit)}
                          </div>
                          <div className="text-3xs text-emerald-600/70 dark:text-emerald-400/70 font-normal">realized profit</div>
                        </td>
                        <td colSpan={2} className="p-3 text-right text-3xs text-gray-400 align-middle">
                          Historical Record
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
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

      {/* Hidden Isolated Print Canvas for Demand Analytics (Processed via printElement) */}
      <div className="hidden">
        <div ref={printDemandRef} className="p-4 bg-white text-black font-sans w-full">
          <ReportPrintHeader 
            title={`Demand Analytics Report${dateRange.startDate || dateRange.endDate ? ` (${dateRange.label})` : ''}`} 
            user={user} 
            logoUrl="/logo_dark.png"
          />
          
          <table className="w-full text-left text-xs border-collapse table-fixed mt-6">
            <thead>
              <tr className="border-b-2 border-black bg-gray-100/70 text-black">
                <th className="py-2 px-1 w-10 font-black">S/N</th>
                <th className="py-2 px-2 w-auto font-black">PRODUCT</th>
                <th className="py-2 px-2 w-32 font-black">CATEGORY</th>
                <th className="py-2 px-2 w-16 font-black text-center">VOTES</th>
                <th className="py-2 px-2 w-28 font-black text-right">EST. COST (TSH)</th>
                <th className="py-2 px-2 w-28 font-black text-right">EST. PRICE (TSH)</th>
                <th className="py-2 px-2 w-28 font-black text-right">PROJ. PROFIT (TSH)</th>
                <th className="py-2 px-2 w-20 font-black text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedRequests.map((req, idx) => (
                <tr key={req.id} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td className="py-2 px-1 font-bold text-gray-500">{idx + 1}</td>
                  <td className="py-2 px-2 font-bold text-black">{req.name}</td>
                  <td className="py-2 px-2 text-gray-600">{req.category_name || '-'}</td>
                  <td className="py-2 px-2 text-center font-bold">{req.request_count}</td>
                  <td className="py-2 px-2 text-right font-mono">{req.buying_price ? parseFloat(req.buying_price).toLocaleString() : '-'}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold">{req.price ? parseFloat(req.price).toLocaleString() : '-'}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-emerald-800">
                    {!req.is_cancelled && req.price && req.buying_price ? Math.max(0, (parseFloat(req.price) - parseFloat(req.buying_price)) * (req.request_count || 0)).toLocaleString() : '-'}
                  </td>
                  <td className="py-2 px-2 text-center font-semibold">{req.is_cancelled ? 'Cancelled' : (req.is_fulfilled ? 'Fulfilled' : 'Active')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-black bg-gray-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <td colSpan={5} className="py-2 px-2 text-right uppercase text-xs">TOTAL MISSED COST:</td>
                <td colSpan={3} className="py-2 px-2 text-right font-mono text-rose-700 font-black">
                  {totalMissedCost.toLocaleString()} TZS
                </td>
              </tr>
              <tr className="font-black bg-gray-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <td colSpan={5} className="py-2 px-2 text-right uppercase text-xs">PROJECTED REVENUE:</td>
                <td colSpan={3} className="py-2 px-2 text-right font-mono text-emerald-700 font-black">
                  {projectedRevenue.toLocaleString()} TZS
                </td>
              </tr>
              <tr className="font-black border-t border-gray-200 bg-gray-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <td colSpan={5} className="py-2 px-2 text-right uppercase text-xs">POTENTIAL PROFIT:</td>
                <td colSpan={3} className="py-2 px-2 text-right font-mono text-brand-500 font-black">
                  {potentialProfit.toLocaleString()} TZS
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductRequestsBoard;
