import React from 'react';
import { motion } from 'framer-motion';

export interface SectionDotsProps {
  sections: { id: string; label: string }[];
  activeSection: string;
  onDotClick: (id: string) => void;
}

const SectionDots: React.FC<SectionDotsProps> = ({ sections, activeSection, onDotClick }) => {
  return (
    <div className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-[60] hidden md:flex flex-col gap-3">
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <div
            key={section.id}
            className="group relative flex items-center justify-end cursor-pointer"
            onClick={() => onDotClick(section.id)}
            role="button"
            aria-label={`Go to ${section.label}`}
          >
            <span className={`
              absolute right-8 px-2.5 py-1 rounded-md bg-gray-900/90 dark:bg-black/90 backdrop-blur-md text-white text-xs font-semibold 
              shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-white/10
            `}>
              {section.label}
            </span>
            <motion.div
              initial={false}
              animate={{
                scale: isActive ? 1.25 : 1,
                backgroundColor: isActive ? '#eab308' : 'currentColor',
                borderColor: isActive ? '#eab308' : 'currentColor'
              }}
              className="w-2.5 h-2.5 rounded-full border border-gray-400 dark:border-white/50 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white transition-colors shadow-sm"
            />
          </div>
        );
      })}
    </div>
  );
};

export default SectionDots;
