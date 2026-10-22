import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  ArrowLeftRight, Plus, CheckCircle2, 
  Search, ChevronDown, MapPin, Send, ArrowRight
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardListSkeleton } from '../../components/Skeleton';

interface TransferItem {
  id?: number;
  product_id: number;
  product_name?: string;
  product_image?: string;
  variant_id?: number | null;
  variant_name?: string | null;
  quantity_dispatched: number;
  quantity_received?: number;
  notes?: string;
}

interface StockTransfer {
  id: number;
  tracking_number: string;
  source_location: number;
  source_location_name: string;
  destination_location: number;
  destination_location_name: string;
  status: 'draft' | 'in_transit' | 'completed' | 'cancelled';
  notes: string;
  items: TransferItem[];
  created_at: string;
  dispatched_at: string | null;
  received_at: string | null;
  dispatched_by_username?: string;
  received_by_username?: string;
}

export const StockTransfersPage: React.FC = () => {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // New Transfer Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [sourceLoc, setSourceLoc] = useState<number | ''>('');
  const [destLoc, setDestLoc] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<{ product_id: number; name: string; max_stock: number; qty: number }[]>([]);
  const [sourceProducts, setSourceProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);

  // Receive Modal State
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [receiving, setReceiving] = useState(false);

  const fetchTransfers = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/stock-transfers/').then(res => {
        const data = res.data.results || res.data || [];
        setTransfers(Array.isArray(data) ? data : []);
      }),
      api.get('/api/locations/').then(res => {
        const data = res.data.results || res.data || [];
        setLocations(Array.isArray(data) ? data : []);
      })
    ]).catch(() => {
      toast.error('Failed to load stock transfers');
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  // When source location changes in Add modal, load its inventory
  useEffect(() => {
    if (!sourceLoc) {
      setSourceProducts([]);
      return;
    }
    setLoadingProducts(true);
    api.get(`/api/locations/${sourceLoc}/inventory/`)
      .then(res => {
        const list = res.data.results || res.data || [];
        setSourceProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [sourceLoc]);

  const handleOpenNewModal = () => {
    if (locations.length < 2) {
      toast.error('You need at least two store branches to initiate stock transfers.');
      return;
    }
    setSourceLoc(locations[0]?.id || '');
    setDestLoc(locations[1]?.id || '');
    setNotes('');
    setLineItems([]);
    setModalOpen(true);
  };

  const handleAddLineItem = (prod: any) => {
    if (lineItems.some(i => i.product_id === prod.product)) {
      toast.error('Product already added to this transfer manifest');
      return;
    }
    setLineItems([...lineItems, {
      product_id: prod.product,
      name: prod.product_name,
      max_stock: Number(prod.quantity || 0),
      qty: 1
    }]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleCreateTransfer = async (dispatchImmediate = false) => {
    if (!sourceLoc || !destLoc) {
      toast.error('Please select both source and destination branches');
      return;
    }
    if (sourceLoc === destLoc) {
      toast.error('Source and destination cannot be the same branch');
      return;
    }
    if (lineItems.length === 0) {
      toast.error('Add at least one product to transfer');
      return;
    }

    setSavingTransfer(true);
    try {
      const payload = {
        source_location: Number(sourceLoc),
        destination_location: Number(destLoc),
        notes,
        items: lineItems.map(item => ({
          product_id: item.product_id,
          quantity_dispatched: Number(item.qty)
        }))
      };

      const res = await api.post('/api/stock-transfers/', payload);
      const newTransfer = res.data;

      if (dispatchImmediate) {
        await api.post(`/api/stock-transfers/${newTransfer.id}/dispatch/`);
        toast.success(`Transfer ${newTransfer.tracking_number} created and dispatched!`);
      } else {
        toast.success(`Transfer ${newTransfer.tracking_number} saved as Draft`);
      }

      setModalOpen(false);
      fetchTransfers();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to create transfer';
      toast.error(String(msg));
    } finally {
      setSavingTransfer(false);
    }
  };

  const handleDispatch = async (t: StockTransfer) => {
    if (!window.confirm(`Dispatch transfer ${t.tracking_number} from ${t.source_location_name}? Stock will be decremented from source immediately.`)) {
      return;
    }
    try {
      await api.post(`/api/stock-transfers/${t.id}/dispatch/`);
      toast.success(`Transfer ${t.tracking_number} is now in transit`);
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dispatch transfer');
    }
  };

  const openReceiveModal = (t: StockTransfer) => {
    setSelectedTransfer(t);
    const initialQtys: Record<string, number> = {};
    (t.items || []).forEach(item => {
      if (item.id) {
        initialQtys[String(item.id)] = Number(item.quantity_dispatched);
      }
    });
    setReceiveQuantities(initialQtys);
    setReceiveModalOpen(true);
  };

  const handleConfirmReceive = async () => {
    if (!selectedTransfer) return;
    setReceiving(true);
    try {
      await api.post(`/api/stock-transfers/${selectedTransfer.id}/receive/`, {
        quantities: receiveQuantities
      });
      toast.success(`Transfer ${selectedTransfer.tracking_number} received and stock updated!`);
      setReceiveModalOpen(false);
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to receive stock');
    } finally {
      setReceiving(false);
    }
  };

  const handleCancelTransfer = async (t: StockTransfer) => {
    if (!window.confirm(`Cancel transfer ${t.tracking_number}? Any in-transit items will be restored to source stock.`)) {
      return;
    }
    try {
      await api.post(`/api/stock-transfers/${t.id}/cancel/`);
      toast.success(`Transfer ${t.tracking_number} cancelled`);
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel transfer');
    }
  };

  const filteredTransfers = transfers.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTrack = t.tracking_number.toLowerCase().includes(q);
      const matchSource = (t.source_location_name || '').toLowerCase().includes(q);
      const matchDest = (t.destination_location_name || '').toLowerCase().includes(q);
      if (!matchTrack && !matchSource && !matchDest) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2 flex-nowrap min-w-0 min-h-[36px]">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap shrink-0">
            <span className="sm:hidden">Stock Transfers</span>
            <span className="hidden sm:inline">Inter-Branch Stock Transfers</span>
          </h1>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleOpenNewModal}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-btn shadow-xs shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New Transfer</span>
          </Button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
          Move inventory between retail branches and warehouses with full dispatch and receipt auditing.
        </p>
      </header>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          {[
            { key: 'all', label: 'All Transfers' },
            { key: 'draft', label: 'Draft' },
            { key: 'in_transit', label: 'In Transit' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map(tab => {
            const isActive = filterStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
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

        <div className="relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transfer # or branch..."
            className="w-full pl-8 pr-4 py-1.5 text-xs font-semibold rounded-full bg-surface-muted dark:bg-[#161616] text-gray-900 dark:text-white placeholder:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 border-0 outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-neutral-700 transition"
          />
        </div>
      </div>

      {/* Transfers List */}
      {loading ? (
        <CardListSkeleton count={3} />
      ) : filteredTransfers.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No stock transfers found"
          description={filterStatus !== 'all' ? `No transfers with status "${filterStatus}".` : "Dispatch stock between your store locations to replenish inventory."}
          action={{
            label: "Create Stock Transfer",
            onClick: handleOpenNewModal
          }}
        />
      ) : (
        <div className="space-y-3">
          {filteredTransfers.map((t) => {
            const isExpanded = expandedId === t.id;
            const itemsCount = t.items?.length || 0;
            const totalUnits = (t.items || []).reduce((acc, i) => acc + Number(i.quantity_dispatched || 0), 0);

            const statusColors = {
              draft: 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-300',
              in_transit: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
              completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
              cancelled: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
            }[t.status];

            return (
              <div
                key={t.id}
                className="card !border-none overflow-hidden transition-all duration-200 bg-white dark:bg-neutral-900 rounded-2xl shadow-xs"
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-neutral-800/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-white font-mono">
                        {t.tracking_number}
                      </span>
                      <span className={`text-3xs font-bold uppercase px-2.5 py-0.5 rounded-full ${statusColors}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                      <span className="text-3xs text-gray-400">
                        {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Routing */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200 pt-0.5">
                      <span className="flex items-center gap-1 text-gray-600 dark:text-neutral-400">
                        <MapPin size={12} className="text-gray-400 dark:text-neutral-500" />
                        {t.source_location_name}
                      </span>
                      <ArrowRight size={13} className="text-gray-400" />
                      <span className="flex items-center gap-1 text-gray-900 dark:text-white font-bold">
                        <MapPin size={12} className="text-gray-400 dark:text-neutral-500" />
                        {t.destination_location_name}
                      </span>
                    </div>
                  </div>

                  {/* Right side items info & actions */}
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {itemsCount} {itemsCount === 1 ? 'Product' : 'Products'}
                      </div>
                      <div className="text-3xs text-gray-400">
                        {totalUnits} units total
                      </div>
                    </div>

                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Collapsible Details Manifest */}
                {isExpanded && (
                  <div className="p-4 border-0 space-y-4">
                    {t.notes && (
                      <p className="text-xs text-gray-600 dark:text-neutral-400 italic">
                        &ldquo;{t.notes}&rdquo;
                      </p>
                    )}

                    {/* Itemized Table */}
                    <div className="overflow-x-auto rounded-xl border-0">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-100 dark:bg-neutral-800 text-3xs font-bold uppercase tracking-wider text-gray-500">
                          <tr>
                            <th className="px-3 py-2">Product Name</th>
                            <th className="px-3 py-2 text-right">Dispatched</th>
                            <th className="px-3 py-2 text-right">Received</th>
                            <th className="px-3 py-2">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-neutral-900">
                          {(t.items || []).map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white">
                                {item.product_name || `Product #${item.product_id}`}
                                {item.variant_name && <span className="text-3xs text-gray-400 ml-1">({item.variant_name})</span>}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                                {item.quantity_dispatched}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {item.quantity_received ?? '—'}
                              </td>
                              <td className="px-3 py-2.5 text-3xs text-gray-400">
                                {item.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-3xs text-gray-400">
                        {t.dispatched_at && (
                          <span>Dispatched {new Date(t.dispatched_at).toLocaleString()}</span>
                        )}
                        {t.received_at && (
                          <span className="ml-2">• Received {new Date(t.received_at).toLocaleString()}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {t.status === 'draft' && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelTransfer(t)}
                              className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => handleDispatch(t)}
                              className="text-xs flex items-center gap-1.5"
                            >
                              <Send size={13} />
                              <span>Dispatch Inventory</span>
                            </Button>
                          </>
                        )}

                        {t.status === 'in_transit' && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelTransfer(t)}
                              className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              Return / Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => openReceiveModal(t)}
                              className="text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle2 size={13} />
                              <span>Accept & Receive Stock</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Transfer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#141414] rounded-3xl max-w-xl w-full p-6 space-y-5 border-0 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Create Inter-Branch Transfer
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {/* Branch Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Source Branch (Dispatch From) *
                  </label>
                  <select
                    value={sourceLoc}
                    onChange={(e) => {
                      setSourceLoc(Number(e.target.value));
                      setLineItems([]);
                    }}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.is_main ? '(HQ)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Destination Branch (Receive At) *
                  </label>
                  <select
                    value={destLoc}
                    onChange={(e) => setDestLoc(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                  >
                    {locations.filter(l => l.id !== Number(sourceLoc)).map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.is_main ? '(HQ)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Transfer Notes / Waybill Reference
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Weekly replenishment for Sinza store"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                />
              </div>

              {/* Product Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Select Products from Source Branch ({sourceProducts.length} Available)
                </label>
                {loadingProducts ? (
                  <p className="text-xs text-gray-400">Loading branch inventory...</p>
                ) : sourceProducts.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1f1f1f] p-2.5 rounded-xl">
                    No available stock records found at the selected source branch.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl bg-gray-50 dark:bg-white/5 divide-y divide-gray-100/60 dark:divide-white/5 border-0">
                    {sourceProducts.map(p => (
                      <div key={p.id} className="p-2 flex items-center justify-between text-xs hover:bg-gray-100/60 dark:hover:bg-white/5">
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-white">{p.product_name}</span>
                          <span className="text-3xs text-gray-400 ml-2">Stock: {p.quantity}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddLineItem(p)}
                          className="px-2.5 py-1 text-2xs font-bold rounded-lg bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-white/20 cursor-pointer"
                        >
                          + Add Item
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Added Line Items Table */}
              {lineItems.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Transfer Manifest ({lineItems.length} Products)
                  </span>
                  <div className="rounded-xl bg-gray-50 dark:bg-white/5 overflow-hidden border-0">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-100 dark:bg-white/10 text-3xs uppercase font-bold text-gray-500">
                        <tr>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2 w-28 text-center">Transfer Qty</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100/60 dark:divide-white/5">
                        {lineItems.map((item, index) => (
                          <tr key={item.product_id}>
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                              {item.name}
                              <span className="text-3xs text-gray-400 block">Available: {item.max_stock}</span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="number"
                                min={1}
                                max={item.max_stock}
                                value={item.qty}
                                onChange={(e) => {
                                  const val = Math.max(1, Math.min(item.max_stock, Number(e.target.value) || 1));
                                  setLineItems(lineItems.map((it, idx) => idx === index ? { ...it, qty: val } : it));
                                }}
                                className="w-20 px-2 py-1 text-center font-bold text-xs rounded-lg border-0 bg-white dark:bg-[#222222] text-gray-900 dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(index)}
                                className="text-gray-400 hover:text-red-500 text-sm font-bold p-1 cursor-pointer"
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={savingTransfer}
                  onClick={() => handleCreateTransfer(false)}
                >
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  loading={savingTransfer}
                  onClick={() => handleCreateTransfer(true)}
                  className="flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>Dispatch Now</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {receiveModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl max-w-lg w-full p-6 space-y-4 border-0 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-0">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-600" size={18} />
                  <span>Receive Inventory Manifest</span>
                </h2>
                <p className="text-3xs text-gray-400 font-mono mt-0.5">
                  Transfer #{selectedTransfer.tracking_number} &bull; Arrived at {selectedTransfer.destination_location_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg p-1"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300">
              Verify the quantities physically received at this branch. Stock will be credited immediately.
            </p>

            <div className="rounded-xl border-0 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-neutral-800 text-3xs uppercase font-bold text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-center w-24">Dispatched</th>
                    <th className="px-3 py-2 text-center w-28">Received Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedTransfer.items || []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                        {item.product_name}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-gray-600 dark:text-gray-400">
                        {item.quantity_dispatched}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={item.quantity_dispatched}
                          value={receiveQuantities[String(item.id)] ?? item.quantity_dispatched}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setReceiveQuantities({ ...receiveQuantities, [String(item.id)]: val });
                          }}
                          className="w-20 px-2 py-1 text-center font-bold text-xs rounded-lg border-0 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReceiveModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                loading={receiving}
                onClick={handleConfirmReceive}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Confirm Receipt & Credit Stock
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTransfersPage;
