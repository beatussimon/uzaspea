import React, { useState, useEffect } from 'react';
import api from '../api';
import { Loader2 } from 'lucide-react';

interface VehicleSelectorProps {
  onVehicleSelect: (vehicleId: string) => void;
  selectedVehicleId?: string;
  category?: string;
  subcategory?: string;
  mode?: 'filter' | 'manage';
}

const VehicleSelector: React.FC<VehicleSelectorProps> = ({ 
  onVehicleSelect, 
  category, 
  subcategory, 
  mode = 'filter' 
}) => {
  const [makes, setMakes] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [year, setYear] = useState('');
  
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);

  const activeCategory = subcategory || category;
  const baseParams = mode === 'manage' 
    ? { for_seller: 'true' } 
    : { has_products: 'true', ...(activeCategory ? { category: activeCategory } : {}) };

  // Reset selections when category changes
  useEffect(() => {
    setMakeId('');
    setModelId('');
    setYear('');
    onVehicleSelect('');
  }, [category, subcategory]);

  useEffect(() => {
    setLoadingMakes(true);
    api.get('/api/vehicle-makes/', { params: baseParams }).then(res => {
      setMakes(res.data.results || res.data || []);
    }).catch(() => {}).finally(() => setLoadingMakes(false));
  }, [mode, activeCategory]);

  useEffect(() => {
    if (!makeId) {
      setModels([]);
      setModelId('');
      return;
    }
    setLoadingModels(true);
    api.get('/api/vehicle-models/', { params: { ...baseParams, make_id: makeId } }).then(res => {
      setModels(res.data.results || res.data || []);
    }).catch(() => {}).finally(() => setLoadingModels(false));
  }, [makeId, mode, activeCategory]);

  useEffect(() => {
    if (!modelId) {
      setYears([]);
      setYear('');
      return;
    }
    setLoadingYears(true);
    api.get('/api/vehicles/', { params: { ...baseParams, model_id: modelId } }).then(res => {
      // Extract unique years from vehicles
      const vehicles = res.data.results || res.data || [];
      const uniqueYears = Array.from(new Set(vehicles.map((v: any) => v.year))).sort((a: any, b: any) => (b as number) - (a as number));
      setYears(uniqueYears);
    }).catch(() => {}).finally(() => setLoadingYears(false));
  }, [modelId, mode, activeCategory]);

  const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMakeId(e.target.value);
    setModelId('');
    setYear('');
    onVehicleSelect('');
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setModelId(e.target.value);
    setYear('');
    onVehicleSelect('');
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedYear = e.target.value;
    setYear(selectedYear);
    
    if (selectedYear && modelId) {
      // Find the specific vehicle ID to pass up
      api.get('/api/vehicles/', { params: { model_id: modelId, year: selectedYear } }).then(res => {
        const vehicles = res.data.results || res.data || [];
        if (vehicles.length > 0) {
          onVehicleSelect(vehicles[0].id.toString());
        }
      });
    } else {
      onVehicleSelect('');
    }
  };

  const selectClass = "w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow appearance-none disabled:opacity-50";

  return (
    <div className="space-y-4 mb-2">
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Vehicle Make</label>
        <div className="relative">
          <select 
            value={makeId} 
            onChange={handleMakeChange}
            className={selectClass}
          >
            <option value="">Any Make</option>
            {makes.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {loadingMakes && <Loader2 className="w-3 h-3 animate-spin absolute right-3 top-3 text-neutral-400" />}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Vehicle Model</label>
        <div className="relative">
          <select 
            value={modelId} 
            onChange={handleModelChange}
            disabled={!makeId}
            className={selectClass}
          >
            <option value="">Any Model</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {loadingModels && <Loader2 className="w-3 h-3 animate-spin absolute right-3 top-3 text-neutral-400" />}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Year</label>
        <div className="relative">
          <select 
            value={year} 
            onChange={handleYearChange}
            disabled={!modelId}
            className={selectClass}
          >
            <option value="">Any Year</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {loadingYears && <Loader2 className="w-3 h-3 animate-spin absolute right-3 top-3 text-neutral-400" />}
        </div>
      </div>
    </div>
  );
};

export default VehicleSelector;
