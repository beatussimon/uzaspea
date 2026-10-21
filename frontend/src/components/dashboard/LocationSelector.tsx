import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronDown, Check, Plus, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth, useUserRoles } from '../../context/AuthContext';
import api from '../../api';

interface LocationSelectorProps {
  className?: string;
  onLocationChange?: (locationId: number | null) => void;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({ className = '', onLocationChange }) => {
  const { user, activeLocation, setActiveLocation, assignedLocations } = useAuth();
  const { isBusiness, isTeamMember } = useUserRoles();
  const [locations, setLocations] = useState<any[]>(assignedLocations || []);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If business owner or team member, fetch live locations from backend
    if (isBusiness || isTeamMember || (user?.is_multi_location ?? false)) {
      api.get('/api/locations/')
        .then(res => {
          const list = res.data.results || res.data || [];
          if (Array.isArray(list) && list.length > 0) {
            setLocations(list);
          }
        })
        .catch(() => {});
    }
  }, [isBusiness, isTeamMember, user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // If user only has 1 location and is not a multi-branch business, do not clutter header
  if (locations.length <= 1 && !isBusiness) {
    return null;
  }

  const handleSelect = (loc: any | null) => {
    setActiveLocation(loc ? {
      id: loc.id,
      name: loc.name,
      slug: loc.slug || '',
      is_main: loc.is_main || false,
      city: loc.city || '',
      district: loc.district || '',
      address_line: loc.address_line || '',
      phone: loc.phone || '',
    } : null);
    if (onLocationChange) {
      onLocationChange(loc ? loc.id : null);
    }
    setIsOpen(false);
  };

  const displayText = activeLocation 
    ? `${activeLocation.name}${activeLocation.is_main ? ' (HQ)' : ''}`
    : 'All Branches (HQ)';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-neutral-700/80 shadow-xs transition-all active:scale-95 cursor-pointer select-none"
        title="Switch active branch context"
      >
        <span className="p-1 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400">
          <MapPin size={12} className="shrink-0" />
        </span>
        <span className="max-w-[140px] sm:max-w-[180px] truncate font-semibold">
          {displayText}
        </span>
        <ChevronDown size={13} className={`shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-white dark:bg-neutral-900 border border-surface-border dark:border-surface-dark-border shadow-xl z-50 p-2 animate-fade-in focus:outline-hidden">
          <div className="px-2.5 py-1.5 border-b border-gray-100 dark:border-neutral-800">
            <p className="text-3xs uppercase font-bold tracking-wider text-gray-400 dark:text-neutral-500">
              Filter by Store Branch
            </p>
          </div>

          <div className="py-1 max-h-60 overflow-y-auto space-y-0.5">
            {/* All Branches option (Consolidated) */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
                activeLocation === null
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 font-bold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800/60 font-medium'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Store size={14} className="text-gray-400 dark:text-neutral-400 shrink-0" />
                <span className="truncate">All Branches (Consolidated HQ)</span>
              </div>
              {activeLocation === null && <Check size={14} className="text-brand-600 dark:text-brand-400 shrink-0" />}
            </button>

            {/* Individual branches */}
            {locations.map((loc) => {
              const isSelected = activeLocation?.id === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSelect(loc)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
                    isSelected
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 font-bold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <MapPin size={14} className={`shrink-0 ${isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-neutral-500'}`} />
                    <div className="truncate">
                      <div className="truncate font-semibold flex items-center gap-1">
                        <span>{loc.name}</span>
                        {loc.is_main && (
                          <span className="text-4xs uppercase px-1 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-bold">
                            HQ
                          </span>
                        )}
                      </div>
                      {loc.city && (
                        <div className="text-3xs text-gray-400 dark:text-neutral-400 truncate">
                          {loc.district ? `${loc.district}, ` : ''}{loc.city}
                        </div>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-brand-600 dark:text-brand-400 shrink-0 ml-1.5" />}
                </button>
              );
            })}
          </div>

          {/* Manage Branches Link */}
          {isBusiness && (
            <div className="pt-1 mt-1 border-t border-gray-100 dark:border-neutral-800">
              <Link
                to="/dashboard/branches"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50/60 dark:hover:bg-brand-950/30 transition cursor-pointer"
              >
                <Plus size={13} className="shrink-0" />
                <span>Manage Store Branches</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
