import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import { Shield, Clock, MapPin, Truck, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';

const getWsBase = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

const WS_BASE = getWsBase();

interface Ping {
  lat: number;
  lng: number;
  recorded_at: string;
  source: string;
}

interface Shipment {
  id: number;
  order: number;
  carrier_type: string;
  driver_username: string | null;
  customer_username: string;
  tracking_number: string;
  status: string;
  estimated_delivery: string | null;
}

const LeafletMap: React.FC<{ lat: number; lng: number; stale: boolean }> = ({ lat, lng, stale }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      try {
        document.head.removeChild(link);
        document.head.removeChild(script);
      } catch (e) {
        // ignore
      }
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current) {
      // Initialize map
      mapRef.current = L.map(mapContainerRef.current).setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);

      markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
    } else {
      // Update marker and map view
      const newLatLng = new L.LatLng(lat, lng);
      markerRef.current.setLatLng(newLatLng);
      mapRef.current.panTo(newLatLng);
    }

    const iconEl = markerRef.current.getElement();
    if (iconEl) {
      if (stale) {
        iconEl.style.filter = 'grayscale(100%) brightness(80%) sepia(100%) hue-rotate(-50deg) saturate(600%)'; // turn red/stale
        iconEl.style.opacity = '0.7';
      } else {
        iconEl.style.filter = 'hue-rotate(120deg) saturate(3)'; // bright green/live
        iconEl.style.opacity = '1';
      }
    }
  }, [leafletLoaded, lat, lng, stale]);

  return (
    <div className="relative w-full h-[450px] rounded-xl overflow-hidden border border-gray-800 bg-[#0a0a0a] shadow-inner shadow-black">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};

export const ShipmentTrackingPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestPing, setLatestPing] = useState<Ping | null>(null);
  const [stale, setStale] = useState(false);
  const [deliveryCode, setDeliveryCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Poll for staleness every 10 seconds
  useEffect(() => {
    const checkStaleness = () => {
      if (!latestPing) return;
      const pingTime = new Date(latestPing.recorded_at).getTime();
      const now = new Date().getTime();
      const differenceMinutes = (now - pingTime) / (1000 * 60);
      setStale(differenceMinutes > 5);
    };

    checkStaleness();
    const interval = setInterval(checkStaleness, 10000);
    return () => clearInterval(interval);
  }, [latestPing]);

  // Connect WebSocket for real-time tracking
  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem('access_token') || '';
    const wsUrl = `${WS_BASE}/ws/shipment/tracking/${id}/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'location_ping') {
          const newPing: Ping = {
            lat: data.lat,
            lng: data.lng,
            recorded_at: data.recorded_at,
            source: data.source
          };
          setLatestPing(newPing);
          // Check staleness immediately
          const differenceMinutes = (new Date().getTime() - new Date(newPing.recorded_at).getTime()) / (1000 * 60);
          setStale(differenceMinutes > 5);
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    ws.onclose = () => {
      // WebSocket disconnected
    };

    return () => {
      if (wsRef.current && wsRef.current.readyState < 2) {
        wsRef.current.close();
      }
    };
  }, [id]);

  // Fetch shipment detail and initial ping
  useEffect(() => {
    const fetchShipmentData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };

        const res = await axios.get(`${API_BASE_URL}/api/logistics/shipments/${id}/`, config);
        setShipment(res.data);

        // Fetch latest location ping (if any) from backend
        try {
          const pingRes = await axios.get(`${API_BASE_URL}/api/logistics/shipments/${id}/latest-ping/`, config);
          if (pingRes.data && pingRes.data.lat && pingRes.data.lng) {
            setLatestPing({
              lat: parseFloat(pingRes.data.lat),
              lng: parseFloat(pingRes.data.lng),
              recorded_at: pingRes.data.recorded_at,
              source: pingRes.data.source
            });
          } else {
            setLatestPing(null);
          }
        } catch {
          setLatestPing(null);
        }
      } catch (err: any) {
        toast.error("Failed to load tracking data.");
      } finally {
        setLoading(false);
      }
    };

    fetchShipmentData();
  }, [id]);

  const handleConfirmDelivery = async () => {
    if (!deliveryCode || deliveryCode.length !== 6) {
      toast.error("Please enter a valid 6-digit delivery code.");
      return;
    }
    
    setConfirming(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_BASE_URL}/api/logistics/shipments/${id}/confirm_delivery/`, 
        { code: deliveryCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Delivery confirmed successfully!");
      setShipment(prev => prev ? { ...prev, status: 'delivered' } : prev);
      setDeliveryCode('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to confirm delivery. Check the code.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-black text-white">
        <Spinner size="md" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-black text-white px-4">
        <EmptyState
          icon={MapPin}
          title={t('tracking_not_found', 'Tracking Not Found')}
          description={t('tracking_not_found_desc', "We couldn't find a shipment with this tracking ID.")}
          action={{
            label: t('back_to_orders', 'Back to Orders'),
            onClick: () => window.location.href = '/orders',
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Rebranded Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-surface-dark-border pb-6">
          <div>
            <div className="flex items-center space-x-2 text-brand-500 text-sm font-bold uppercase tracking-widest mb-1">
              <Truck className="h-4 w-4" />
              <span>{t('sokonimax_managed_delivery', 'SokoniMax Managed Delivery')}</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">
              {t('live_vehicle_tracking', 'Live Vehicle Tracking')}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500">
              <span>{t('shipment_for_order', 'Shipment for Order')}</span>
              <span className="text-gray-300 font-mono font-bold">#{shipment.order}</span>
              <span>&bull;</span>
              <span>{t('status_label', 'Status')}:</span>
              <StatusBadge status={shipment.status} size="sm" />
            </div>
          </div>
          <Link to="/orders" className="mt-4 md:mt-0 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 px-4 py-2 rounded-btn transition">
            {t('back_to_orders', 'Back to Orders')}
          </Link>
        </div>

        {/* Warning for Stale Location */}
        {stale && (
          <div className="flex items-center space-x-3 bg-amber-950/20 border border-amber-500/30 text-amber-500 p-4 rounded-xl animate-pulse">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-bold text-sm">Live signal lost</p>
              <p className="text-xs text-amber-500/80">The driver's location has not updated for more than 5 minutes. The marker shows the last recorded position.</p>
            </div>
          </div>
        )}

        {/* Leaflet Map Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {latestPing ? (
              <LeafletMap lat={latestPing.lat} lng={latestPing.lng} stale={stale} />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-card p-8 text-center text-gray-455">
                <MapPin className="h-12 w-12 text-brand-500 mb-4" />
                <p className="font-bold text-gray-900 dark:text-white text-lg">{t('waiting_for_signal', 'Waiting for First Location Signal')}</p>
                <p className="text-sm mt-1 max-w-md">{t('waiting_for_signal_desc', "The shipment has been registered, but the driver hasn't sent a location update yet. Live tracking will begin automatically once a signal is received.")}</p>
              </div>
            )}
          </div>

          {/* Details Sidebar */}
          <div className="card p-6 bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border space-y-6">
            <h3 className="text-sm font-black border-b border-surface-border dark:border-surface-dark-border pb-3 uppercase tracking-wider text-gray-900 dark:text-white">
              {t('delivery_details', 'Delivery Details')}
            </h3>

            {/* Carrier info */}
            <div className="space-y-4 text-sm">
              <div className="flex items-start space-x-3">
                <Truck className="h-5 w-5 text-brand-500 mt-0.5" />
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">{t('assigned_carrier', 'Assigned Carrier')}</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-200">{shipment.carrier_type === 'driver' ? t('sokonimax_fleet_driver', 'SokoniMax Fleet Driver') : t('third_party_courier', 'Third-Party Courier')}</p>
                  {shipment.driver_username && (
                    <p className="text-xs text-gray-400 font-mono">Driver: @{shipment.driver_username}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-brand-500 mt-0.5" />
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">{t('tracking_number', 'Tracking Number')}</p>
                  <p className="font-mono font-bold text-gray-300">{shipment.tracking_number || `SMX-TRK-${shipment.id}`}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-brand-500 mt-0.5" />
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">{t('estimated_delivery', 'Estimated Delivery')}</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-200">
                    {shipment.estimated_delivery 
                      ? new Date(shipment.estimated_delivery).toLocaleString()
                      : t('calculating', 'Calculating...')}
                  </p>
                </div>
              </div>
            </div>

            {/* Live Indicator */}
            <div className="border-t border-surface-border dark:border-surface-dark-border pt-6">
              <div className="flex items-center space-x-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${stale ? 'bg-amber-500' : 'bg-green-500'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  {stale ? t('signal_stale', 'Signal Stale') : t('live_connection_active', 'Live Connection Active')}
                </span>
              </div>
              {latestPing && (
                <p className="text-[10px] text-gray-500 mt-2 font-mono">
                  {t('last_ping', 'Last Ping')}: {new Date(latestPing.recorded_at).toLocaleTimeString()} ({latestPing.lat.toFixed(4)}, {latestPing.lng.toFixed(4)})
                </p>
              )}
            </div>

            {/* Driver Console */}
            {user && (user.username === shipment.driver_username || user.is_staff) && shipment.status !== 'delivered' && (
              <div className="border-t border-surface-border dark:border-surface-dark-border pt-6 mt-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-brand-500 mb-4 flex items-center gap-2">
                  <Shield size={16} /> {t('driver_console', 'Driver Console')}
                </h3>
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">
                    {t('driver_console_instructions', 'Ask the customer for their 6-digit delivery code to finalize this delivery.')}
                  </p>
                  <input
                    type="text"
                    value={deliveryCode}
                    onChange={(e) => setDeliveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="e.g. 123456"
                    className="w-full bg-[#111] border border-surface-dark-border focus:border-brand-500 rounded-btn px-4 py-3 text-center font-mono font-bold text-xl tracking-[0.2em] text-white outline-none"
                  />
                  <Button
                    onClick={handleConfirmDelivery}
                    disabled={confirming || deliveryCode.length !== 6}
                    loading={confirming}
                    className="w-full py-3"
                  >
                    {!confirming && <CheckCircle size={16} className="mr-2" />}
                    {t('confirm_delivery', 'Confirm Delivery')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ShipmentTrackingPage;
