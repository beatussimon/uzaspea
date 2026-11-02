import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  : '';

axios.defaults.withCredentials = true;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Strictly in-memory JWT access token — NEVER persisted to localStorage or sessionStorage
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export function hasSessionHintCookie(): boolean {
  return getCookie('sm_logged_in') === '1';
}

export interface RegionRestrictionPayload {
  code?: string;
  country_code?: string;
  country_name?: string;
  allowed_countries?: string[];
  title?: string;
  message?: string;
  support_email?: string;
}

let logoutCallback: (() => void) | null = null;
let regionRestrictedCallback: ((payload: RegionRestrictionPayload) => void) | null = null;

export const setLogoutCallback = (cb: () => void) => {
  logoutCallback = cb;
};

export const setRegionRestrictedCallback = (cb: ((payload: RegionRestrictionPayload) => void) | null) => {
  regionRestrictedCallback = cb;
};

function notifyRegionRestricted(data: any): void {
  if (regionRestrictedCallback) {
    regionRestrictedCallback({
      code: data?.code || 'region_restricted',
      country_code: data?.country_code || '',
      country_name: data?.country_name || '',
      allowed_countries: Array.isArray(data?.allowed_countries) ? data.allowed_countries : [],
      title: data?.title,
      message: data?.message,
      support_email: data?.support_email,
    });
  }
}

export function decodeJwtPayload(token: string): any | null {
  try {
    let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      if (pad === 1) throw new Error('InvalidLengthError');
      base64 += new Array(5 - pad).join('=');
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Single-flight refresh mutex so concurrent requests share one refresh roundtrip
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/auth/token/refresh/`,
        {},
        {
          withCredentials: true,
          headers,
        }
      );

      const newAccess: string | undefined = res.data?.access;
      if (newAccess) {
        accessToken = newAccess;
        return newAccess;
      }
      accessToken = null;
      return null;
    } catch (err: any) {
      if (err?.response?.status === 451 || err?.response?.data?.code === 'region_restricted') {
        notifyRegionRestricted(err.response?.data);
      }
      accessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function fetchWsTicket(): Promise<string | null> {
  try {
    const res = await api.post('/api/auth/ws-ticket/');
    return res.data?.ticket || null;
  } catch {
    return null;
  }
}

function isAuthBypassUrl(url = ''): boolean {
  return (
    url.includes('/api/auth/token/') ||
    url.includes('/api/auth/register/') ||
    url.includes('/api/auth/logout/') ||
    url.includes('/api/auth/check-username/') ||
    url.includes('/api/auth/password-reset/') ||
    url.includes('/api/geofence/status/')
  );
}

// Request interceptor: attach in-memory JWT, CSRF & X-Requested-With headers, and pre-expiry refresh
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineError: any = new Error('Network Error');
    offlineError.code = 'ERR_NETWORK';
    offlineError.isAxiosError = true;
    offlineError.config = config;
    return Promise.reject(offlineError);
  }

  config.headers = config.headers || ({} as any);
  config.headers['X-Requested-With'] = 'XMLHttpRequest';

  const csrfToken = getCookie('csrftoken');
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }

  try {
    const currentLang = localStorage.getItem('uzaspea_language') || 'en';
    config.headers['Accept-Language'] = currentLang;
  } catch {
    config.headers['Accept-Language'] = 'en';
  }

  const reqUrl = config.url || '';
  if (!isAuthBypassUrl(reqUrl)) {
    let token = accessToken;
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload?.exp && payload.exp * 1000 - Date.now() < 30_000) {
        token = await refreshAccessToken();
      }
    } else if (hasSessionHintCookie()) {
      token = await refreshAccessToken();
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

// Global axios interceptor to catch HTTP 451 Geofence responses on direct axios callers
axios.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    if (error.response?.status === 451 || error.response?.data?.code === 'region_restricted') {
      notifyRegionRestricted(error.response?.data);
    }
    return Promise.reject(error);
  }
);

// API response interceptor: handle HTTP 451 Geofence and HTTP 401 silent refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    if (error.response?.status === 451 || error.response?.data?.code === 'region_restricted') {
      notifyRegionRestricted(error.response?.data);
      return Promise.reject(error);
    }

    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && originalRequest) {
      const reqUrl = originalRequest.url || '';
      if (isAuthBypassUrl(reqUrl)) {
        return Promise.reject(error);
      }

      const errCode = error.response.data?.code;
      if (errCode === 'user_banned' || errCode === 'user_inactive') {
        clearAccessToken();
        if (logoutCallback) {
          logoutCallback();
        }
        return Promise.reject(error);
      }

      if (originalRequest._retry) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers = originalRequest.headers || ({} as any);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }

      clearAccessToken();
      if (logoutCallback) {
        logoutCallback();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
