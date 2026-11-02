import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api, {
  setLogoutCallback,
  decodeJwtPayload,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  hasSessionHintCookie,
  refreshAccessToken,
} from '../api';
import { apiCache } from '../utils/apiCache';
import { invalidateProductCache } from '../utils/productCache';
import { clearRecQueues } from '../utils/recTracking';
import { clearOfflineVault } from '../utils/offlineVault';

export interface StoreLocationBrief {
  id: number;
  name: string;
  slug?: string;
  is_main: boolean;
  city?: string;
  district?: string;
  address?: string;
  address_line?: string;
  phone?: string;
}

export interface User {
  user_id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  is_verified: boolean;
  tier: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_inspector: boolean;
  has_staff_permissions: boolean;
  inspector_level: string;
  subscription_active?: boolean;
  subscription_expired?: boolean;
  subscription_end_date?: string | null;
  is_seller?: boolean;
  last_tier?: string | null;
  last_tier_name?: string | null;
  is_team_member?: boolean;
  team_owner_id?: number | null;
  team_owner_username?: string | null;
  business_name?: string | null;
  team_role_preset?: string | null;
  team_role_label?: string | null;
  is_team_suspended?: boolean;
  is_owner_subscription_active?: boolean;
  team_permissions?: Record<string, boolean>;
  terms_accepted?: boolean;
  profile_picture?: string | null;
  assigned_locations?: StoreLocationBrief[];
  active_location?: StoreLocationBrief | null;
  is_multi_location?: boolean;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  user: User | null;
  isSeller: boolean;
  isSellerLite: boolean;
  login: (tokens: { access: string; refresh?: string }, userData?: any) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  acceptTerms: () => void;
  activeLocation: StoreLocationBrief | null;
  setActiveLocation: (loc: StoreLocationBrief | null) => void;
  assignedLocations: StoreLocationBrief[];
  isMultiLocation: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LEGACY_PII_KEYS = [
  'access_token',
  'refresh_token',
  'token',
  'sokonimax_vault_dev_key',
  'user_id',
  'username',
  'first_name',
  'last_name',
  'is_verified',
  'tier',
  'is_staff',
  'is_superuser',
  'is_inspector',
  'has_staff_permissions',
  'inspector_level',
  'is_team_member',
  'team_owner_id',
  'team_owner_username',
  'business_name',
  'team_role_preset',
  'team_role_label',
  'team_permissions',
  'terms_accepted',
  'is_seller',
  'subscription_active',
  'subscription_expired',
  'last_tier',
  'last_tier_name',
  'profile_picture',
  'assigned_locations',
  'active_location',
  'is_multi_location',
  'account_banned',
];

const PRESERVED_LOGOUT_KEYS = [
  'theme',
  'uzaspea_language',
  'i18nextLng',
  'viewMode',
  'pwaInstalled',
  'pwaPromptDismissed',
];

const ACTIVE_LOCATION_SESSION_KEY = 'sm_active_location';

function purgeLegacyAuthStorage(): void {
  try {
    for (const k of LEGACY_PII_KEYS) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore storage errors
  }
}

function buildUserFromToken(token: string, fallbackData?: any): User | null {
  const payload = decodeJwtPayload(token);
  const src = payload || fallbackData;
  if (!src) return null;

  const subActive = src.subscription_active === true || src.subscription_active === 'true';
  const subExpired = subActive
    ? false
    : (src.subscription_expired === true || src.subscription_expired === 'true');

  const rawTier = src.tier || fallbackData?.tier || 'free';
  const lastTier = src.last_tier || fallbackData?.last_tier || null;
  const effectiveTier = subActive && lastTier ? lastTier : rawTier;

  let parsedTeamPerms: Record<string, boolean> = {};
  const rawPerms = src.team_permissions ?? fallbackData?.team_permissions;
  if (typeof rawPerms === 'string') {
    try {
      parsedTeamPerms = JSON.parse(rawPerms);
    } catch {
      parsedTeamPerms = {};
    }
  } else if (rawPerms && typeof rawPerms === 'object') {
    parsedTeamPerms = rawPerms;
  }

  return {
    user_id: Number(src.user_id ?? fallbackData?.user_id ?? 0),
    username: src.username || fallbackData?.username || '',
    first_name: src.first_name || fallbackData?.first_name || '',
    last_name: src.last_name || fallbackData?.last_name || '',
    is_verified: src.is_verified === true || src.is_verified === 'true',
    tier: effectiveTier,
    is_staff: src.is_staff === true || src.is_staff === 'true',
    is_superuser: src.is_superuser === true || src.is_superuser === 'true',
    is_inspector: src.is_inspector === true || src.is_inspector === 'true',
    has_staff_permissions: src.has_staff_permissions === true || src.has_staff_permissions === 'true',
    inspector_level: src.inspector_level || fallbackData?.inspector_level || '',
    subscription_active: subActive,
    subscription_expired: subExpired,
    subscription_end_date: src.subscription_end_date ?? fallbackData?.subscription_end_date ?? null,
    is_seller:
      src.is_seller === true ||
      src.is_seller === 'true' ||
      ['seller_lite', 'seller_pro', 'business'].includes(effectiveTier),
    last_tier: lastTier,
    last_tier_name: src.last_tier_name || fallbackData?.last_tier_name || null,
    is_team_member: src.is_team_member === true || src.is_team_member === 'true',
    team_owner_id: src.team_owner_id ? Number(src.team_owner_id) : null,
    team_owner_username: src.team_owner_username || null,
    business_name: src.business_name || fallbackData?.business_name || null,
    team_role_preset: src.team_role_preset || null,
    team_role_label: src.team_role_label || null,
    is_team_suspended: src.is_team_suspended === true || src.is_team_suspended === 'true',
    is_owner_subscription_active:
      src.is_owner_subscription_active === true || src.is_owner_subscription_active === 'true',
    team_permissions: parsedTeamPerms,
    terms_accepted: src.terms_accepted === true || src.terms_accepted === 'true',
    profile_picture: src.profile_picture || fallbackData?.profile_picture || null,
    assigned_locations: Array.isArray(src.assigned_locations)
      ? src.assigned_locations
      : Array.isArray(fallbackData?.assigned_locations)
        ? fallbackData.assigned_locations
        : [],
    active_location: src.active_location || fallbackData?.active_location || null,
    is_multi_location: Boolean(src.is_multi_location || fallbackData?.is_multi_location),
  };
}

export interface UserRoleState {
  isSuperuser: boolean;
  isStaff: boolean;
  isInspector: boolean;
  isTeamMember: boolean;
  isSellerLite: boolean;
  isSellerPro: boolean;
  isBusiness: boolean;
  hasActiveSubscription: boolean;
  isSellerAccount: boolean;
  isExpiredSeller: boolean;
  isActiveSeller: boolean;
  isPureCustomer: boolean;
  canAccessSellerDashboard: boolean;
}

export const getUserRoleState = (user: User | null): UserRoleState => {
  if (!user) {
    return {
      isSuperuser: false,
      isStaff: false,
      isInspector: false,
      isTeamMember: false,
      isSellerLite: false,
      isSellerPro: false,
      isBusiness: false,
      hasActiveSubscription: false,
      isSellerAccount: false,
      isExpiredSeller: false,
      isActiveSeller: false,
      isPureCustomer: true,
      canAccessSellerDashboard: false,
    };
  }

  const isSuperuser = user.is_superuser === true;
  const isStaff = user.is_staff === true;
  const isInspector = user.is_inspector === true;
  const isTeamMember = user.is_team_member === true || user.tier === 'worker';

  const hasActiveSubscription = user.subscription_active === true && user.subscription_expired !== true;

  const isSellerLite = user.tier === 'seller_lite' || (hasActiveSubscription && user.last_tier === 'seller_lite');
  const isSellerPro = user.tier === 'seller_pro' || (hasActiveSubscription && user.last_tier === 'seller_pro');
  const isBusiness = user.tier === 'business' || (hasActiveSubscription && user.last_tier === 'business');

  const hasValidSellerTier =
    user.last_tier === 'seller_lite' ||
    user.last_tier === 'seller_pro' ||
    user.last_tier === 'business' ||
    isSellerLite ||
    isSellerPro ||
    isBusiness;

  const isSellerAccount =
    (user.is_seller === true && user.tier !== 'customer') ||
    isSellerLite ||
    isSellerPro ||
    isBusiness ||
    (user.subscription_expired === true && hasValidSellerTier);

  const isActiveSeller = isSuperuser || (isSellerAccount && hasActiveSubscription);
  const isExpiredSeller = !isSuperuser && isSellerAccount && !hasActiveSubscription;

  const isPureCustomer =
    !isSellerAccount && !isExpiredSeller && !isStaff && !isSuperuser && !isInspector && !isTeamMember;

  const canAccessSellerDashboard =
    isSuperuser ||
    (isActiveSeller && !isExpiredSeller) ||
    (isTeamMember && user.is_owner_subscription_active === true);

  return {
    isSuperuser,
    isStaff,
    isInspector,
    isTeamMember,
    isSellerLite,
    isSellerPro,
    isBusiness,
    hasActiveSubscription,
    isSellerAccount,
    isExpiredSeller,
    isActiveSeller,
    isPureCustomer,
    canAccessSellerDashboard,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const existingToken = getAccessToken();
    return existingToken ? buildUserFromToken(existingToken) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getAccessToken()));
  const [loading, setLoading] = useState<boolean>(() => !getAccessToken() && hasSessionHintCookie());

  const [activeLocation, setActiveLocationState] = useState<StoreLocationBrief | null>(() => {
    try {
      const stored = sessionStorage.getItem(ACTIVE_LOCATION_SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const logoutInFlightRef = useRef(false);

  const setActiveLocation = useCallback((loc: StoreLocationBrief | null) => {
    setActiveLocationState(loc);
    try {
      if (loc) {
        sessionStorage.setItem(ACTIVE_LOCATION_SESSION_KEY, JSON.stringify(loc));
      } else {
        sessionStorage.removeItem(ACTIVE_LOCATION_SESSION_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const syncSubscriptionState = useCallback(async () => {
    try {
      const res = await api.get('/api/subscriptions/me/');
      if (res.data && res.data.status !== 'none' && res.data.is_seller === true) {
        const isExpired = res.data.is_expired === true;
        const isActive = res.data.is_active === true && !isExpired;
        const lastTier = res.data.tier?.tier_level || res.data.last_tier || null;
        const lastTierName = res.data.tier?.name || res.data.last_tier_name || null;

        setUser((prev) =>
          prev
            ? {
                ...prev,
                tier:
                  isActive && lastTier
                    ? lastTier
                    : ['seller_lite', 'seller_pro', 'business'].includes(prev.tier)
                      ? isActive
                        ? prev.tier
                        : 'customer'
                      : prev.tier,
                subscription_expired: isExpired,
                subscription_active: isActive,
                is_seller: true,
                last_tier: lastTier,
                last_tier_name: lastTierName,
              }
            : null
        );
      } else {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                subscription_expired: false,
                subscription_active: false,
                is_seller: false,
                last_tier: null,
                last_tier_name: null,
              }
            : null
        );
      }
    } catch {
      // ignore background sync failures
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const newAccess = await refreshAccessToken();
    if (!newAccess) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }
    const parsedUser = buildUserFromToken(newAccess);
    setUser(parsedUser);
    setIsAuthenticated(Boolean(parsedUser));
    if (parsedUser?.active_location && !activeLocation) {
      setActiveLocation(parsedUser.active_location);
    }
    await syncSubscriptionState();
  }, [activeLocation, setActiveLocation, syncSubscriptionState]);

  const logout = useCallback(async () => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;

    try {
      // 1. Best-effort WebPush unsubscribe (bounded to 1.5s so logout never hangs)
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        await Promise.race([
          navigator.serviceWorker
            .getRegistration()
            .then((reg) => reg?.pushManager?.getSubscription())
            .then((sub) => (sub ? sub.unsubscribe() : false))
            .catch(() => false),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      }

      // 2. Server-side refresh token blacklist & HttpOnly cookie deletion
      if (getAccessToken() || hasSessionHintCookie()) {
        await api.post('/api/auth/logout/').catch(() => {});
      }

      // 3. Clear in-memory JWT, API/product caches, rec queues, offline vault & sessionStorage
      clearAccessToken();
      apiCache.clear();
      invalidateProductCache();
      clearRecQueues();
      await clearOfflineVault().catch(() => {});
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }

      // 4. Preserve ONLY non-PII UI preferences in localStorage
      try {
        const preserved: Record<string, string> = {};
        for (const key of PRESERVED_LOGOUT_KEYS) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            preserved[key] = val;
          }
        }
        localStorage.clear();
        for (const [key, val] of Object.entries(preserved)) {
          localStorage.setItem(key, val);
        }
      } catch {
        // ignore
      }

      setActiveLocationState(null);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      logoutInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    purgeLegacyAuthStorage();
    setLogoutCallback(() => {
      void logout();
    });
  }, [logout]);

  // Silent bootstrap on mount ONLY when sm_logged_in=1 hint cookie exists (0 auth requests for cold anon visitors)
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const existing = getAccessToken();
      if (existing) {
        const parsed = buildUserFromToken(existing);
        if (!cancelled) {
          setUser(parsed);
          setIsAuthenticated(Boolean(parsed));
          setLoading(false);
        }
        if (parsed) {
          void syncSubscriptionState();
        }
        return;
      }

      if (!hasSessionHintCookie()) {
        if (!cancelled) {
          setUser(null);
          setIsAuthenticated(false);
          setLoading(false);
        }
        return;
      }

      const refreshed = await refreshAccessToken();
      if (cancelled) return;

      if (refreshed) {
        const parsed = buildUserFromToken(refreshed);
        setUser(parsed);
        setIsAuthenticated(Boolean(parsed));
        if (parsed?.active_location) {
          setActiveLocationState((prev) => prev || parsed.active_location || null);
        }
        setLoading(false);
        void syncSubscriptionState();
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [syncSubscriptionState]);

  const login = useCallback(
    (tokens: { access: string; refresh?: string }, userData?: any) => {
      purgeLegacyAuthStorage();
      setAccessToken(tokens.access);
      const parsed = buildUserFromToken(tokens.access, userData);
      setUser(parsed);
      setIsAuthenticated(Boolean(parsed));
      setLoading(false);
      if (parsed?.active_location) {
        setActiveLocation(parsed.active_location);
      }
      void syncSubscriptionState();
    },
    [setActiveLocation, syncSubscriptionState]
  );

  const acceptTerms = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, terms_accepted: true } : null));
  }, []);

  const assignedLocations = useMemo(() => {
    return user?.assigned_locations || [];
  }, [user]);

  const isMultiLocation = useMemo(() => {
    return (user?.is_multi_location || assignedLocations.length > 1) ?? false;
  }, [user, assignedLocations]);

  const roleState = useMemo(() => getUserRoleState(user), [user]);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      loading,
      user,
      isSeller: ['seller_lite', 'seller_pro', 'business'].includes(user?.tier || '') || roleState.isSellerAccount,
      isSellerLite: user?.tier === 'seller_lite' || roleState.isSellerLite,
      login,
      logout,
      refreshUser,
      acceptTerms,
      activeLocation,
      setActiveLocation,
      assignedLocations,
      isMultiLocation,
    }),
    [
      isAuthenticated,
      loading,
      user,
      roleState,
      login,
      logout,
      refreshUser,
      acceptTerms,
      activeLocation,
      setActiveLocation,
      assignedLocations,
      isMultiLocation,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useUserRoles = (): UserRoleState => {
  const { user } = useAuth();
  return useMemo(() => getUserRoleState(user), [user]);
};
