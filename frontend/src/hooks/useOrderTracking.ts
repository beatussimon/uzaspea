import { useEffect, useRef, useCallback } from 'react';
import { fetchWsTicket } from '../api';

const getWsBase = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
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
 * Hook for real-time order tracking via WebSocket using single-use 30s ticket.
 */
export function useOrderTracking(
  path: string | number | null,
  onUpdate: (data: TrackingUpdate) => void,
  enabled = true
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const unmountedRef = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const retryCount = useRef(0);
  const MAX_RETRIES = 8;

  const connect = useCallback(async () => {
    if (!path || !enabled || unmountedRef.current) return;

    const ticket = await fetchWsTicket();
    if (!ticket || unmountedRef.current || !enabled) return;

    const url = `${WS_BASE}/ws/tracking/${path}/?ticket=${encodeURIComponent(ticket)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data: TrackingUpdate = JSON.parse(event.data);
        onUpdateRef.current(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      // Do not retry on normal close or geofence/auth rejection (4451 / 4001 / 4003)
      if (event.code === 1000 || event.code === 4451 || event.code === 4001 || event.code === 4003) {
        return;
      }
      if (!unmountedRef.current && enabled && retryCount.current < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        retryCount.current += 1;
        reconnectTimeout.current = setTimeout(() => {
          void connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [path, enabled]);

  useEffect(() => {
    unmountedRef.current = false;
    void connect();
    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        if (wsRef.current.readyState < 2) {
          wsRef.current.close(1000);
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  return wsRef;
}
