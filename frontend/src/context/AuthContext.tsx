import React, { createContext, useContext, useState, useEffect } from 'react';
import { setLogoutCallback, decodeJwtPayload } from '../api';

interface User {
  user_id: number;
  username: string;
  is_verified: boolean;
  tier: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_inspector: boolean;
  inspector_level: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (tokens: { access: string; refresh: string }, userData: any) => void;
  logout: () => void;
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
        // Expiry check
        if (payload.exp && payload.exp < Date.now() / 1000) {
          logout();
          return;
        }
        setUser({
          user_id: Number(payload.user_id),
          username: payload.username || '',
          is_verified: payload.is_verified === true || payload.is_verified === 'true',
          tier: payload.tier || 'free',
          is_staff: payload.is_staff === true || payload.is_staff === 'true',
          is_superuser: payload.is_superuser === true || payload.is_superuser === 'true',
          is_inspector: payload.is_inspector === true || payload.is_inspector === 'true',
          inspector_level: payload.inspector_level || '',
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
      localStorage.setItem('is_verified', String(payload.is_verified || false));
      localStorage.setItem('tier', payload.tier || 'free');
      localStorage.setItem('is_staff', String(payload.is_staff || false));
      localStorage.setItem('is_superuser', String(payload.is_superuser || false));
      localStorage.setItem('is_inspector', String(payload.is_inspector || false));
      localStorage.setItem('inspector_level', payload.inspector_level || '');
    } else {
      localStorage.setItem('user_id', String(userData.user_id));
      localStorage.setItem('username', userData.username);
      localStorage.setItem('is_verified', String(userData.is_verified || false));
      localStorage.setItem('tier', userData.tier || 'free');
      localStorage.setItem('is_staff', String(userData.is_staff || false));
      localStorage.setItem('is_superuser', String(userData.is_superuser || false));
      localStorage.setItem('is_inspector', String(userData.is_inspector || false));
      localStorage.setItem('inspector_level', userData.inspector_level || '');
    }
    
    setIsAuthenticated(true);
  };

  const logout = () => {
    const theme = localStorage.getItem('theme');
    localStorage.clear();
    if (theme) localStorage.setItem('theme', theme);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
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
