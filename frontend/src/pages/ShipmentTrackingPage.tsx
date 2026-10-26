import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import { MapPin, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { OrderActionToolbar } from '../components/ui/OrderActionToolbar';

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
  is_bulk_order?: boolean;
  delivery_address?: string;
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current) {
      if ((mapContainerRef.current as any)._leaflet_id) {
        (mapContainerRef.current as any)._leaflet_id = null;
      }
      // Initialize map
      mapRef.current = L.map(mapContainerRef.current).setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);

      markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 150);
    } else {
      // Update marker and map view
      const newLatLng = new L.LatLng(lat, lng);
      markerRef.current.setLatLng(newLatLng);
      mapRef.current.panTo(newLatLng);
      mapRef.current.invalidateSize();
    }

    const iconEl = markerRef.current?.getElement();
    if (iconEl) {
      if (stale) {
        iconEl.style.filter = 'grayscale(100%) brightness(80%) sepia(100%) hue-rotate(-50deg) saturate(600%)'; // turn red/stale
        iconEl.style.opacity = '0.7';
      } else {
        iconEl.style.filter = 'hue-rotate(120deg) saturate(3)'; // bright green/live
        iconEl.style.opacity = '1';
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded, lat, lng, stale]);

  return (
    <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[400px] rounded-2xl overflow-hidden bg-[#0a0a0a]">
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
  const [locationName, setLocationName] = useState<string>('');
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

  // Reverse-geocode ping coordinates into human-readable place name
  useEffect(() => {
    if (!latestPing?.lat || !latestPing?.lng) {
      setLocationName('');
      return;
    }
    let isCurrent = true;
    const fetchLocationName = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/reverse-geocode/`, {
          params: { lat: latestPing.lat, lng: latestPing.lng }
        });
        if (isCurrent && res.data?.address) {
          setLocationName(res.data.address);
        }
      } catch (err) {
        if (isCurrent && !locationName) {
          setLocationName('Dar es Salaam, Tanzania');
        }
      }
    };
    fetchLocationName();
    return () => { isCurrent = false; };
  }, [latestPing?.lat, latestPing?.lng]);

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
    <div className="min-h-screen bg-black text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {t('live_vehicle_tracking', 'Live Shipment Tracking')}
          </h1>
          <Link to="/orders" className="text-sm font-medium text-neutral-400 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 px-4 py-2 rounded-btn transition shrink-0">
            {t('back_to_orders', 'Back to Orders')}
          </Link>
        </div>

        {/* Responsive Grid: Desktop 3 columns side-by-side with equal gaps; Mobile map on top, 2 sections below */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* 1. Map (Top on mobile, Left on desktop: 50% width) */}
          <div className="lg:col-span-6 flex flex-col">
            {latestPing ? (
              <LeafletMap lat={latestPing.lat} lng={latestPing.lng} stale={stale} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[260px] sm:h-[320px] lg:h-[400px] bg-[#0A0A0A] rounded-2xl p-6 text-center text-neutral-400">
                <p className="font-semibold text-white text-base">{t('waiting_for_signal', 'Waiting for Location Signal')}</p>
                <p className="text-xs mt-1 max-w-sm text-neutral-400">{t('waiting_for_signal_desc', "Live tracking will begin automatically once the driver's device transmits a location signal.")}</p>
              </div>
            )}
          </div>

          {/* 2. Delivery Details (Middle on desktop: 25% width; Unboxed, mobile key-value aligned right) */}
          <div className="lg:col-span-3 flex flex-col justify-between space-y-4 lg:h-[400px]">
            <div>
              <h2 className="text-base font-bold text-white mb-3">
                {t('delivery_details', 'Delivery Details')}
              </h2>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                  <p className="text-neutral-500 text-xs font-medium">{t('shipment_for_order', 'Order Reference')}</p>
                  <div className="flex items-center gap-1.5 text-right lg:text-left">
                    <span className="text-neutral-200 font-mono font-bold text-sm">#{shipment.order}</span>
                    {shipment.is_bulk_order && (
                      <span className="px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-amber-500 text-black">
                        {t('bulk_order', 'Bulk')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                  <p className="text-neutral-500 text-xs font-medium">{t('status_label', 'Status')}</p>
                  <div className="text-right lg:text-left">
                    <StatusBadge status={shipment.status} size="sm" />
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                  <p className="text-neutral-500 text-xs font-medium">{t('assigned_carrier', 'Assigned Carrier')}</p>
                  <div className="text-right lg:text-left">
                    <p className="font-semibold text-neutral-200 text-sm">
                      {shipment.carrier_type === 'driver' ? t('sokonimax_fleet_driver', 'SokoniMax Fleet Driver') : t('third_party_courier', 'Third-Party Courier')}
                    </p>
                    {shipment.driver_username && (
                      <p className="text-2xs text-neutral-400 font-mono">Driver: @{shipment.driver_username}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                  <p className="text-neutral-500 text-xs font-medium">{t('tracking_number', 'Tracking Number')}</p>
                  <p className="font-mono font-semibold text-neutral-200 text-xs text-right lg:text-left">
                    {shipment.tracking_number || `SMX-TRK-${shipment.id}`}
                  </p>
                </div>

                {shipment.delivery_address && (
                  <div className="flex justify-between items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                    <p className="text-neutral-500 text-xs font-medium">Destination</p>
                    <p className="font-medium text-neutral-300 text-xs truncate max-w-[200px] text-right lg:text-left" title={shipment.delivery_address}>
                      {shipment.delivery_address}
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                  <p className="text-neutral-500 text-xs font-medium">{t('estimated_delivery', 'Estimated Delivery')}</p>
                  <p className="font-semibold text-neutral-200 text-xs text-right lg:text-left">
                    {shipment.estimated_delivery 
                      ? new Date(shipment.estimated_delivery).toLocaleString()
                      : t('calculating', 'Calculating...')}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <OrderActionToolbar
                username={user?.username === shipment.driver_username ? shipment.customer_username : shipment.driver_username}
                messageLabel={user?.username === shipment.driver_username ? "Chat with Buyer" : "Chat with Driver"}
                location={latestPing ? { lat: latestPing.lat, lng: latestPing.lng } : null}
                locationLabel="Live Destination"
                orderId={shipment.order}
                size="sm"
              />
            </div>
          </div>

          {/* 3. Signal & Handover / Driver Console (Right on desktop: 25% width; Unboxed, mobile key-value aligned right) */}
          <div className="lg:col-span-3 flex flex-col justify-between space-y-4 lg:h-[400px]">
            <div>
              <h2 className="text-base font-bold text-white mb-3">
                {user && (user.username === shipment.driver_username || user.is_staff) && shipment.status !== 'delivered'
                  ? t('driver_console', 'Driver Console')
                  : t('signal_handover', 'Signal & Security')}
              </h2>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                  <p className="text-xs text-neutral-500 font-medium">Signal Status</p>
                  <p className={`text-sm font-semibold text-right lg:text-left ${stale ? 'text-red-500' : 'text-emerald-400'}`}>
                    {stale ? t('signal_stale', 'Signal lost (>5m)') : t('live_connection_active', 'Live connection active')}
                  </p>
                </div>

                <div className="flex justify-between items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                  <p className="text-xs text-neutral-500 font-medium">{stale ? 'Last Known Location' : 'Current Location'}</p>
                  <p className="text-sm font-semibold text-neutral-200 text-right lg:text-left leading-snug">
                    {locationName || (latestPing ? t('resolving_location', 'Resolving location...') : t('waiting_for_signal', 'Waiting for signal'))}
                  </p>
                </div>

                <div className="flex justify-between items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                  <p className="text-xs text-neutral-500 font-medium">{t('last_ping', 'Last Signal Recorded')}</p>
                  <p className="text-sm font-medium text-neutral-200 text-right lg:text-left">
                    {latestPing ? new Date(latestPing.recorded_at).toLocaleTimeString() : 'No signal recorded'}
                  </p>
                </div>

                {/* If regular customer: Handover PIN info */}
                {(!user || (user.username !== shipment.driver_username && !user.is_staff)) && (
                  <div className="text-xs text-neutral-400 space-y-1 mt-2">
                    <p className="font-semibold text-neutral-200">Delivery Security PIN</p>
                    <p>Share your 6-digit delivery PIN with the driver only upon physical receipt of your package.</p>
                  </div>
                )}
              </div>
            </div>

            {/* If driver/staff: Driver verification form */}
            {user && (user.username === shipment.driver_username || user.is_staff) && shipment.status !== 'delivered' && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-neutral-400">
                  {t('driver_console_instructions', 'Enter 6-digit delivery PIN to confirm delivery.')}
                </p>
                <input
                  type="text"
                  value={deliveryCode}
                  onChange={(e) => setDeliveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit PIN"
                  className="w-full bg-[#111] rounded-btn px-3 py-2 text-center font-mono font-bold text-base tracking-[0.2em] text-white outline-none focus:ring-1 focus:ring-brand-500"
                />
                <Button
                  onClick={handleConfirmDelivery}
                  disabled={confirming || deliveryCode.length !== 6}
                  loading={confirming}
                  className="w-full py-2 text-xs"
                >
                  {!confirming && <CheckCircle size={14} className="mr-1.5" />}
                  {t('confirm_delivery', 'Confirm Delivery')}
                </Button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ShipmentTrackingPage;
