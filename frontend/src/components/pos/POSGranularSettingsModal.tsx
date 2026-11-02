import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Sliders,
  CreditCard,
  Package,
  Printer,
  ShieldCheck,
  Check,
  RotateCcw,
  Sparkles,
  UtensilsCrossed,
  Tag,
  Users,
  Clock,
} from 'lucide-react';
import {
  type POSGranularSettings,
  DEFAULT_POS_GRANULAR_SETTINGS,
} from '../../services/posSettingsService';

interface POSGranularSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: POSGranularSettings;
  onSave: (newSettings: POSGranularSettings) => void;
}

type SettingsTab = 'modules' | 'checkout' | 'inventory' | 'receipts' | 'security';

export const POSGranularSettingsModal: React.FC<POSGranularSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('modules');
  const [form, setForm] = useState<POSGranularSettings>(settings);

  useEffect(() => {
    setForm(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handlePresetApply = (preset: 'shop' | 'gym' | 'restaurant' | 'salon' | 'all') => {
    if (preset === 'shop') {
      setForm(prev => ({
        ...prev,
        preset: 'shop',
        enableDiningModes: false,
        enableMemberships: false,
        enableInvoices: true,
        enableAttendants: false,
        enableDropOffClaim: false,
        oversellPolicy: 'warning_allow',
        printKitchenChits: false,
      }));
    } else if (preset === 'gym') {
      setForm(prev => ({
        ...prev,
        preset: 'gym',
        enableDiningModes: false,
        enableMemberships: true,
        enableInvoices: true,
        enableAttendants: false,
        enableDropOffClaim: false,
        oversellPolicy: 'unlimited',
        printKitchenChits: false,
      }));
    } else if (preset === 'restaurant') {
      setForm(prev => ({
        ...prev,
        preset: 'restaurant',
        enableDiningModes: true,
        enableMemberships: false,
        enableInvoices: true,
        enableAttendants: false,
        enableDropOffClaim: false,
        oversellPolicy: 'warning_allow',
        printKitchenChits: true,
      }));
    } else if (preset === 'salon') {
      setForm(prev => ({
        ...prev,
        preset: 'salon',
        enableDiningModes: false,
        enableMemberships: true,
        enableInvoices: true,
        enableAttendants: true,
        enableDropOffClaim: true,
        oversellPolicy: 'unlimited',
        printKitchenChits: false,
      }));
    } else {
      setForm(prev => ({
        ...prev,
        preset: 'all',
        enableDiningModes: true,
        enableMemberships: true,
        enableInvoices: true,
        enableAttendants: true,
        enableDropOffClaim: true,
      }));
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_POS_GRANULAR_SETTINGS);
  };

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  const presets = [
    { id: 'shop', label: t('preset_retail', 'Retail Shop'), icon: Tag, desc: t('preset_retail_desc', 'Products, barcodes & inventory') },
    { id: 'restaurant', label: t('preset_restaurant', 'Restaurant & Cafe'), icon: UtensilsCrossed, desc: t('preset_restaurant_desc', 'Dining tables, drinks & kitchen chits') },
    { id: 'salon', label: t('preset_salon', 'Salon & Barber'), icon: Users, desc: t('preset_salon_desc', 'Attendants, tips & claim tickets') },
    { id: 'gym', label: t('preset_gym', 'Gym & Fitness'), icon: Clock, desc: t('preset_gym_desc', 'Membership passes & QR check-in') },
    { id: 'all', label: t('preset_hybrid', 'Hybrid / All Features'), icon: Sparkles, desc: t('preset_hybrid_desc', 'All enterprise modules enabled') },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in text-gray-900 dark:text-gray-100">
      <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50 dark:bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-500/10 text-brand-500 rounded-xl">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
                {t('pos_granular_settings', 'POS Enterprise Settings')}
              </h2>
              <p className="text-3xs sm:text-2xs text-gray-500 dark:text-gray-400">
                {t('pos_granular_settings_sub', 'Tailor registers, checkout rules, peripherals and audit policies')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 border-b border-gray-200 dark:border-neutral-800 overflow-x-auto bg-white dark:bg-[#121212] shrink-0 no-scrollbar">
          {[
            { id: 'modules', label: t('tab_modules', 'Operating Mode'), icon: Sliders },
            { id: 'checkout', label: t('tab_checkout', 'Checkout & Tender'), icon: CreditCard },
            { id: 'inventory', label: t('tab_inventory', 'Stock & Scanning'), icon: Package },
            { id: 'receipts', label: t('tab_receipts', 'Receipts & Hardware'), icon: Printer },
            { id: 'security', label: t('tab_security', 'Shifts & Security'), icon: ShieldCheck },
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex items-center gap-2 px-3 py-3 border-b-2 font-bold text-xs whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'border-brand-500 text-brand-500 font-extrabold'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* TAB 1: OPERATING MODE & PRESETS */}
          {activeTab === 'modules' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-2xs uppercase tracking-wider font-bold text-gray-400 mb-2">
                  {t('select_business_preset', 'Select Business Preset')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {presets.map(p => {
                    const isSelected = form.preset === p.id;
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePresetApply(p.id as any)}
                        className={`text-left p-3 rounded-xl border transition flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'border-brand-500 bg-brand-500/10 text-gray-900 dark:text-white'
                            : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-brand-500 text-black' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300'}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs">{p.label}</div>
                          <div className="text-3xs text-gray-500 dark:text-gray-400 line-clamp-1">{p.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
                <label className="block text-2xs uppercase tracking-wider font-bold text-gray-400 mb-2.5">
                  {t('granular_pos_modules', 'Granular Module Toggles')}
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'enableDiningModes', label: t('dining_modes', 'Dine-in Tables & Takeaway Modes'), desc: 'Table # assignment and order type selection' },
                    { key: 'enableMemberships', label: t('memberships_passes', 'Memberships & Service Passes'), desc: 'QR passes issuance, member check-in counter & expiry tracking' },
                    { key: 'enableAttendants', label: t('attendants_stylists', 'Staff & Attendant Attribution'), desc: 'Line-item attribution for commissions & tips' },
                    { key: 'enableDropOffClaim', label: t('drop_off_claims', 'Drop-off & Claim Slips'), desc: 'Unique claim ticket intake codes & promised completion times' },
                    { key: 'enableInvoices', label: t('invoices_layaway', 'Invoices & Layaway'), desc: 'Proforma invoices and layaway installment deposits' },
                  ].map(mod => {
                    const checked = Boolean((form as any)[mod.key]);
                    return (
                      <label
                        key={mod.key}
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 hover:bg-gray-50 dark:hover:bg-neutral-800/30 cursor-pointer transition"
                      >
                        <div className="space-y-0.5 pr-4">
                          <div className="font-bold text-xs text-gray-900 dark:text-white">{mod.label}</div>
                          <div className="text-3xs text-gray-500 dark:text-gray-400">{mod.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setForm(prev => ({ ...prev, preset: 'custom', [mod.key]: !checked }))}
                          className="w-4 h-4 rounded text-brand-500 accent-brand-500 shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHECKOUT & TENDERS */}
          {activeTab === 'checkout' && (
            <div className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-xs text-gray-700 dark:text-gray-300 mb-1">
                    {t('register_name', 'Register Name / Identifier')}
                  </label>
                  <input
                    type="text"
                    value={form.registerName}
                    onChange={e => setForm(prev => ({ ...prev, registerName: e.target.value }))}
                    placeholder="e.g. Front Register #1"
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 text-xs focus:outline-hidden focus:border-brand-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-xs text-gray-700 dark:text-gray-300 mb-1">
                    {t('default_customer_name', 'Default Customer Name')}
                  </label>
                  <input
                    type="text"
                    value={form.defaultCustomerName}
                    onChange={e => setForm(prev => ({ ...prev, defaultCustomerName: e.target.value }))}
                    placeholder="Walk-in Customer"
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 text-xs focus:outline-hidden focus:border-brand-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-200 dark:border-neutral-800 pt-4">
                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Quick Cash Tender Buttons</div>
                    <div className="text-3xs text-gray-500">Show dynamic cash suggestion pills (Exact, 5k, 10k, 50k)</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.enableQuickCashButtons}
                    onChange={e => setForm(prev => ({ ...prev, enableQuickCashButtons: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Split Tender Payment (Multi-Tender)</div>
                    <div className="text-3xs text-gray-500">Allow combining Cash + M-Pesa + Card on a single sale</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.enableSplitTender}
                    onChange={e => setForm(prev => ({ ...prev, enableSplitTender: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Allow Open Non-Catalog Items</div>
                    <div className="text-3xs text-gray-500">Add custom manual charges on the fly during checkout</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.allowOpenItems}
                    onChange={e => setForm(prev => ({ ...prev, allowOpenItems: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Tipping & Gratuity Prompt</div>
                    <div className="text-3xs text-gray-500">Display tip prompts for staff upon checkout settlement</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.enableTipping}
                    onChange={e => setForm(prev => ({ ...prev, enableTipping: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY & STOCK */}
          {activeTab === 'inventory' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block font-bold text-xs text-gray-700 dark:text-gray-300 mb-2">
                  {t('oversell_policy', 'Negative Stock / Overselling Policy')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'warning_allow', label: 'Warn & Allow', desc: 'Warn cashier with amber alert but permit sale (Recommended for busy stores)' },
                    { id: 'strict_block', label: 'Strict Block', desc: 'Never allow sale if quantity exceeds location stock' },
                    { id: 'unlimited', label: 'Unlimited', desc: 'Ideal for services, appointments & unlimited items' },
                  ].map(pol => {
                    const isSelected = form.oversellPolicy === pol.id;
                    return (
                      <button
                        key={pol.id}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, oversellPolicy: pol.id as any }))}
                        className={`text-left p-3 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'border-brand-500 bg-brand-500/10 text-gray-900 dark:text-white font-bold'
                            : 'border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <div className="text-xs font-bold">{pol.label}</div>
                        <div className="text-3xs text-gray-500 dark:text-gray-400 mt-1">{pol.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-200 dark:border-neutral-800 pt-4">
                <div>
                  <label className="block font-bold text-xs text-gray-700 dark:text-gray-300 mb-1">
                    Low Stock Threshold (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={form.lowStockThreshold}
                    onChange={e => setForm(prev => ({ ...prev, lowStockThreshold: parseInt(e.target.value, 10) || 3 }))}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 text-xs focus:outline-hidden focus:border-brand-500 font-medium"
                  />
                  <span className="text-3xs text-gray-400">Triggers low stock warnings and analytics watchlist</span>
                </div>

                <div>
                  <label className="block font-bold text-xs text-gray-700 dark:text-gray-300 mb-1">
                    Barcode Scanner Mode
                  </label>
                  <select
                    value={form.scannerMode}
                    onChange={e => setForm(prev => ({ ...prev, scannerMode: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 text-xs focus:outline-hidden focus:border-brand-500 font-medium"
                  >
                    <option value="camera">Camera Scanner (Mobile / Laptop)</option>
                    <option value="hardware_hid">USB / Bluetooth Laser Barcode Gun</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-200 dark:border-neutral-800 pt-4">
                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Auto-Add Item Immediately on Scan</div>
                    <div className="text-3xs text-gray-500">Adds item or increments quantity without showing options popup</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.autoAddToCartOnScan}
                    onChange={e => setForm(prev => ({ ...prev, autoAddToCartOnScan: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Scan Audio Feedback</div>
                    <div className="text-3xs text-gray-500">Play confirmation chime upon successful barcode/QR read</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.scanFeedbackAudio}
                    onChange={e => setForm(prev => ({ ...prev, scanFeedbackAudio: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: RECEIPTS & HARDWARE */}
          {activeTab === 'receipts' && (
            <div className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-xs text-gray-700 dark:text-gray-300 mb-1">
                    Receipt Paper Width
                  </label>
                  <select
                    value={form.paperWidth}
                    onChange={e => setForm(prev => ({ ...prev, paperWidth: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 text-xs focus:outline-hidden focus:border-brand-500 font-medium"
                  >
                    <option value="80mm">80mm (Standard Desktop Thermal)</option>
                    <option value="58mm">58mm (Compact Mobile POS Printer)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-xs text-gray-700 dark:text-gray-300 mb-1">
                    Auto-Print Trigger
                  </label>
                  <select
                    value={form.autoPrintReceipt}
                    onChange={e => setForm(prev => ({ ...prev, autoPrintReceipt: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 text-xs focus:outline-hidden focus:border-brand-500 font-medium"
                  >
                    <option value="prompt">Prompt Cashier (Default)</option>
                    <option value="always">Always Auto-Print</option>
                    <option value="never">Never Print (Digital Only)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-xs text-gray-700 dark:text-gray-300 mb-1">
                    Custom Receipt Footer Message
                  </label>
                  <input
                    type="text"
                    value={form.receiptFooter}
                    onChange={e => setForm(prev => ({ ...prev, receiptFooter: e.target.value }))}
                    placeholder="Asante kwa kununua nasi! Karibu tena."
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 text-xs focus:outline-hidden focus:border-brand-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-200 dark:border-neutral-800 pt-4">
                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Print Kitchen / Prep Chits</div>
                    <div className="text-3xs text-gray-500">Route food & drink items to separate kitchen prep slips</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.printKitchenChits}
                    onChange={e => setForm(prev => ({ ...prev, printKitchenChits: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Enable Cash Drawer Kick Pulse</div>
                    <div className="text-3xs text-gray-500">Send electronic kick signal on cash payment settlement</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.enableDrawerKick}
                    onChange={e => setForm(prev => ({ ...prev, enableDrawerKick: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Instant WhatsApp Digital Receipt Share</div>
                    <div className="text-3xs text-gray-500">Display 1-click WhatsApp share button to text receipt to customer</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.enableWhatsAppReceipt}
                    onChange={e => setForm(prev => ({ ...prev, enableWhatsAppReceipt: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY & SHIFTS */}
          {activeTab === 'security' && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Enforce Shift Sessions (Opening Float & Close)</div>
                    <div className="text-3xs text-gray-500">Require cashiers to enter initial cash float and generate X/Z Reports</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.enableShifts}
                    onChange={e => setForm(prev => ({ ...prev, enableShifts: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-neutral-800/80 cursor-pointer">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Blind Shift Closeout Count</div>
                    <div className="text-3xs text-gray-500">Hide expected cash from cashier during end-of-shift counting to prevent skimming</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.enforceBlindCount}
                    onChange={e => setForm(prev => ({ ...prev, enforceBlindCount: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                  />
                </label>
              </div>

              <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Supervisor / Manager PIN Code</div>
                    <div className="text-3xs text-gray-500">4-digit PIN for manager overrides and sensitive operations</div>
                  </div>
                  <input
                    type="password"
                    maxLength={4}
                    value={form.managerPin}
                    onChange={e => setForm(prev => ({ ...prev, managerPin: e.target.value }))}
                    className="w-20 px-3 py-1.5 text-center tracking-widest rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 text-xs focus:outline-hidden font-mono font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-neutral-800/60 text-xs cursor-pointer">
                    <span>Require PIN for Discounts &gt; {form.maxDiscountWithoutPin}%</span>
                    <input
                      type="checkbox"
                      checked={form.requireManagerPinForDiscount}
                      onChange={e => setForm(prev => ({ ...prev, requireManagerPinForDiscount: e.target.checked }))}
                      className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-neutral-800/60 text-xs cursor-pointer">
                    <span>Require PIN for Order Voids / Item Cancellations</span>
                    <input
                      type="checkbox"
                      checked={form.requireManagerPinForVoid}
                      onChange={e => setForm(prev => ({ ...prev, requireManagerPinForVoid: e.target.checked }))}
                      className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-neutral-800/60 text-xs cursor-pointer">
                    <span>Require PIN for Processing Returns & Refunds</span>
                    <input
                      type="checkbox"
                      checked={form.requireManagerPinForReturn}
                      onChange={e => setForm(prev => ({ ...prev, requireManagerPinForReturn: e.target.checked }))}
                      className="w-4 h-4 rounded text-brand-500 accent-brand-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50 dark:bg-[#161616]">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>{t('reset_defaults', 'Reset Defaults')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              {t('cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-400 text-black shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} />
              <span>{t('save_settings', 'Save Settings')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default POSGranularSettingsModal;
