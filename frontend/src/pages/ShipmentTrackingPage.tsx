import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import { Shield, Clock, MapPin, Truck, AlertTriangle } from 'lucide-react';

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
  const { id } = useParams<{ id: string }>();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestPing, setLatestPing] = useState<Ping | null>(null);
  const [stale, setStale] = useState(false);
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
      console.log("WebSocket disconnected");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-black text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-black text-white">
        <MapPin className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Tracking Not Found</h2>
        <p className="text-gray-400 mb-6">We couldn't find a shipment with this tracking ID.</p>
        <Link to="/orders" className="btn-primary px-6 py-2">Back to Orders</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Rebranded Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-amber-500 text-sm font-bold uppercase tracking-widest mb-1">
              <Truck className="h-4 w-4" />
              <span>SokoniMax Managed Delivery</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">
              Live Vehicle Tracking
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Shipment for Order <span className="text-gray-300 font-mono font-bold">#{shipment.order}</span> &bull; Status: <span className="text-amber-500 font-bold uppercase">{shipment.status}</span>
            </p>
          </div>
          <Link to="/orders" className="mt-4 md:mt-0 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 px-4 py-2 rounded-lg transition">
            Back to Orders
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
              <div className="flex flex-col items-center justify-center min-h-[400px] bg-[#0a0a0a] border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
                <MapPin className="h-12 w-12 text-amber-500 mb-4 animate-bounce" />
                <p className="font-bold text-white text-lg">Waiting for First Location Signal</p>
                <p className="text-sm mt-1 max-w-md">The shipment has been registered, but the driver hasn't sent a location update yet. Live tracking will begin automatically once a signal is received.</p>
              </div>
            )}
          </div>

          {/* Details Sidebar */}
          <div className="card p-6 bg-[#0a0a0a] border border-gray-800 space-y-6">
            <h3 className="text-lg font-bold border-b border-gray-900 pb-3 uppercase tracking-wider text-gray-400">
              Delivery Details
            </h3>

            {/* Carrier info */}
            <div className="space-y-4 text-sm">
              <div className="flex items-start space-x-3">
                <Truck className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">Assigned Carrier</p>
                  <p className="font-semibold text-gray-200">{shipment.carrier_type === 'driver' ? 'SokoniMax Fleet Driver' : 'Third-Party Courier'}</p>
                  {shipment.driver_username && (
                    <p className="text-xs text-gray-400 font-mono">Driver: @{shipment.driver_username}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">Tracking Number</p>
                  <p className="font-mono font-bold text-gray-300">{shipment.tracking_number || `SMX-TRK-${shipment.id}`}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">Estimated Delivery</p>
                  <p className="font-semibold text-gray-200">
                    {shipment.estimated_delivery 
                      ? new Date(shipment.estimated_delivery).toLocaleString()
                      : 'Calculating...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Live Indicator */}
            <div className="border-t border-gray-900 pt-6">
              <div className="flex items-center space-x-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${stale ? 'bg-amber-500' : 'bg-green-500 animate-ping'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  {stale ? 'Signal Stale' : 'Live Connection Active'}
                </span>
              </div>
              {latestPing && (
                <p className="text-[10px] text-gray-500 mt-2 font-mono">
                  Last Ping: {new Date(latestPing.recorded_at).toLocaleTimeString()} ({latestPing.lat.toFixed(4)}, {latestPing.lng.toFixed(4)})
                </p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ShipmentTrackingPage;
