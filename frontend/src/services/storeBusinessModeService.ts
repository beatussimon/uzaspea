import { useState, useEffect, useCallback } from 'react';
import api, { getAccessToken, decodeJwtPayload } from '../api';

export type StoreBusinessMode = 'retail' | 'gym' | 'salon' | 'restaurant' | 'service' | 'hybrid';

export interface POSModuleConfig {
  preset: 'shop' | 'gym' | 'restaurant' | 'salon' | 'custom' | 'all';
  enableDiningModes: boolean; // Dine-in vs Takeaway vs Walk-in (Table #)
  enableMemberships: boolean; // Memberships & Service Passes, QR check-in
  enableInvoices: boolean;    // Invoices & Layaway
  enableAttendants: boolean;  // Staff attendant attribution
  enableDropOffClaim: boolean; // Drop-off & Claim tickets
}

export const DEFAULT_POS_CONFIG: POSModuleConfig = {
  preset: 'custom',
  enableDiningModes: false,
  enableMemberships: false,
  enableInvoices: false,
  enableAttendants: false,
  enableDropOffClaim: false,
};

export const getStoredPOSConfig = (_username?: string): POSModuleConfig => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('pos_module_config_v2')) {
      const parsed = JSON.parse(localStorage.getItem('pos_module_config_v2') || '{}');
      return {
        ...DEFAULT_POS_CONFIG,
        ...parsed,
      };
    }
  } catch {}
  return { ...DEFAULT_POS_CONFIG };
};

export const BUSINESS_MODE_CONFIG: Record<StoreBusinessMode, {
  id: StoreBusinessMode;
  label: string;
  shortLabel: string;
  category: 'product' | 'service' | 'membership' | 'food' | 'hybrid';
  inventoryLabel: string;
  analyticsLabel: string;
  topPerformersLabel: string;
  salesActivityLabel: string;
  hasStockTracking: boolean;
  hasMemberships: boolean;
  hasAttendants: boolean;
  hasDining: boolean;
  description: string;
}> = {
  retail: {
    id: 'retail',
    label: 'Retail Shop (Physical Goods)',
    shortLabel: 'Retail',
    category: 'product',
    inventoryLabel: 'Inventory',
    analyticsLabel: 'Store Analytics',
    topPerformersLabel: 'Top Performing Products',
    salesActivityLabel: 'Items Sold Activity',
    hasStockTracking: true,
    hasMemberships: false,
    hasAttendants: false,
    hasDining: false,
    description: 'Physical goods inventory, stock counts, and low-stock reorder warnings.',
  },
  gym: {
    id: 'gym',
    label: 'Gym & Fitness Club (Memberships & Passes)',
    shortLabel: 'Gym / Club',
    category: 'membership',
    inventoryLabel: 'Services & Passes',
    analyticsLabel: 'Gym & Membership Analytics',
    topPerformersLabel: 'Top Performing Passes & Services',
    salesActivityLabel: 'Passes & Services Issued',
    hasStockTracking: false,
    hasMemberships: true,
    hasAttendants: false,
    hasDining: false,
    description: 'Membership passes, QR check-ins, and upcoming renewal expiration alerts.',
  },
  salon: {
    id: 'salon',
    label: 'Salon & Spa (Appointments & Services)',
    shortLabel: 'Salon / Spa',
    category: 'service',
    inventoryLabel: 'Services & Treatments',
    analyticsLabel: 'Salon & Spa Analytics',
    topPerformersLabel: 'Top Performing Services',
    salesActivityLabel: 'Services Rendered Activity',
    hasStockTracking: false,
    hasMemberships: true,
    hasAttendants: true,
    hasDining: false,
    description: 'Treatments, stylist attribution, client appointments, and drop-off claim tickets.',
  },
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant & Cafe (Food & Dining)',
    shortLabel: 'Restaurant',
    category: 'food',
    inventoryLabel: 'Menu Items',
    analyticsLabel: 'Restaurant & Dining Analytics',
    topPerformersLabel: 'Top Selling Menu Items',
    salesActivityLabel: 'Food & Dining Orders',
    hasStockTracking: true,
    hasMemberships: false,
    hasAttendants: false,
    hasDining: true,
    description: 'Dine-in table tracking, takeaway orders, and food & drink stock alerts.',
  },
  service: {
    id: 'service',
    label: 'General Services (Consulting & Bookings)',
    shortLabel: 'Services',
    category: 'service',
    inventoryLabel: 'Services',
    analyticsLabel: 'Service Analytics',
    topPerformersLabel: 'Top Performing Services',
    salesActivityLabel: 'Service Sales Activity',
    hasStockTracking: false,
    hasMemberships: false,
    hasAttendants: false,
    hasDining: false,
    description: 'Direct services, consultation hours, and appointments without inventory limits.',
  },
  hybrid: {
    id: 'hybrid',
    label: 'Hybrid (Both Products & Services)',
    shortLabel: 'Hybrid',
    category: 'hybrid',
    inventoryLabel: 'Catalog & Inventory',
    analyticsLabel: 'Store & Service Analytics',
    topPerformersLabel: 'Top Performing Items & Services',
    salesActivityLabel: 'Sales & Service Activity',
    hasStockTracking: true,
    hasMemberships: true,
    hasAttendants: true,
    hasDining: true,
    description: 'Both physical inventory and bookable services/memberships with unified reporting.',
  },
};

const MODE_STORAGE_KEY = 'store_business_mode';
const EXPIRY_STORAGE_KEY = 'pass_expiry_window_days';
const EVENT_NAME = 'store_business_mode_changed';

export const getStoredBusinessMode = (): StoreBusinessMode => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      if (saved && ['retail', 'gym', 'salon', 'restaurant', 'service', 'hybrid'].includes(saved)) {
        return saved as StoreBusinessMode;
      }
    }
    // Infer from POS config preset if present
    const posConfig = getStoredPOSConfig();
    if (posConfig.preset === 'gym') return 'gym';
    if (posConfig.preset === 'salon') return 'salon';
    if (posConfig.preset === 'restaurant') return 'restaurant';
    if (posConfig.preset === 'all') return 'hybrid';
    if (posConfig.preset === 'shop') return 'retail';
  } catch {}
  return 'retail';
};

export const getStoredPassExpiryWindow = (): number => {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(EXPIRY_STORAGE_KEY);
      if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 365) return parsed;
      }
    }
  } catch {}
  return 7;
};

export const syncToPOSConfig = (mode: StoreBusinessMode) => {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getStoredPOSConfig();
    let updated: POSModuleConfig = { ...current };

    if (mode === 'gym') {
      updated = { ...updated, preset: 'gym', enableDiningModes: false, enableMemberships: true, enableInvoices: true, enableAttendants: false, enableDropOffClaim: false };
    } else if (mode === 'salon') {
      updated = { ...updated, preset: 'salon', enableDiningModes: false, enableMemberships: true, enableInvoices: true, enableAttendants: true, enableDropOffClaim: true };
    } else if (mode === 'restaurant') {
      updated = { ...updated, preset: 'restaurant', enableDiningModes: true, enableMemberships: false, enableInvoices: true, enableAttendants: false, enableDropOffClaim: false };
    } else if (mode === 'retail') {
      updated = { ...updated, preset: 'shop', enableDiningModes: false, enableMemberships: false, enableInvoices: true, enableAttendants: false, enableDropOffClaim: false };
    } else if (mode === 'hybrid') {
      updated = { ...updated, preset: 'all', enableDiningModes: true, enableMemberships: true, enableInvoices: true, enableAttendants: true, enableDropOffClaim: true };
    }

    localStorage.setItem('pos_module_config_v2', JSON.stringify(updated));
  } catch {}
};

export const saveStoreBusinessMode = async (
  mode: StoreBusinessMode, 
  expiryWindowDays?: number,
  username?: string
): Promise<void> => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
      if (expiryWindowDays !== undefined) {
        localStorage.setItem(EXPIRY_STORAGE_KEY, String(expiryWindowDays));
      }
    }

    syncToPOSConfig(mode);

    // Dispatch event to re-render any listening active component
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { 
        detail: { mode, expiryWindowDays: expiryWindowDays || getStoredPassExpiryWindow() } 
      }));
    }

    // Persist to user profile backend
    const activeJwt = getAccessToken();
    const targetUser = username || (activeJwt ? decodeJwtPayload(activeJwt)?.username : null);
    if (targetUser) {
      const payload: any = { business_mode: mode };
      if (expiryWindowDays !== undefined) {
        payload.pass_expiry_window_days = expiryWindowDays;
      }
      await api.patch(`/api/profiles/${targetUser}/`, payload).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to save store business mode:', err);
  }
};

export const useStoreBusinessMode = (initialServerMode?: string, initialServerWindow?: number) => {
  const [businessMode, setBusinessModeState] = useState<StoreBusinessMode>(() => {
    if (initialServerMode && ['retail', 'gym', 'salon', 'restaurant', 'service', 'hybrid'].includes(initialServerMode)) {
      return initialServerMode as StoreBusinessMode;
    }
    return getStoredBusinessMode();
  });

  const [passExpiryWindow, setPassExpiryWindowState] = useState<number>(() => {
    if (initialServerWindow && initialServerWindow > 0) return initialServerWindow;
    return getStoredPassExpiryWindow();
  });

  useEffect(() => {
    if (initialServerMode && ['retail', 'gym', 'salon', 'restaurant', 'service', 'hybrid'].includes(initialServerMode)) {
      setBusinessModeState(initialServerMode as StoreBusinessMode);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(MODE_STORAGE_KEY, initialServerMode);
      }
    }
  }, [initialServerMode]);

  useEffect(() => {
    if (initialServerWindow && initialServerWindow > 0) {
      setPassExpiryWindowState(initialServerWindow);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(EXPIRY_STORAGE_KEY, String(initialServerWindow));
      }
    }
  }, [initialServerWindow]);

  useEffect(() => {
    const handleModeChange = (e: any) => {
      if (e?.detail?.mode) setBusinessModeState(e.detail.mode);
      if (e?.detail?.expiryWindowDays) setPassExpiryWindowState(e.detail.expiryWindowDays);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT_NAME, handleModeChange);
      return () => window.removeEventListener(EVENT_NAME, handleModeChange);
    }
  }, []);

  const setBusinessMode = useCallback(async (newMode: StoreBusinessMode) => {
    setBusinessModeState(newMode);
    await saveStoreBusinessMode(newMode, passExpiryWindow);
  }, [passExpiryWindow]);

  const setPassExpiryWindow = useCallback(async (newWindow: number) => {
    setPassExpiryWindowState(newWindow);
    await saveStoreBusinessMode(businessMode, newWindow);
  }, [businessMode]);

  const config = BUSINESS_MODE_CONFIG[businessMode] || BUSINESS_MODE_CONFIG.retail;

  return {
    businessMode,
    passExpiryWindow,
    setBusinessMode,
    setPassExpiryWindow,
    config,
    isRetailMode: businessMode === 'retail',
    isGymMode: businessMode === 'gym',
    isSalonMode: businessMode === 'salon',
    isRestaurantMode: businessMode === 'restaurant',
    isServiceMode: businessMode === 'service',
    isHybridMode: businessMode === 'hybrid',
    hasMemberships: config.hasMemberships,
    hasStockTracking: config.hasStockTracking,
  };
};
