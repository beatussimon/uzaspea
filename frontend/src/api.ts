import axios from 'axios';

const API_BASE_URL = import.meta.env.DEV ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') : '';  // FIX S-18

const api = axios.create({
  baseURL: API_BASE_URL,
});

// CSRF token extraction from cookies (Global CSRF Injection)
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

// Request interceptor: attach JWT and CSRF tokens
api.interceptors.request.use((config) => {
  // JWT from localStorage
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // CSRF token from Django cookie
  const csrfToken = getCookie('csrftoken');
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }

  return config;
});

let logoutCallback: (() => void) | null = null;

export const setLogoutCallback = (cb: () => void) => {
  logoutCallback = cb;
};

// Response interceptor: handle auth errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401) {
      if (error.response.data?.code === 'user_inactive' || error.response.data?.code === 'user_banned') {
        localStorage.setItem('account_banned', 'true');
      }
      
      if (!originalRequest._retry && error.response.data?.code !== 'user_banned') {
        originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, { refresh: refreshToken });
          localStorage.setItem('access_token', res.data.access);
          api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access}`;
          originalRequest.headers['Authorization'] = `Bearer ${res.data.access}`;
          return api(originalRequest);
        } catch (refreshError) {
          if (logoutCallback) {
            logoutCallback();
          } else {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        if (logoutCallback) {
          logoutCallback();
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };

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
  } catch (error) {
    console.error("JWT Decode Error:", error);
    return null;
  }
}
