import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { setLogoutCallback, decodeJwtPayload } from '../api';

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
  inspector_level: string;
  subscription_active?: boolean;
  subscription_end_date?: string | null;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem('access_token')
  );

  useEffect(() => {
    setLogoutCallback(logout);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (isAuthenticated && token) {
      const payload = decodeJwtPayload(token);
      if (payload) {
        // Let the Axios interceptor handle token expiry and refresh automatically.
        setUser({
          user_id: Number(payload.user_id),
          username: payload.username || '',
          first_name: payload.first_name || localStorage.getItem('first_name') || '',
          last_name: payload.last_name || localStorage.getItem('last_name') || '',
          is_verified: payload.is_verified === true || payload.is_verified === 'true',
          tier: payload.tier || 'free',
          is_staff: payload.is_staff === true || payload.is_staff === 'true',
          is_superuser: payload.is_superuser === true || payload.is_superuser === 'true',
          is_inspector: payload.is_inspector === true || payload.is_inspector === 'true',
          inspector_level: payload.inspector_level || '',
          subscription_active: payload.subscription_active,
          subscription_end_date: payload.subscription_end_date,
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
        });
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
      localStorage.setItem('user_id', String(payload.user_id));
      localStorage.setItem('username', payload.username || '');
      localStorage.setItem('first_name', payload.first_name || '');
      localStorage.setItem('last_name', payload.last_name || '');
      localStorage.setItem('is_verified', String(payload.is_verified || false));
      localStorage.setItem('tier', payload.tier || 'free');
      localStorage.setItem('is_staff', String(payload.is_staff || false));
      localStorage.setItem('is_superuser', String(payload.is_superuser || false));
      localStorage.setItem('is_inspector', String(payload.is_inspector || false));
      localStorage.setItem('inspector_level', payload.inspector_level || '');
      localStorage.setItem('is_team_member', String(payload.is_team_member || false));
      if (payload.team_owner_id) localStorage.setItem('team_owner_id', String(payload.team_owner_id));
      if (payload.team_owner_username) localStorage.setItem('team_owner_username', payload.team_owner_username);
      if (payload.business_name) localStorage.setItem('business_name', payload.business_name);
      if (payload.team_role_preset) localStorage.setItem('team_role_preset', payload.team_role_preset);
      if (payload.team_role_label) localStorage.setItem('team_role_label', payload.team_role_label);
      localStorage.setItem('team_permissions', JSON.stringify(payload.team_permissions || {}));
      localStorage.setItem('terms_accepted', String(payload.terms_accepted || false));
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
