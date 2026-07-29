import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type DateRange = {
  startDate: string | null;
  endDate: string | null;
  label: string;
};

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate || '');
  const [customEnd, setCustomEnd] = useState(value.endDate || '');
  const [showCustom, setShowCustom] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClose);
    }
    return () => document.removeEventListener('mousedown', handleClose);
  }, [isOpen]);

  const getToday = () => new Date().toISOString().split('T')[0];
  
  const getDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const getThisMonthStart = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };

  const presets = [
    { label: t('all_time', 'All Time'), start: null, end: null },
    { label: t('today', 'Today'), start: getToday(), end: getToday() },
    { label: t('last_7_days', 'Last 7 Days'), start: getDaysAgo(6), end: getToday() },
    { label: t('last_30_days', 'Last 30 Days'), start: getDaysAgo(29), end: getToday() },
    { label: t('this_month', 'This Month'), start: getThisMonthStart(), end: getToday() },
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    setShowCustom(false);
    onChange({ startDate: preset.start, endDate: preset.end, label: preset.label });
    setIsOpen(false);
  };

  const applyCustomRange = () => {
    if (customStart && customEnd) {
      onChange({ startDate: customStart, endDate: customEnd, label: `${customStart} to ${customEnd}` });
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <Calendar size={16} className="text-gray-500" />
        <span>{value.label}</span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {!showCustom ? (
            <div className="py-2">
              {presets.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => handlePresetClick(preset)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors ${value.label === preset.label ? 'text-brand-600 dark:text-brand-400 font-bold bg-brand-50/50 dark:bg-brand-900/10' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  {preset.label}
                </button>
              ))}
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
              <button
                onClick={() => setShowCustom(true)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {t('custom_range', 'Custom Range...')}
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase">Start Date</label>
                  <input 
                    type="date" 
                    value={customStart}
                    max={customEnd || getToday()}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase">End Date</label>
                  <input 
                    type="date" 
                    value={customEnd}
                    min={customStart}
                    max={getToday()}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={() => setShowCustom(false)}
                  className="flex-1 px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={applyCustomRange}
                  disabled={!customStart || !customEnd}
                  className="flex-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
