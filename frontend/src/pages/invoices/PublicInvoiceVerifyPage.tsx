import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ShieldAlert, Printer, ArrowLeft, Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../api';
import { printElement } from '../../utils/printHelper';

interface InvoiceVerificationData {
  is_authentic: boolean;
  order_id: number;
  order_date: string;
  formatted_date: string;
  status: string;
  status_label: string;
  is_bulk_order: boolean;
  total_amount: number;
  shipping_fee: number;
  discount_amount: number;
  seller: {
    username: string;
    name: string;
    store_name: string;
    display_name: string;
    is_verified: boolean;
    tier: string;
  };
  buyer: {
    username: string;
    name: string;
  };
  items: Array<{
    id: number;
    product_name: string;
    variant_name?: string | null;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  payment: {
    has_payment: boolean;
    status?: string | null;
    payment_method?: string | null;
    transaction_id?: string | null;
    is_verified: boolean;
  };
  verification_token: string;
  sig_valid?: boolean | null;
  server_timestamp: string;
  detail?: string;
}

export const PublicInvoiceVerifyPage: React.FC = () => {
  const { t } = useTranslation();
  const { order_id } = useParams<{ order_id: string }>();
  const [searchParams] = useSearchParams();
  const sigParam = searchParams.get('sig') || '';

  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const [query, setQuery] = useState(order_id || '');
  const [data, setData] = useState<InvoiceVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const fetchVerification = async (id: string, sig = sigParam) => {
    const trimmed = id.trim().replace(/^#/, '');
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    setErrorDetail(null);
    try {
      const url = `/api/invoices/verify/${trimmed}/${sig ? `?sig=${encodeURIComponent(sig)}` : ''}`;
      const res = await api.get(url);
      setData(res.data);
    } catch (err: any) {
      setData(null);
      const msg = err.response?.data?.detail || t('invoice_not_found', 'No official invoice matches this record on SokoniMax servers.');
      setErrorDetail(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (order_id) {
      fetchVerification(order_id);
    }
  }, [order_id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      fetchVerification(query);
    }
  };

  const handlePrint = async () => {
    if (!printRef.current || !data) return;
    try {
      setIsPrinting(true);
      await printElement(printRef.current, {
        pageTitle: `SokoniMax Invoice #${data.order_id}`,
        pageStyle: '@page { size: A4 portrait; margin: 12mm 14mm; }',
      });
    } catch (err) {
      console.error('Failed to print invoice:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sokonimax.com';
  const verifyUrl = data ? `${origin}/verify/invoice/${data.order_id}${data.verification_token ? `?sig=${data.verification_token}` : ''}` : '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0c0c0c] text-gray-900 dark:text-gray-100 py-6 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Top Minimal Bar — Zero Clutter / Zero Outlines */}
        <div className="flex items-center justify-between gap-2 text-xs px-1">
          <Link to="/" className="inline-flex items-center gap-1.5 font-medium text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition shrink-0">
            <ArrowLeft size={14} />
            <span className="truncate max-w-[150px] xs:max-w-none">{t('back_to_marketplace', 'Back to Marketplace')}</span>
          </Link>
          {!loading && data && data.is_authentic && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-5 h-5 rounded-full bg-[#198754] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Check size={12} strokeWidth={3} className="text-white" />
              </span>
              <span className="text-2xs font-extrabold uppercase tracking-wider text-gray-800 dark:text-gray-200 shrink-0 whitespace-nowrap">
                <span>{t('verified_server_record', 'Verified Server Record')}</span>
                <span className="hidden sm:inline">&nbsp;• {t('no_tampering_detected', 'No Tampering Detected')}</span>
              </span>
            </div>
          )}
        </div>

        {/* Clean, Outline-Free Search Strip */}
        <div className="flex justify-center">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full max-w-sm">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-xs font-bold">#</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Verify invoice # (e.g. 99915)"
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#161616] text-gray-900 dark:text-white shadow-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-brand-500 hover:bg-brand-400 text-black font-extrabold text-xs rounded-xl transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              <span>{loading ? t('verifying', 'Checking...') : t('verify', 'Verify')}</span>
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="rounded-2xl p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('checking_tamper_records', 'Validating digital invoice against SokoniMax database...')}
            </p>
          </div>
        )}

        {/* Unverified / Fake Invoice Alert (Zero outline design) */}
        {!loading && searched && !data && (
          <div className="rounded-2xl p-8 sm:p-10 space-y-4 text-center max-w-lg mx-auto bg-white dark:bg-[#161616] shadow-xl dark:shadow-none border-0">
            <div className="flex items-center justify-center mx-auto text-[#dc2626]">
              <ShieldAlert size={36} strokeWidth={2.2} />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-black text-[#dc2626] uppercase tracking-wide">
                {t('unverified_invoice', 'Unverified / Invalid Invoice')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {errorDetail || t('invoice_not_found_desc', 'No matching invoice was found on SokoniMax servers. If you are holding a printed or PDF document with this number, it may have been fabricated, altered, or cancelled.')}
              </p>
            </div>
            <p className="text-3xs text-gray-400 font-medium">
              {t('contact_support_verify', 'For verification assistance, contact support@sokonimax.com or visit our Help Center.')}
            </p>
          </div>
        )}

        {/* Verified Authentic Invoice Layout — 100% IDENTICAL to Invoice Page */}
        {!loading && data && data.is_authentic && (
          <div className="space-y-4">

            {/* Actual Printable Invoice Container — Identical to PrintableInvoiceModal */}
            <div
              id="invoice-content"
              ref={printRef}
              className="bg-white dark:bg-[#161616] text-black dark:text-gray-100 p-4 sm:p-6 md:p-8 w-full max-w-2xl min-h-max mx-auto shadow-xl dark:shadow-none rounded-2xl relative font-sans border-0 print:bg-white print:text-black print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 print:max-w-none"
            >
              {/* Header Row */}
              <div className="flex justify-between items-start pb-4 border-b-2 border-gray-900 dark:border-white/20 print:border-gray-900 mb-4">
                <div>
                  {/* Prominent main SokoniMax logo */}
                  <img 
                    src="/logo_dark.png" 
                    alt="SokoniMax" 
                    className="h-14 w-auto max-h-[58px] max-w-[220px] object-contain mb-1 brightness-0 dark:invert print:filter-none print:brightness-100 print:invert-0" 
                    style={{ maxHeight: '58px', maxWidth: '220px' }}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500 font-medium">
                    Official Marketplace Invoice & Order Summary
                  </p>
                </div>

                <div className="text-right space-y-0.5 pt-1">
                  <p className="text-base font-black text-black dark:text-white print:text-black">INVOICE #{data.order_id}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500">
                    Date: {data.formatted_date || new Date(data.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <span className="text-2xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-300 print:text-gray-700">
                      {data.status_label || data.status?.replace('_', ' ')}
                    </span>
                    {data.is_bulk_order && (
                      <span className="px-2 py-0.5 rounded text-2xs font-extrabold uppercase tracking-wider bg-black dark:bg-white/20 text-white print:bg-black print:text-white">
                        Bulk Order
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Store & Customer Details Grid */}
              <div className="grid grid-cols-2 gap-6 mb-4 text-xs py-1">
                {/* Store Information */}
                <div className="space-y-0.5">
                  <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 print:text-gray-400">
                    Seller / Store Information
                  </p>
                  <p className="font-extrabold text-sm text-black dark:text-white print:text-black">
                    {data.seller.display_name}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300 print:text-gray-600 font-medium">
                    @{data.seller.username} • {data.seller.is_verified ? 'SokoniMax Verified Merchant' : 'Registered Seller'}
                  </p>
                </div>

                {/* Buyer Information */}
                <div className="space-y-0.5">
                  <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 print:text-gray-400">
                    Billed / Shipped To
                  </p>
                  <p className="font-extrabold text-sm text-black dark:text-white print:text-black">
                    {data.buyer.name}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300 print:text-gray-600 font-medium">
                    @{data.buyer.username}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-4 overflow-x-auto scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse min-w-[500px] sm:min-w-0 table-fixed">
                  <thead>
                    <tr className="border-b border-gray-300 dark:border-white/10 print:border-gray-300 text-gray-600 dark:text-gray-400 print:text-gray-600 uppercase text-2xs font-extrabold tracking-wider">
                      <th className="py-2 px-2 w-8">#</th>
                      <th className="py-2 px-2 w-auto">Item Description</th>
                      <th className="py-2 px-2 text-center w-12">Qty</th>
                      <th className="py-2 px-2 text-right w-44">Unit Price</th>
                      <th className="py-2 px-2 text-right w-36">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10 print:divide-gray-200">
                    {data.items.map((item, idx) => (
                      <tr key={item.id || idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <td className="py-2 px-2 text-gray-400 dark:text-gray-500 print:text-gray-400 font-bold">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <p className="font-bold text-black dark:text-white print:text-black">{item.product_name}</p>
                          {item.variant_name && (
                            <p className="text-3xs text-gray-500 dark:text-gray-400 print:text-gray-500 font-medium">Variant: {item.variant_name}</p>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-black dark:text-white print:text-black">{item.quantity}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          <span className="font-bold text-black dark:text-white print:text-black whitespace-nowrap inline-block">
                            {item.price > 0 ? `TSh ${Math.round(item.price).toLocaleString()}` : 'Quote Req.'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-black text-black dark:text-white print:text-black whitespace-nowrap">
                          TSh {Math.round(item.subtotal).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Notes Section */}
              <div className="flex flex-row items-start gap-3 sm:grid sm:grid-cols-2 sm:gap-6 pt-3 border-t border-gray-200 dark:border-white/10 print:grid print:grid-cols-2 print:gap-6 mb-4 text-xs">
                {/* Notes and QR verification */}
                <div className="shrink-0 w-[68px] sm:w-auto">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2.5 pt-1">
                    <div className="shrink-0 bg-white p-1 rounded-sm border border-gray-200 dark:border-white/20">
                      <QRCodeSVG value={verifyUrl} size={56} level="M" />
                    </div>
                    <div className="max-w-[70px] sm:max-w-none text-left">
                      <p className="hidden sm:flex print:flex text-3xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 print:text-emerald-600 items-center gap-1.5">
                        <Check size={11} className="shrink-0" /> Authenticity Verified
                      </p>
                      <p className="text-[8px] sm:text-3xs text-gray-400 dark:text-gray-500 print:text-gray-400 leading-tight">
                        Scan to verify live database record & anti-tamper seal.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex justify-between items-baseline gap-2 py-1.5 text-xs sm:text-sm font-black text-black dark:text-white print:text-black">
                    <span className="whitespace-nowrap">Total Items Value</span>
                    <span className="text-sm sm:text-base font-black whitespace-nowrap">TSh {Math.round(data.total_amount).toLocaleString()}</span>
                  </div>
                  <p className="text-3xs text-gray-400 dark:text-gray-500 print:text-gray-400 italic">
                    * Delivery and transport fee is calculated and settled separately during order fulfillment.
                  </p>
                </div>
              </div>

              {/* Footer Note */}
              <div className="pt-4 border-t border-dashed border-gray-300 dark:border-white/10 print:border-gray-300 text-center text-3xs text-gray-400 dark:text-gray-500 print:text-gray-400 space-y-0.5">
                <p>Thank you for doing business with @{data.seller.username} via SokoniMax.</p>
                <p>For support or disputes, visit SokoniMax Help Center or contact support@sokonimax.com.</p>
              </div>
            </div>

            {/* Bottom Print Button (Gray simple no color) */}
            <div className="p-3 flex justify-center gap-2 print-hidden">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-white/10 dark:hover:bg-white/20 active:scale-95 text-gray-800 dark:text-white border-0 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <Printer size={14} />
                <span>{isPrinting ? t('preparing_print', 'Preparing Print...') : t('print_invoice', 'Print Invoice')}</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default PublicInvoiceVerifyPage;
