import React, { useEffect, useRef, useState, ReactNode, Children, isValidElement } from 'react';
import SectionDots from './SectionDots';

interface SnapScrollContainerProps {
  children: ReactNode;
  sections: { id: string; label: string }[];
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

const SnapScrollContainer: React.FC<SnapScrollContainerProps> = ({ children, sections, onScroll }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || '');
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Disable body scroll globally so only this container scrolls
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const targetId = entry.target.getAttribute('id');
            if (targetId) setActiveSection(targetId);
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.5, // Trigger when 50% of the section is visible
      }
    );

    const childElements = containerRef.current.querySelectorAll('.snap-section-child');
    childElements.forEach((el) => observer.current?.observe(el));

    return () => {
      observer.current?.disconnect();
    };
  }, [children]);

  const handleDotClick = (id: string) => {
    const el = document.getElementById(id);
    if (el && containerRef.current) {
      // Smooth scroll inside the snap container
      containerRef.current.scrollTo({
        top: el.offsetTop,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative z-10 w-full h-[100dvh] overflow-hidden bg-transparent transition-colors duration-300">
      <SectionDots 
        sections={sections} 
        activeSection={activeSection} 
        onDotClick={handleDotClick} 
      />
      
      <div 
        ref={containerRef}
        className="snap-container w-full h-full no-scrollbar"
        onScroll={onScroll}
      >
        {Children.map(children, (child, index) => {
          if (isValidElement(child)) {
            const sectionId = sections[index]?.id || `section-${index}`;
            const isDOMElement = typeof child.type === 'string';
            return (
              <div 
                id={sectionId} 
                className="snap-section snap-section-child"
              >
                {/* Clone element to pass active state if needed, though most children will handle their own entrance animations via framer-motion */}
                {isDOMElement 
                  ? child 
                  : React.cloneElement(child as React.ReactElement<any>, { 
                      isActive: activeSection === sectionId 
                    })
                }
              </div>
            );
          }
          return child;
        })}
      </div>
    </div>
  );
};

export default SnapScrollContainer;
