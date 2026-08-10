import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';


interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  pillLabel?: string;
}

const ExpandableSearch: React.FC<ExpandableSearchProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Search...', 
  pillLabel = 'Search' 
}) => {

  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // If there's text, it should always be expanded
  const shouldBeExpanded = isExpanded || value.length > 0;

  // Handle click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (value.length === 0) {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const handleExpand = () => {
    setIsExpanded(true);
    // Use a tiny timeout to ensure it renders before focusing
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (value.length > 0) {
        onChange('');
      } else {
        setIsExpanded(false);
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative flex justify-center w-full">
      <motion.div
        initial={false}
        animate={{
          width: shouldBeExpanded ? '100%' : '140px', // '140px' for pill, 100% for full bar
          maxWidth: shouldBeExpanded ? '400px' : '140px',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`relative flex items-center h-10 overflow-hidden cursor-pointer bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 ${
          shouldBeExpanded 
            ? 'shadow-sm' 
            : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-neutral-900'
        } rounded-full transition-colors`}
        onClick={handleExpand}
      >
        <div className="absolute left-3 flex items-center justify-center">
          <Search size={16} className={shouldBeExpanded ? 'text-gray-400' : 'text-gray-900 dark:text-white'} />
        </div>

        <motion.input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full h-full bg-transparent outline-none text-sm pl-9 font-medium text-gray-900 dark:text-white placeholder-gray-400 ${shouldBeExpanded ? 'pr-9' : 'pr-3'}`}
          animate={{
            opacity: shouldBeExpanded ? 1 : 0,
            pointerEvents: shouldBeExpanded ? 'auto' : 'none'
          }}
          transition={{ duration: 0.2 }}
        />

        {!shouldBeExpanded && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute left-9 text-sm font-bold truncate pr-3 select-none pointer-events-none"
          >
            {pillLabel}
          </motion.span>
        )}

        <AnimatePresence>
          {shouldBeExpanded && value.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={handleClear}
              className="absolute right-2.5 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
            >
              <X size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ExpandableSearch;
