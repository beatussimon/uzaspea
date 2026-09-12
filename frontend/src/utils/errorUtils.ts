/**
 * Utility functions to classify and format API and network errors.
 * Ensures the user is explicitly informed when an issue is due to
 * connectivity, timeouts, or backend server errors rather than user actions.
 */

export type ApiErrorType = 'offline' | 'timeout' | 'server' | 'notFound' | 'client' | 'unknown';

export interface ClassifiedError {
  type: ApiErrorType;
  /** True for client offline, request timeout, or 5xx server issues */
  isNetworkOrServer: boolean;
  canRetry: boolean;
  statusCode?: number;
  titleKey: string;
  descKey: string;
  defaultTitle: string;
  defaultDesc: string;
  rawMessage?: string;
}

export function classifyApiError(error: any): ClassifiedError {
  if (!error) {
    return {
      type: 'unknown',
      isNetworkOrServer: false,
      canRetry: true,
      titleKey: 'error_network_title',
      descKey: 'error_network_desc',
      defaultTitle: 'Something went wrong',
      defaultDesc: "It's not you! An unexpected issue occurred. Please try again.",
    };
  }

  // 1. Browser explicitly offline
  const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (isBrowserOffline) {
    return {
      type: 'offline',
      isNetworkOrServer: true,
      canRetry: true,
      titleKey: 'error_network_title',
      descKey: 'error_network_desc',
      defaultTitle: 'Connection Problem',
      defaultDesc: "It's not you! We couldn't connect to SokoniMax. Please check your internet connection and try again.",
      rawMessage: error?.message,
    };
  }

  const statusCode = error?.response?.status;
  const errorCode = error?.code;
  const errorMessage = String(error?.message || '').toLowerCase();

  // 2. Request Timeout
  if (errorCode === 'ECONNABORTED' || errorMessage.includes('timeout')) {
    return {
      type: 'timeout',
      isNetworkOrServer: true,
      canRetry: true,
      statusCode,
      titleKey: 'error_timeout_title',
      descKey: 'error_timeout_desc',
      defaultTitle: 'Connection Timed Out',
      defaultDesc: "It's not you! The request took too long to respond. The network might be slow or unstable.",
      rawMessage: error?.message,
    };
  }

  // 3. Network Failure / Connection Refused / No Response
  if (
    errorCode === 'ERR_NETWORK' ||
    errorMessage.includes('network error') ||
    errorMessage.includes('failed to fetch') ||
    (error?.isAxiosError && !error.response)
  ) {
    return {
      type: 'offline',
      isNetworkOrServer: true,
      canRetry: true,
      titleKey: 'error_network_title',
      descKey: 'error_network_desc',
      defaultTitle: 'Connection Problem',
      defaultDesc: "It's not you! We couldn't connect to SokoniMax. Please check your internet connection and try again.",
      rawMessage: error?.message,
    };
  }

  // 4. Server Errors (500, 502, 503, 504)
  if (typeof statusCode === 'number' && statusCode >= 500) {
    return {
      type: 'server',
      isNetworkOrServer: true,
      canRetry: true,
      statusCode,
      titleKey: 'error_server_title',
      descKey: 'error_server_desc',
      defaultTitle: 'Server Problem',
      defaultDesc: "It's not you! Our servers are experiencing issues right now. Our team is on it.",
      rawMessage: error?.message,
    };
  }

  // 5. Not Found (404)
  if (statusCode === 404) {
    return {
      type: 'notFound',
      isNetworkOrServer: false,
      canRetry: false,
      statusCode: 404,
      titleKey: 'product_not_found',
      descKey: 'product_not_found',
      defaultTitle: 'Not Found',
      defaultDesc: 'The requested product or resource could not be found.',
      rawMessage: error?.message,
    };
  }

  // 6. Other Client Errors (400, 401, 403, etc.)
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    return {
      type: 'client',
      isNetworkOrServer: false,
      canRetry: false,
      statusCode,
      titleKey: 'error_occurred',
      descKey: 'error_occurred',
      defaultTitle: 'Request Error',
      defaultDesc: error?.response?.data?.detail || error?.response?.data?.error || 'A client error occurred.',
      rawMessage: error?.message,
    };
  }

  // 7. Fallback Unknown
  return {
    type: 'unknown',
    isNetworkOrServer: true,
    canRetry: true,
    statusCode,
    titleKey: 'error_network_title',
    descKey: 'error_network_desc',
    defaultTitle: 'Connection Issue',
    defaultDesc: "It's not you! We encountered a problem loading this data. Please try again.",
    rawMessage: error?.message,
  };
}
