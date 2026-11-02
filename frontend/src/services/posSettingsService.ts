import { useState, useEffect, useCallback } from 'react';
import api, { getAccessToken, decodeJwtPayload } from '../api';
import { saveStoreBusinessMode, type StoreBusinessMode } from './storeBusinessModeService';

export type OversellPolicy = 'strict_block' | 'warning_allow' | 'unlimited';
export type PrinterPaperWidth = '80mm' | '58mm';
export type PrintAutoTrigger = 'always' | 'prompt' | 'never';
export type ScannerHardwareMode = 'camera' | 'hardware_hid';
export type ReturnDisposition = 'restock_sellable' | 'quarantine_damaged' | 'scrap_loss';

export interface POSGranularSettings {
  // 1. Operating Mode & Business Modules
  preset: 'shop' | 'gym' | 'restaurant' | 'salon' | 'custom' | 'all';
  enableDiningModes: boolean;       // Dine-in vs Takeaway vs Walk-in (Table #)
  enableMemberships: boolean;       // Memberships & Service Passes, QR check-in
  enableInvoices: boolean;          // Invoices & Layaway
  enableAttendants: boolean;        // Staff attendant attribution
  enableDropOffClaim: boolean;      // Drop-off & Claim tickets

  // 2. Register & General
  registerName: string;             // e.g. "Main Register #1"
  defaultCustomerName: string;      // e.g. "Walk-in Customer"
  cashRounding: boolean;            // Round cash change to nearest 50/100 TZS

  // 3. Checkout, Tenders & Tipping
  enableQuickCashButtons: boolean;  // Show dynamic quick cash pills (Exact, 5k, 10k, 50k)
  enableSplitTender: boolean;       // Allow combining cash + M-Pesa + card
  enableTipping: boolean;           // Show tipping prompt on checkout
  defaultTipPercent: number;        // Default tip % (e.g. 10)
  tipDistribution: 'attendant' | 'pool'; // Direct to staff vs House pool
  allowOpenItems: boolean;          // Allow adding custom non-catalog item on the fly
  openItemRequirePin: boolean;      // Require manager PIN for custom charges > limit
  openItemLimit: number;            // Limit in TZS before PIN required

  // 4. Inventory, Stock & Scanning
  oversellPolicy: OversellPolicy;   // 'strict_block' | 'warning_allow' | 'unlimited'
  lowStockThreshold: number;        // Threshold for low stock warning pill (default 3)
  scannerMode: ScannerHardwareMode; // 'camera' | 'hardware_hid'
  autoAddToCartOnScan: boolean;     // Add item immediately without modal
  scanFeedbackAudio: boolean;       // Sound / chime on successful scan
  defaultReturnDisposition: ReturnDisposition;

  // 5. Receipts & Peripherals
  paperWidth: PrinterPaperWidth;    // '80mm' | '58mm'
  autoPrintReceipt: PrintAutoTrigger; // 'always' | 'prompt' | 'never'
  printKitchenChits: boolean;       // Print separate prep ticket for food/drink
  enableDrawerKick: boolean;        // Trigger cash drawer kick signal
  receiptHeader: string;            // Custom header line (e.g. "SokoNiMax Express")
  receiptFooter: string;            // Custom footer line (e.g. "Asante kwa kununua nasi! Karibu tena.")
  receiptShowTin: boolean;          // Print TIN/VRN tax identifier
  enableWhatsAppReceipt: boolean;   // Show instant 1-click WhatsApp receipt share

  // 6. Security, Shifts & Controls
  enableShifts: boolean;            // Enforce open float & close drawer sessions
  enforceBlindCount: boolean;       // Blind count on shift closeout
  requireManagerPinForDiscount: boolean;
  maxDiscountWithoutPin: number;    // % discount allowed before manager PIN
  requireManagerPinForVoid: boolean;
  requireManagerPinForReturn: boolean;
  requireManagerPinForPriceOverride: boolean;
  managerPin: string;               // 4-digit PIN for overrides
}

export const DEFAULT_POS_GRANULAR_SETTINGS: POSGranularSettings = {
  // Modules
  preset: 'custom',
  enableDiningModes: false,
  enableMemberships: false,
  enableInvoices: false,
  enableAttendants: false,
  enableDropOffClaim: false,

  // General
  registerName: 'Main Register #1',
  defaultCustomerName: 'Walk-in Customer',
  cashRounding: true,

  // Checkout
  enableQuickCashButtons: true,
  enableSplitTender: true,
  enableTipping: false,
  defaultTipPercent: 10,
  tipDistribution: 'attendant',
  allowOpenItems: true,
  openItemRequirePin: false,
  openItemLimit: 50000,

  // Inventory & Scanning
  oversellPolicy: 'warning_allow',
  lowStockThreshold: 3,
  scannerMode: 'camera',
  autoAddToCartOnScan: true,
  scanFeedbackAudio: true,
  defaultReturnDisposition: 'restock_sellable',

  // Receipts & Peripherals
  paperWidth: '80mm',
  autoPrintReceipt: 'prompt',
  printKitchenChits: false,
  enableDrawerKick: true,
  receiptHeader: '',
  receiptFooter: 'Asante kwa kununua nasi! Karibu tena.',
  receiptShowTin: true,
  enableWhatsAppReceipt: true,

  // Security & Shifts
  enableShifts: false,
  enforceBlindCount: true,
  requireManagerPinForDiscount: false,
  maxDiscountWithoutPin: 15,
  requireManagerPinForVoid: false,
  requireManagerPinForReturn: false,
  requireManagerPinForPriceOverride: false,
  managerPin: '1234',
};

const STORAGE_KEY = 'pos_granular_settings_v3';
const EVENT_NAME = 'pos_granular_settings_changed';

export const getStoredPOSSettings = (serverSettings?: Partial<POSGranularSettings>): POSGranularSettings => {
  let localData: Partial<POSGranularSettings> = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localData = JSON.parse(raw);
    }
  } catch {}

  // Fallback to legacy pos_module_config_v2 if fresh
  if (!localData.preset && typeof localStorage !== 'undefined') {
    try {
      const legacyRaw = localStorage.getItem('pos_module_config_v2');
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        localData = { ...localData, ...legacy };
      }
    } catch {}
  }

  return {
    ...DEFAULT_POS_GRANULAR_SETTINGS,
    ...(serverSettings || {}),
    ...localData,
  };
};

export const savePOSSettings = async (
  newSettings: POSGranularSettings,
  username?: string
): Promise<void> => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      // Also maintain legacy format for backwards compatibility
      localStorage.setItem('pos_module_config_v2', JSON.stringify({
        preset: newSettings.preset,
        enableDiningModes: newSettings.enableDiningModes,
        enableMemberships: newSettings.enableMemberships,
        enableInvoices: newSettings.enableInvoices,
        enableAttendants: newSettings.enableAttendants,
        enableDropOffClaim: newSettings.enableDropOffClaim,
      }));
    }

    // Synchronize business operating mode if preset was changed
    let targetMode: StoreBusinessMode | null = null;
    if (newSettings.preset === 'shop') targetMode = 'retail';
    else if (newSettings.preset === 'gym') targetMode = 'gym';
    else if (newSettings.preset === 'salon') targetMode = 'salon';
    else if (newSettings.preset === 'restaurant') targetMode = 'restaurant';
    else if (newSettings.preset === 'all') targetMode = 'hybrid';
    else if (newSettings.enableMemberships && !newSettings.enableDiningModes) targetMode = 'gym';

    if (targetMode) {
      await saveStoreBusinessMode(targetMode);
    }

    // Broadcast across windows/tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: newSettings }));
    }

    // Save to user profile backend
    const activeJwt = getAccessToken();
    const targetUser = username || (activeJwt ? decodeJwtPayload(activeJwt)?.username : null);
    if (targetUser) {
      await api.patch(`/api/profiles/${targetUser}/`, {
        pos_settings: newSettings,
      }).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to save POS granular settings:', err);
  }
};

export const usePOSSettings = (serverSettings?: Partial<POSGranularSettings>) => {
  const [settings, setSettingsState] = useState<POSGranularSettings>(() => getStoredPOSSettings(serverSettings));

  useEffect(() => {
    if (serverSettings && Object.keys(serverSettings).length > 0) {
      setSettingsState(prev => ({ ...prev, ...serverSettings }));
    }
  }, [serverSettings]);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e?.detail) setSettingsState(e.detail);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT_NAME, handleUpdate);
      return () => window.removeEventListener(EVENT_NAME, handleUpdate);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<POSGranularSettings>) => {
    const merged = { ...settings, ...updates };
    setSettingsState(merged);
    await savePOSSettings(merged);
  }, [settings]);

  return {
    settings,
    updateSettings,
    saveSettings: savePOSSettings,
  };
};
