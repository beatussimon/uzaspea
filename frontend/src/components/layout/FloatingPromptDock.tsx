import React from 'react';
import { LocationPromptBanner } from './LocationPromptBanner';
import { PwaInstallPrompt } from '../PwaInstallPrompt';
import { useUserLocation } from '../../context/LocationContext';

export const FloatingPromptDock: React.FC = () => {
  const { permission } = useUserLocation();
  const showLocationBanner = permission === 'prompt';

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-5xl px-4 pointer-events-none flex flex-col md:flex-row items-center md:items-end justify-center gap-3 md:gap-4">
      {showLocationBanner ? <LocationPromptBanner /> : <PwaInstallPrompt />}
    </div>
  );
};

export default FloatingPromptDock;
