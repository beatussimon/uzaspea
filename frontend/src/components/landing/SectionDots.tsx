import React from 'react';
import { motion } from 'framer-motion';

export interface SectionDotsProps {
  sections: { id: string; label: string }[];
  activeSection: string;
  onDotClick: (id: string) => void;
}

const SectionDots: React.FC<SectionDotsProps> = ({ sections, activeSection, onDotClick }) => {
  return (
    <div className="fixed right-3 md:right-8 top-1/2 -translate-y-1/2 z-[60] flex flex-col gap-1.5">
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <div
            key={section.id}
            className="group relative flex items-center justify-center cursor-pointer p-1 w-5 h-5"
            onClick={() => onDotClick(section.id)}
            role="button"
            aria-label={`Go to ${section.label}`}
          >
            <span className={`
              absolute right-8 px-2.5 py-1 rounded-md bg-gray-900/90 dark:bg-black/90 backdrop-blur-md text-white text-xs font-semibold 
              shadow-lg opacity-0 translate-x-2 md:group-hover:opacity-100 md:group-hover:translate-x-0 transition-all duration-150 ease-out pointer-events-none whitespace-nowrap border border-white/10
            `}>
              {section.label}
            </span>
            
            {/* Static Inactive Dot */}
            <div className={`w-3 h-3 rounded-full transition-colors duration-150 ease-out ${isActive ? 'opacity-0' : 'bg-gray-400 dark:bg-white/40 group-hover:bg-gray-600 dark:group-hover:bg-white'}`} />

            {/* Gliding Active Indicator */}
            {isActive && (
              <motion.div
                layoutId="activeDotRing"
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                transition={{ type: "spring", stiffness: 600, damping: 35 }}
              >
                <div className="w-5 h-5 rounded-full bg-yellow-500 shadow-md" />
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SectionDots;
