import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = 'ws://localhost:8000';

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

  const connect = useCallback(() => {
    if (!path || !enabled) return;

    const token = localStorage.getItem('access_token') || '';
    const url = `${WS_BASE}/ws/tracking/${path}/?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Connected
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
      // Auto-reconnect after 3s
      reconnectTimeout.current = setTimeout(() => {
        if (enabled) connect();
      }, 3000);
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
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return wsRef;
}
