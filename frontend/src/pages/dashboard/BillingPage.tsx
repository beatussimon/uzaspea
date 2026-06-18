import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Receipt, Smartphone, Upload, CheckCircle2, X, Wallet, ArrowDownRight, Clock } from 'lucide-react';

const BillingPage: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'invoices' | 'ledger'>('invoices');

  // Pay Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [adminLipa, setAdminLipa] = useState<any[]>([]);
  const [loadingPaymentData, setLoadingPaymentData] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [refId, setRefId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, ledRes] = await Promise.all([
        api.get('/api/billing/invoices/'),
        api.get('/api/billing/ledger/')
      ]);
      setInvoices(invRes.data.results || invRes.data || []);
      setLedger(ledRes.data.results || ledRes.data || []);
    } catch {
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenPayModal = async (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowPayModal(true);
    setLoadingPaymentData(true);
    try {
      const res = await api.get('/api/lipa-numbers/?seller=admin');
      setAdminLipa(res.data.results || res.data || []);
    } catch {
      toast.error('Failed to load payment options');
    } finally {
      setLoadingPaymentData(false);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (!refId) return toast.error('Please enter the transaction reference');
    if (!proofFile) return toast.error('Please upload proof of payment screenshot');

    setSubmittingPayment(true);
    const fd = new FormData();
    fd.append('amount', selectedInvoice.total_commission);
    fd.append('transaction_id', refId);
    fd.append('receipt_screenshot', proofFile);

    try {
      await api.post(`/api/billing/${selectedInvoice.id}/pay_invoice/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Commission payment submitted successfully! Staff will verify it shortly.');
      setShowPayModal(false);
      setRefId('');
      setProofFile(null);
      setSelectedInvoice(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit payment details');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const formatMonth = (year: number, month: number) => {
    const date = new Date(year, month - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full uppercase">Paid</span>;
      case 'PENDING_REVIEW':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full uppercase">Pending Review</span>;
      case 'OVERDUE':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full uppercase">Overdue</span>;
      default:
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full uppercase">Unpaid</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="text-brand-600" size={24} /> Billing & Commission
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage your platform fees, commission ledger, and monthly payouts.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-3.5 border-b-2 text-sm font-bold transition-all ${
              activeTab === 'invoices'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Monthly Invoices
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`py-3.5 border-b-2 text-sm font-bold transition-all ${
              activeTab === 'ledger'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Commission Ledger
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : activeTab === 'invoices' ? (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
              <Receipt size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">No invoices generated yet.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">
                      <th className="p-4">Billing Period</th>
                      <th className="p-4 text-right">Orders Value</th>
                      <th className="p-4 text-right">Commission Due</th>
                      <th className="p-4">Due Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                        <td className="p-4 font-bold text-gray-900 dark:text-white">
                          {formatMonth(inv.year, inv.month)}
                        </td>
                        <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                          TSh {Number(inv.total_order_amount).toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-brand-600 font-bold">
                          TSh {Number(inv.total_commission).toLocaleString()}
                        </td>
                        <td className="p-4 text-gray-500 dark:text-gray-400">
                          {new Date(inv.due_date).toLocaleDateString()}
                        </td>
                        <td className="p-4">{getStatusBadge(inv.status)}</td>
                        <td className="p-4 text-center">
                          {(inv.status === 'UNPAID' || inv.status === 'OVERDUE') ? (
                            <button
                              onClick={() => handleOpenPayModal(inv)}
                              className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded font-bold transition text-[11px]"
                            >
                              Pay Now
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {ledger.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
              <ArrowDownRight size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">No ledger transactions recorded.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">
                      <th className="p-4">Date</th>
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Type</th>
                      <th className="p-4 text-right">Order Amount</th>
                      <th className="p-4 text-right">Rate</th>
                      <th className="p-4 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {ledger.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                        <td className="p-4 text-gray-500 dark:text-gray-400">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 font-bold text-gray-900 dark:text-white">
                          #{entry.order_id}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">
                          {entry.entry_type === 'COMMISSION' ? 'Platform Commission' : 'Cancellation Fee'}
                        </td>
                        <td className="p-4 text-right text-gray-600 dark:text-gray-300">
                          TSh {Number(entry.order_amount).toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-gray-500 dark:text-gray-400">
                          {Number(entry.commission_rate)}%
                        </td>
                        <td className="p-4 text-right font-bold text-brand-600">
                          TSh {Number(entry.commission_amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pay Invoice Modal */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border dark:border-gray-700 animate-scale-in my-8">
            <button
              onClick={() => { setShowPayModal(false); setSelectedInvoice(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">Pay Commission Invoice</h3>

            {loadingPaymentData ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
              </div>
            ) : (
              <form onSubmit={handlePaySubmit} className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30 rounded-xl">
                  <div>
                    <p className="text-xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider leading-none">Invoice Period</p>
                    <h4 className="font-black text-gray-900 dark:text-white capitalize text-sm mt-1">{formatMonth(selectedInvoice.year, selectedInvoice.month)}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 leading-none">Commission Due</p>
                    <p className="font-black text-brand-600 text-sm mt-1">TSh {Number(selectedInvoice.total_commission).toLocaleString()}</p>
                  </div>
                </div>

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

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Transaction ID / Reference</label>
                    <input
                      type="text"
                      required
                      value={refId}
                      onChange={(e) => setRefId(e.target.value)}
                      placeholder="e.g. PP260618.1746"
                      className="input text-sm h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Receipt Screenshot</label>
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
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                  >
                    {submittingPayment ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 size={18} />}
                    Submit Payment Details
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
