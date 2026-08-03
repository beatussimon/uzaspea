import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { FileText, Download, Edit3, CheckCircle, Clock } from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

const InvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/orders/incoming/?status=REQUESTED_INVOICE');
      const res2 = await api.get('/api/orders/incoming/?status=INVOICE_GENERATED');
      const data1 = res.data.results || res.data;
      const data2 = res2.data.results || res2.data;
      setOrders([...data1, ...data2].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedOrder) return;
    try {
      setIsGenerating(true);
      await api.post(`/api/orders/${selectedOrder.id}/generate-invoice/`, { prices });
      toast.success(t('invoice_generated', 'Invoice generated successfully!'));
      setSelectedOrder(null);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('error_generating_invoice', 'Failed to generate invoice.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const openQuoteModal = (order: any) => {
    setSelectedOrder(order);
    const initialPrices: Record<string, string> = {};
    (order.relevant_items || []).forEach((item: any) => {
      initialPrices[item.id] = String(item.price || 0);
    });
    setPrices(initialPrices);
  };

  const handlePrint = (order: any) => {
    // Generate a simple print view
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;
    
    const html = `
      <html>
        <head>
          <title>Invoice #${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f8f9fa; }
            .total { font-weight: bold; font-size: 1.2em; text-align: right; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice</h1>
            <p>Order #${order.id}</p>
            <p>Date: ${new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit Price (TSh)</th>
                <th>Subtotal (TSh)</th>
              </tr>
            </thead>
            <tbody>
              ${(order.relevant_items || []).map((item: any) => `
                <tr>
                  <td>${item.product_name} ${item.variant_name ? `(${item.variant_name})` : ''}</td>
                  <td>${item.quantity}</td>
                  <td>${Number(item.price).toLocaleString()}</td>
                  <td>${Number(item.subtotal).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">
            Total: TSh ${(order.relevant_items || []).reduce((sum: number, item: any) => sum + Number(item.subtotal), 0).toLocaleString()}
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('invoices', 'Invoices & Quotes')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('invoices_desc', 'Manage customer requests for quotes and generate invoices.')}
          </p>
        </div>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('no_invoices', 'No Invoices')}
          description={t('no_invoices_desc', 'You have no pending requests for quotes.')}
        />
      ) : (
        <div className="grid gap-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-bold text-gray-900 dark:text-white">Order #{order.id}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    order.status === 'REQUESTED_INVOICE' 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Clock size={14} /> {new Date(order.created_at).toLocaleString()}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(order.relevant_items || []).map((item: any) => (
                    <div key={item.id} className="bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      {item.quantity}x {item.product_name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                {order.status === 'REQUESTED_INVOICE' ? (
                  <Button onClick={() => openQuoteModal(order)} className="flex items-center gap-2 w-full md:w-auto">
                    <Edit3 size={16} />
                    {t('set_prices', 'Set Prices')}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => handlePrint(order)} className="flex items-center gap-2 w-full md:w-auto">
                    <Download size={16} />
                    {t('print_invoice', 'Print Invoice')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={t('generate_invoice', 'Generate Invoice')}>
          <div className="space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('enter_prices_desc', 'Enter the agreed unit prices for the requested items to generate an invoice.')}
            </p>
            
            <div className="space-y-4">
              {(selectedOrder.relevant_items || []).map((item: any) => (
                <div key={item.id} className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-gray-900 dark:text-white flex justify-between">
                    <span>{item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}</span>
                    <span className="text-gray-500 font-normal">Qty: {item.quantity}</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">TSh</span>
                    <input
                      type="number"
                      min="0"
                      value={prices[item.id] || ''}
                      onChange={(e) => setPrices({ ...prices, [item.id]: e.target.value })}
                      className="w-full pl-12 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setSelectedOrder(null)}>{t('cancel', 'Cancel')}</Button>
              <Button onClick={handleGenerateInvoice} loading={isGenerating} className="flex items-center gap-2">
                <CheckCircle size={16} />
                {t('generate_invoice', 'Generate Invoice')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default InvoicesPage;
