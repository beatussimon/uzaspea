import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

const REFERRAL_STORAGE_KEY = 'uzaspea_referral_attribution';
const REDEEMED_REFERRALS_KEY = 'uzaspea_redeemed_referrals';
const EXPIRED_REFERRAL_KEY = 'uzaspea_expired_referral_notice';
const LAST_CHECKED_KEY = 'uzaspea_last_checked_ref';
const DEFAULT_ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days default fallback

export interface ReferralAttribution {
  code: string;
  timestamp: number;
  expiresAt: number;
  scope?: 'single_product' | 'specific_products' | 'all_products';
  productId?: number;
  productSlug?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: string | number;
}

export interface ExpiredReferralNotice {
  code: string;
  reason: 'expired' | 'inactive' | 'limit_reached' | 'already_used' | 'not_found';
  message: string;
  timestamp: number;
}

export const isReferralRedeemed = (code: string): boolean => {
  try {
    const raw = localStorage.getItem(REDEEMED_REFERRALS_KEY);
    if (!raw) return false;
    const redeemedList: string[] = JSON.parse(raw);
    return Array.isArray(redeemedList) && redeemedList.includes(code.trim().toUpperCase());
  } catch {
    return false;
  }
};

export const markReferralRedeemed = (code: string) => {
  try {
    const clean = code.trim().toUpperCase();
    const raw = localStorage.getItem(REDEEMED_REFERRALS_KEY);
    const redeemedList: string[] = raw ? JSON.parse(raw) : [];
    if (!redeemedList.includes(clean)) {
      redeemedList.push(clean);
      localStorage.setItem(REDEEMED_REFERRALS_KEY, JSON.stringify(redeemedList));
    }
    clearActiveReferral();
  } catch {
    // ignore storage error
  }
};

export const getExpiredReferralNotice = (): ExpiredReferralNotice | null => {
  try {
    const raw = sessionStorage.getItem(EXPIRED_REFERRAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setExpiredReferralNotice = (notice: ExpiredReferralNotice) => {
  try {
    sessionStorage.setItem(EXPIRED_REFERRAL_KEY, JSON.stringify(notice));
    window.dispatchEvent(new CustomEvent('referral_status_changed'));
  } catch {
    // ignore storage error
  }
};

export const clearExpiredReferralNotice = () => {
  try {
    sessionStorage.removeItem(EXPIRED_REFERRAL_KEY);
    window.dispatchEvent(new CustomEvent('referral_status_changed'));
  } catch {
    // ignore storage error
  }
};

export const getActiveReferralData = (): ReferralAttribution | null => {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const data: ReferralAttribution = JSON.parse(raw);
    
    // Check expiration or prior redemption
    if (Date.now() > data.expiresAt || isReferralRedeemed(data.code)) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const getActiveReferral = (): string | null => {
  const data = getActiveReferralData();
  return data ? data.code : null;
};

export const clearActiveReferral = () => {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    sessionStorage.removeItem(LAST_CHECKED_KEY);
    window.dispatchEvent(new CustomEvent('referral_status_changed'));
  } catch {
    // ignore storage error
  }
};

export const updateReferralMetadata = (
  code: string,
  attributionDays?: number,
  endDateIso?: string | null,
  scope?: 'single_product' | 'specific_products' | 'all_products',
  productId?: number,
  productSlug?: string,
  discountType?: 'percentage' | 'fixed',
  discountValue?: string | number
) => {
  try {
    const clean = code.trim().toUpperCase();
    const now = Date.now();
    let durationMs = attributionDays && attributionDays > 0 
      ? attributionDays * 24 * 60 * 60 * 1000 
      : DEFAULT_ATTRIBUTION_WINDOW_MS;
    
    let expiresAt = now + durationMs;
    if (endDateIso) {
      const endMs = new Date(endDateIso).getTime();
      if (!isNaN(endMs) && endMs < expiresAt) {
        expiresAt = endMs;
      }
    }

    const payload: ReferralAttribution = {
      code: clean,
      timestamp: now,
      expiresAt,
      scope,
      productId,
      productSlug,
      discountType,
      discountValue
    };
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    let isUnchanged = false;
    if (raw) {
      try {
        const existing = JSON.parse(raw);
        isUnchanged = existing && existing.code === clean && existing.scope === scope && existing.productId === productId;
      } catch {}
    }
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(payload));
    if (!isUnchanged) {
      window.dispatchEvent(new CustomEvent('referral_status_changed'));
    }
  } catch {
    // ignore storage error
  }
};

export const useReferralStatus = () => {
  const [activeReferral, setActiveReferral] = useState<ReferralAttribution | null>(() => getActiveReferralData());
  const [expiredNotice, setExpiredNotice] = useState<ExpiredReferralNotice | null>(() => getExpiredReferralNotice());

  useEffect(() => {
    const handleStatusChange = () => {
      setActiveReferral(getActiveReferralData());
      setExpiredNotice(getExpiredReferralNotice());
    };

    window.addEventListener('referral_status_changed', handleStatusChange);
    window.addEventListener('storage', handleStatusChange);

    return () => {
      window.removeEventListener('referral_status_changed', handleStatusChange);
      window.removeEventListener('storage', handleStatusChange);
    };
  }, []);

  return {
    activeReferral,
    expiredNotice,
    clearExpiredNotice: clearExpiredReferralNotice,
    clearActiveReferral
  };
};

export const useAffiliateTracker = () => {
  const location = useLocation();

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(location.search);
      const refCode = searchParams.get('ref') || searchParams.get('aff');
      if (!refCode || !refCode.trim()) {
        return;
      }

      const cleanCode = refCode.trim().toUpperCase();

      // If this exact code is already active in local storage, skip duplicate network call
      const currentActive = getActiveReferral();
      if (currentActive === cleanCode) {
        return;
      }
      sessionStorage.setItem(LAST_CHECKED_KEY, cleanCode);

      // Check local redemption history (strict anti-reuse)
      if (isReferralRedeemed(cleanCode)) {
        clearActiveReferral();
        setExpiredReferralNotice({
          code: cleanCode,
          reason: 'already_used',
          message: 'You have already redeemed this referral code.',
          timestamp: Date.now()
        });
        return;
      }

      // Query backend validation endpoint for real-time validity & expiration check
      api.get('/api/promo-codes/check-ref/', { params: { code: cleanCode } })
        .then((res) => {
          if (res.data.is_expired || !res.data.valid) {
            clearActiveReferral();
            setExpiredReferralNotice({
              code: cleanCode,
              reason: res.data.reason || 'expired',
              message: 'This referral link is no longer active.',
              timestamp: Date.now()
            });
          } else {
            clearExpiredReferralNotice();
            updateReferralMetadata(
              res.data.code,
              res.data.attribution_window_days,
              res.data.end_date,
              res.data.applicable_scope,
              res.data.product_id,
              res.data.product_slug,
              res.data.discount_type,
              res.data.value
            );
            const discountLabel = res.data.discount_type === 'percentage'
              ? `${parseFloat(res.data.value)}% off`
              : `TSh ${parseInt(res.data.value, 10).toLocaleString()} off`;
            toast.success(`Referral code "${res.data.code}" applied (${discountLabel} at checkout)!`);
          }
        })
        .catch((err) => {
          // Only mark referral as invalid/expired on explicit 4xx client responses (e.g. 404/400),
          // not when the request failed due to a network or server issue.
          const status = err?.response?.status;
          if (typeof status === 'number' && status >= 400 && status < 500) {
            clearActiveReferral();
            setExpiredReferralNotice({
              code: cleanCode,
              reason: 'not_found',
              message: 'This referral link is no longer active.',
              timestamp: Date.now()
            });
          }
        });
    } catch {
      // Storage or parsing unavailable
    }
  }, [location.search]);
};
