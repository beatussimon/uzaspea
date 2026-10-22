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

  const desktopText = activeLocation 
    ? activeLocation.name 
    : 'All Branches (HQ)';

  const mobileText = activeLocation 
    ? activeLocation.name 
    : 'All (HQ)';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-btn text-xs font-bold bg-surface-muted dark:bg-[#161616] hover:bg-surface-muted/80 dark:hover:bg-[#202020] text-gray-900 dark:text-white border-0 transition-all duration-200 active:scale-[0.97] cursor-pointer select-none shrink-0"
        title={desktopText}
      >
        <MapPin size={13} className="text-gray-500 dark:text-gray-400 shrink-0" />
        {/* Mobile Text: 'All (HQ)' or just branch name */}
        <span className="sm:hidden max-w-[65px] xs:max-w-[85px] truncate">
          {mobileText}
        </span>
        {/* Desktop Text: 'All Branches (HQ)' or just branch name */}
        <span className="hidden sm:inline max-w-[150px] truncate">
          {desktopText}
        </span>
        <ChevronDown size={12} className={`shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-white dark:bg-[#141414] border-0 shadow-2xl z-50 p-2 animate-fade-in focus:outline-hidden space-y-1">
          <div className="px-2.5 py-1.5">
            <p className="text-3xs uppercase font-bold tracking-wider text-gray-400 dark:text-neutral-500">
              Filter by Store Branch
            </p>
          </div>

          <div className="py-0.5 max-h-60 overflow-y-auto space-y-0.5">
            {/* All Branches option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
                activeLocation === null
                  ? 'text-gray-900 dark:text-white font-bold bg-gray-100/80 dark:bg-white/5'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-white/5 font-medium'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Store size={14} className="text-gray-400 dark:text-neutral-400 shrink-0" />
                <span className="truncate">All Branches (HQ)</span>
              </div>
              {activeLocation === null && <Check size={14} className="text-gray-900 dark:text-white shrink-0" />}
            </button>

            {/* Individual branches */}
            {locations.map((loc) => {
              const isSelected = activeLocation?.id === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSelect(loc)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
                    isSelected
                      ? 'text-gray-900 dark:text-white font-bold bg-gray-100/80 dark:bg-white/5'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-white/5 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <MapPin size={14} className="text-gray-400 dark:text-neutral-400 shrink-0" />
                    <div className="truncate">
                      <div className="truncate font-semibold flex items-center gap-1.5">
                        <span>{loc.name}</span>
                        {loc.is_main && (
                          <span className="text-4xs uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 font-bold">
                            HQ
                          </span>
                        )}
                      </div>
                      {loc.city && (
                        <div className="text-3xs text-gray-400 dark:text-neutral-500 truncate">
                          {loc.district ? `${loc.district}, ` : ''}{loc.city}
                        </div>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-gray-900 dark:text-white shrink-0 ml-1.5" />}
                </button>
              );
            })}
          </div>

          {/* Manage Branches Link */}
          {isBusiness && (
            <div className="pt-1 mt-1">
              <Link
                to="/dashboard/branches"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/5 transition cursor-pointer"
              >
                <Plus size={13} className="shrink-0 text-gray-400 dark:text-neutral-500" />
                <span>Manage Store Branches</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
