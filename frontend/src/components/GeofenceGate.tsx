import React, { useState, useEffect } from 'react';
import { Globe, ShieldAlert, RefreshCw, Mail } from 'lucide-react';
import api, { setRegionRestrictedCallback, RegionRestrictionPayload } from '../api';

interface GeofenceGateProps {
  children: React.ReactNode;
}

export const GeofenceGate: React.FC<GeofenceGateProps> = ({ children }) => {
  const [isRestricted, setIsRestricted] = useState<boolean>(false);
  const [restrictionData, setRestrictionData] = useState<RegionRestrictionPayload | null>(null);
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    // 1. Subscribe to HTTP 451 responses triggered from any API request
    setRegionRestrictedCallback((payload) => {
      setIsRestricted(true);
      setRestrictionData(payload);
    });

    // 2. Initial lightweight status check on first load
    const checkStatus = async () => {
      try {
        const res = await api.get('/api/geofence/status/');
        if (res.data?.restricted) {
          setIsRestricted(true);
          setRestrictionData({
            code: 'region_restricted',
            country_code: res.data.country_code,
            country_name: res.data.country_name,
            allowed_countries: res.data.allowed_countries || [],
            title: res.data.title,
            message: res.data.detail,
          });
        }
      } catch (err: any) {
        if (err.response?.status === 451) {
          setIsRestricted(true);
          setRestrictionData(err.response.data);
        }
      }
    };

    checkStatus();

    return () => {
      setRegionRestrictedCallback(null);
    };
  }, []);

  const handleRetry = async () => {
    setChecking(true);
    try {
      const res = await api.get('/api/geofence/status/');
      if (!res.data?.restricted) {
        setIsRestricted(false);
        setRestrictionData(null);
      } else {
        setRestrictionData({
          code: 'region_restricted',
          country_code: res.data.country_code,
          country_name: res.data.country_name,
          allowed_countries: res.data.allowed_countries || [],
          title: res.data.title,
          message: res.data.detail,
        });
      }
    } catch (err: any) {
      if (err.response?.status === 451) {
        setRestrictionData(err.response.data);
      }
    } finally {
      setChecking(false);
    }
  };

  if (!isRestricted) {
    return <>{children}</>;
  }

  const title = restrictionData?.title || 'Service Not Available in Your Territory';
  const message =
    restrictionData?.message ||
    'SokoniMax marketplace and payment operations are restricted in your detected country or territory due to regional regulatory agreements.';
  const detectedCountry = restrictionData?.country_name || restrictionData?.country_code || 'Unknown';
  const allowed = restrictionData?.allowed_countries || [];

  return (
    <div className="min-h-screen w-full bg-[#000000] text-neutral-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#f59e0b] shadow-[0_0_12px_#f59e0b]" />
            <span className="text-sm font-black uppercase tracking-wider text-neutral-100">
              Sokoni<span className="text-[#f59e0b]">Max</span>
            </span>
          </div>
          <span className="text-3xs font-mono font-bold uppercase tracking-widest text-neutral-400 border border-neutral-700 px-2 py-0.5 rounded-full">
            Territory Gate
          </span>
        </div>

        {/* Hero Alert Graphic */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center text-[#f59e0b] shadow-inner">
            <Globe className="w-8 h-8 text-[#f59e0b]" strokeWidth={1.75} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-50 tracking-tight leading-snug">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-md">
            {message}
          </p>
        </div>

        {/* Metadata Badges */}
        <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 font-medium">Your Detected Location:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-[#f59e0b]" />
              {detectedCountry}
            </span>
          </div>

          {allowed.length > 0 && (
            <div className="flex items-start justify-between gap-2 pt-2 border-t border-neutral-900">
              <span className="text-neutral-400 font-medium shrink-0">Supported Regions:</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {allowed.map((code) => (
                  <span
                    key={code}
                    className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-3xs font-bold"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-black font-extrabold text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer disabled:opacity-60 shadow-lg shadow-[#f59e0b]/20"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking Location...' : 'Check Connection / Refresh'}
          </button>

          <a
            href="mailto:support@sokonimax.com?subject=Territory%20Access%20Inquiry"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-transparent hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 font-medium text-xs transition border border-neutral-800"
          >
            <Mail className="w-3.5 h-3.5" />
            Contact Customer Support
          </a>
        </div>

        {/* Footer Notice */}
        <p className="text-center text-3xs text-neutral-400 font-mono">
          HTTP 451 • GeoIP Policy Enforcement • SokoniMax Security Core
        </p>
      </div>
    </div>
  );
};

export default GeofenceGate;
