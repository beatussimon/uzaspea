import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { classifyApiError } from './errorUtils';

describe('classifyApiError', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    // Default online
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('classifies offline when navigator.onLine is false', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    const res = classifyApiError(new Error('Random error'));
    expect(res.type).toBe('offline');
    expect(res.isNetworkOrServer).toBe(true);
    expect(res.canRetry).toBe(true);
    expect(res.titleKey).toBe('error_network_title');
    expect(res.descKey).toBe('error_network_desc');
  });

  it('classifies ERR_NETWORK and network errors as offline/network issues', () => {
    const err = { code: 'ERR_NETWORK', message: 'Network Error', isAxiosError: true };
    const res = classifyApiError(err);
    expect(res.type).toBe('offline');
    expect(res.isNetworkOrServer).toBe(true);
    expect(res.canRetry).toBe(true);
  });

  it('classifies Axios network error without response as offline/network issue', () => {
    const err = { isAxiosError: true, message: 'Network Error' };
    const res = classifyApiError(err);
    expect(res.type).toBe('offline');
    expect(res.isNetworkOrServer).toBe(true);
  });

  it('classifies ECONNABORTED as timeout', () => {
    const err = { code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded', isAxiosError: true };
    const res = classifyApiError(err);
    expect(res.type).toBe('timeout');
    expect(res.isNetworkOrServer).toBe(true);
    expect(res.canRetry).toBe(true);
    expect(res.titleKey).toBe('error_timeout_title');
  });

  it('classifies 500, 502, 503, 504 as server errors', () => {
    for (const status of [500, 502, 503, 504]) {
      const err = { response: { status, data: { detail: 'Server Error' } }, isAxiosError: true };
      const res = classifyApiError(err);
      expect(res.type).toBe('server');
      expect(res.statusCode).toBe(status);
      expect(res.isNetworkOrServer).toBe(true);
      expect(res.canRetry).toBe(true);
      expect(res.titleKey).toBe('error_server_title');
    }
  });

  it('classifies 404 as notFound and not a network/server issue', () => {
    const err = { response: { status: 404 }, isAxiosError: true };
    const res = classifyApiError(err);
    expect(res.type).toBe('notFound');
    expect(res.isNetworkOrServer).toBe(false);
    expect(res.canRetry).toBe(false);
  });

  it('classifies 400 as client error', () => {
    const err = { response: { status: 400, data: { detail: 'Bad input' } }, isAxiosError: true };
    const res = classifyApiError(err);
    expect(res.type).toBe('client');
    expect(res.isNetworkOrServer).toBe(false);
  });
});
