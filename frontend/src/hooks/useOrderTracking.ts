import { useEffect, useRef, useCallback } from 'react';

const getWsBase = () => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  // Use current host but change protocol and port for local dev
  return isLocal ? 'ws://localhost:8000' : `wss://${window.location.host}`;
};

const WS_BASE = getWsBase();

export interface TrackingUpdate {
  type: string;
  order_id: number;
  status: string;
  old_status: string;
  notes: string;
  timestamp: string;
}

/**
 * Hook for real-time order tracking via WebSocket.
 * @param path - e.g. 'seller' or an order ID like '42'
 * @param onUpdate - callback when status update received
 * @param enabled - optionally disable the connection
 */
export function useOrderTracking(
  path: string | number | null,
  onUpdate: (data: TrackingUpdate) => void,
  enabled = true
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const retryCount = useRef(0);  // FIX L-20: track retry attempts
  const MAX_RETRIES = 8;         // FIX L-20: limit retries

  const connect = useCallback(() => {
    if (!path || !enabled) return;

    const token = localStorage.getItem('access_token') || '';
    const url = `${WS_BASE}/ws/tracking/${path}/?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;  // FIX L-20: reset on success
    };

    ws.onmessage = (event) => {
      try {
        const data: TrackingUpdate = JSON.parse(event.data);
        onUpdateRef.current(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (enabled && retryCount.current < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);  // FIX L-20: backoff
        retryCount.current += 1;
        reconnectTimeout.current = setTimeout(() => connect(), delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [path, enabled]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        // Only close if it's not already closing or closed
        if (wsRef.current.readyState < 2) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  return wsRef;
}
