import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api, { setLogoutCallback, decodeJwtPayload } from '../api';

interface User {
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
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (tokens: { access: string; refresh: string }, userData: any) => void;
  logout: () => void;
  acceptTerms: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStoredUser = (): User | null => {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const subActive = payload.subscription_active !== undefined
    ? (payload.subscription_active === true || payload.subscription_active === 'true')
    : (localStorage.getItem('subscription_active') === 'true');

  const subExpired = subActive
    ? false
    : (payload.subscription_expired !== undefined
        ? (payload.subscription_expired === true || payload.subscription_expired === 'true')
        : (localStorage.getItem('subscription_expired') === 'true'));

  const effectiveTier = (subActive && (payload.last_tier || localStorage.getItem('last_tier')))
    ? (payload.last_tier || localStorage.getItem('last_tier'))
    : (payload.tier || localStorage.getItem('tier') || 'free');

  return {
    user_id: Number(payload.user_id),
    username: payload.username || '',
    first_name: payload.first_name || localStorage.getItem('first_name') || '',
    last_name: payload.last_name || localStorage.getItem('last_name') || '',
    is_verified: payload.is_verified === true || payload.is_verified === 'true',
    tier: effectiveTier,
    is_staff: payload.is_staff === true || payload.is_staff === 'true',
    is_superuser: payload.is_superuser === true || payload.is_superuser === 'true',
    is_inspector: payload.is_inspector === true || payload.is_inspector === 'true',
    has_staff_permissions: payload.has_staff_permissions === true || payload.has_staff_permissions === 'true',
    inspector_level: payload.inspector_level || '',
    subscription_active: subActive,
    subscription_expired: subExpired,
    subscription_end_date: payload.subscription_end_date,
    is_seller: payload.is_seller === true || payload.is_seller === 'true' || localStorage.getItem('is_seller') === 'true',
    last_tier: payload.last_tier || localStorage.getItem('last_tier') || null,
    last_tier_name: payload.last_tier_name || localStorage.getItem('last_tier_name') || null,
    is_team_member: payload.is_team_member === true || payload.is_team_member === 'true',
    team_owner_id: payload.team_owner_id || (localStorage.getItem('team_owner_id') ? Number(localStorage.getItem('team_owner_id')) : null),
    team_owner_username: payload.team_owner_username || localStorage.getItem('team_owner_username') || null,
    business_name: payload.business_name || localStorage.getItem('business_name') || null,
    team_role_preset: payload.team_role_preset || localStorage.getItem('team_role_preset') || null,
    team_role_label: payload.team_role_label || localStorage.getItem('team_role_label') || null,
    is_team_suspended: payload.is_team_suspended === true || payload.is_team_suspended === 'true',
    is_owner_subscription_active: payload.is_owner_subscription_active === true || payload.is_owner_subscription_active === 'true',
    team_permissions: typeof payload.team_permissions === 'string' ? JSON.parse(payload.team_permissions) : (payload.team_permissions || {}),
    terms_accepted: payload.terms_accepted === true || payload.terms_accepted === 'true' || localStorage.getItem('terms_accepted') === 'true',
    profile_picture: payload.profile_picture || localStorage.getItem('profile_picture') || null,
  };
};

export interface UserRoleState {
  isSuperuser: boolean;
  isStaff: boolean;
  isInspector: boolean;
  isTeamMember: boolean;
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

  // Subscriptions & Seller status:
  // hasActiveSubscription is strictly true only if subscription_active is true AND subscription_expired is NOT true.
  const hasActiveSubscription = user.subscription_active === true && user.subscription_expired !== true;

  const isSellerPro = user.tier === 'seller_pro' || (hasActiveSubscription && user.last_tier === 'seller_pro');
  const isBusiness = user.tier === 'business' || (hasActiveSubscription && user.last_tier === 'business');

  // Valid seller tiers are exclusively seller_pro and business
  const hasValidSellerTier = user.last_tier === 'seller_pro' || user.last_tier === 'business' || isSellerPro || isBusiness;

  // isSellerAccount: only users who have seller flag, active/past seller tier, or expired seller subscription
  // A customer tier or basic user is NEVER a seller account
  const isSellerAccount = (user.is_seller === true && user.tier !== 'customer') || isSellerPro || isBusiness || (user.subscription_expired === true && hasValidSellerTier);

  // Active seller: has seller account AND valid active subscription (superuser is exempt)
  const isActiveSeller = isSuperuser || (isSellerAccount && hasActiveSubscription);

  // Expired seller: has had a seller account, but does NOT have an active subscription (and is not superuser)
  const isExpiredSeller = !isSuperuser && isSellerAccount && !hasActiveSubscription;

  // Pure customer: has NEVER been a seller, not an expired seller, not staff/inspector/worker
  const isPureCustomer = !isSellerAccount && !isExpiredSeller && !isStaff && !isSuperuser && !isInspector && !isTeamMember;

  // Seller dashboard access:
  // Superusers always have access.
  // Active sellers have access (if not expired).
  // Workers have access IF their business owner's subscription is active.
  // Expired sellers have ZERO access (canAccessSellerDashboard = false).
  // Pure customers have ZERO access (canAccessSellerDashboard = false).
  const canAccessSellerDashboard = isSuperuser || 
    (isActiveSeller && !isExpiredSeller) ||
    (isTeamMember && user.is_owner_subscription_active === true);

  return {
    isSuperuser,
    isStaff,
    isInspector,
    isTeamMember,
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
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem('access_token')
  );

  useEffect(() => {
    setLogoutCallback(logout);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const storedUser = getStoredUser();
      if (storedUser) {
        setUser(storedUser);
        // Refresh live subscription status from backend
        api.get('/api/subscriptions/me/').then((res) => {
          if (res.data && res.data.status !== 'none' && res.data.is_seller === true) {
            const isExpired = res.data.is_expired === true;
            const isActive = res.data.is_active === true && !isExpired;
            const isSeller = true;
            const lastTier = res.data.tier?.tier_level || res.data.last_tier || null;
            const lastTierName = res.data.tier?.name || res.data.last_tier_name || null;

            localStorage.setItem('subscription_expired', String(isExpired));
            localStorage.setItem('subscription_active', String(isActive));
            localStorage.setItem('is_seller', String(isSeller));
            if (lastTier && ['seller_pro', 'business'].includes(lastTier)) {
              localStorage.setItem('last_tier', lastTier);
              if (isActive) localStorage.setItem('tier', lastTier);
            }
            if (lastTierName) localStorage.setItem('last_tier_name', lastTierName);

            setUser(prev => prev ? {
              ...prev,
              tier: (isActive && lastTier) ? lastTier : (prev.tier === 'seller_pro' || prev.tier === 'business' ? (isActive ? prev.tier : 'customer') : prev.tier),
              subscription_expired: isExpired,
              subscription_active: isActive,
              is_seller: isSeller,
              last_tier: lastTier,
              last_tier_name: lastTierName,
            } : null);
          } else {
            // Subscription is none, non-seller, or customer
            localStorage.setItem('subscription_expired', 'false');
            localStorage.setItem('subscription_active', 'false');
            localStorage.setItem('is_seller', 'false');
            localStorage.removeItem('last_tier');
            localStorage.removeItem('last_tier_name');
            setUser(prev => prev ? {
              ...prev,
              subscription_expired: false,
              subscription_active: false,
              is_seller: false,
              last_tier: null,
              last_tier_name: null,
            } : null);
          }
        }).catch(() => {});
      } else {
        logout();
      }
    } else {
      setUser(null);
    }
  }, [isAuthenticated]);

  const login = (tokens: { access: string; refresh: string }, userData: any) => {
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    
    const payload = decodeJwtPayload(tokens.access);
    if (payload) {
      const isSubActive = payload.subscription_active === true || payload.subscription_active === 'true';
      const isSubExpired = !isSubActive && (payload.subscription_expired === true || payload.subscription_expired === 'true');
      const effectiveTier = (isSubActive && payload.last_tier) ? payload.last_tier : (payload.tier || 'free');

      localStorage.setItem('user_id', String(payload.user_id));
      localStorage.setItem('username', payload.username || '');
      localStorage.setItem('first_name', payload.first_name || '');
      localStorage.setItem('last_name', payload.last_name || '');
      localStorage.setItem('is_verified', String(payload.is_verified || false));
      localStorage.setItem('tier', effectiveTier);
      localStorage.setItem('is_staff', String(payload.is_staff || false));
      localStorage.setItem('is_superuser', String(payload.is_superuser || false));
      localStorage.setItem('is_inspector', String(payload.is_inspector || false));
      localStorage.setItem('has_staff_permissions', String(payload.has_staff_permissions || false));
      localStorage.setItem('inspector_level', payload.inspector_level || '');
      localStorage.setItem('is_team_member', String(payload.is_team_member || false));
      if (payload.team_owner_id) localStorage.setItem('team_owner_id', String(payload.team_owner_id));
      if (payload.team_owner_username) localStorage.setItem('team_owner_username', payload.team_owner_username);
      if (payload.business_name) localStorage.setItem('business_name', payload.business_name);
      if (payload.team_role_preset) localStorage.setItem('team_role_preset', payload.team_role_preset);
      if (payload.team_role_label) localStorage.setItem('team_role_label', payload.team_role_label);
      localStorage.setItem('team_permissions', JSON.stringify(payload.team_permissions || {}));
      localStorage.setItem('terms_accepted', String(payload.terms_accepted || false));
      if (payload.is_seller !== undefined) localStorage.setItem('is_seller', String(payload.is_seller));
      localStorage.setItem('subscription_active', String(isSubActive));
      localStorage.setItem('subscription_expired', String(isSubExpired));
      if (payload.last_tier) localStorage.setItem('last_tier', payload.last_tier);
      if (payload.last_tier_name) localStorage.setItem('last_tier_name', payload.last_tier_name);
      if (payload.profile_picture) localStorage.setItem('profile_picture', payload.profile_picture);
    } else {
      localStorage.setItem('user_id', String(userData.user_id));
      localStorage.setItem('username', userData.username);
      localStorage.setItem('first_name', userData.first_name || '');
      localStorage.setItem('last_name', userData.last_name || '');
      localStorage.setItem('is_verified', String(userData.is_verified || false));
      localStorage.setItem('tier', userData.tier || 'free');
      localStorage.setItem('is_staff', String(userData.is_staff || false));
      localStorage.setItem('is_superuser', String(userData.is_superuser || false));
      localStorage.setItem('is_inspector', String(userData.is_inspector || false));
      localStorage.setItem('has_staff_permissions', String(userData.has_staff_permissions || false));
      localStorage.setItem('inspector_level', userData.inspector_level || '');
      localStorage.setItem('is_team_member', String(userData.is_team_member || false));
      if (userData.team_owner_id) localStorage.setItem('team_owner_id', String(userData.team_owner_id));
      if (userData.team_owner_username) localStorage.setItem('team_owner_username', userData.team_owner_username);
      if (userData.business_name) localStorage.setItem('business_name', userData.business_name);
      if (userData.team_role_preset) localStorage.setItem('team_role_preset', userData.team_role_preset);
      if (userData.team_role_label) localStorage.setItem('team_role_label', userData.team_role_label);
      localStorage.setItem('team_permissions', JSON.stringify(userData.team_permissions || {}));
      localStorage.setItem('terms_accepted', String(userData.terms_accepted || false));
      if (userData.profile_picture) localStorage.setItem('profile_picture', userData.profile_picture);
    }
    
    setUser(getStoredUser());
    setIsAuthenticated(true);
  };

  const logout = () => {
    const theme = localStorage.getItem('theme');
    const savedCart = localStorage.getItem('sokonimax_cart');
    localStorage.clear();
    if (theme) localStorage.setItem('theme', theme);
    if (savedCart) localStorage.setItem('sokonimax_cart', savedCart);
    setIsAuthenticated(false);
  };

  const acceptTerms = () => {
    if (user) {
      setUser({ ...user, terms_accepted: true });
      localStorage.setItem('terms_accepted', 'true');
    }
  };

  const contextValue = useMemo(() => ({ isAuthenticated, user, login, logout, acceptTerms }), [isAuthenticated, user]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
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

