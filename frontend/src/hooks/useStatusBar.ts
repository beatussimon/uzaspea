import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

function interpolateColor(color1: string, color2: string, factor: number): string {
    const hexToRgb = (hex: string) => {
        // Handle short hex like #000
        let fullHex = hex.replace('#', '');
        if (fullHex.length === 3) {
            fullHex = fullHex.split('').map(c => c + c).join('');
        }
        const bigint = parseInt(fullHex, 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };
    
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    
    const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function useStatusBar() {
  const location = useLocation();
  const { isDark } = useTheme();
  const currentColorRef = useRef<string>('');

  useEffect(() => {
    // Determine the current context
    const isLandingPage = location.pathname === '/';
    
    // We only update the theme-color if a modal isn't open
    const isModalOpen = !!(location.state as any)?.backgroundLocation;
    if (isModalOpen) return;

    if (isLandingPage) {
      // Landing page hero is dark, regardless of theme
      const startColor = '#000000';
      const endColor = isDark ? '#000000' : '#ffffff';
      
      // In dark mode, start and end colors are both #000000; no scroll listener needed
      if (isDark) {
        updateMetaTag('#000000', currentColorRef);
        return;
      }

      let ticking = false;
      let snapContainerCache: HTMLElement | null = null;
      const handleScroll = () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            if (!snapContainerCache) {
              snapContainerCache = document.querySelector('.snap-container') as HTMLElement | null;
            }
            const currentY = snapContainerCache 
              ? snapContainerCache.scrollTop 
              : Math.max(0, window.pageYOffset || window.scrollY || 0);
            
            // Dynamically interpolate color between 0 and 120px scroll
            const scrollFactor = Math.min(1, Math.max(0, currentY / 120));
            const interpolatedColor = interpolateColor(startColor, endColor, scrollFactor);
            
            updateMetaTag(interpolatedColor, currentColorRef);
            ticking = false;
          });
          ticking = true;
        }
      };

      // Set initial color immediately based on current scroll position
      updateMetaTag(startColor, currentColorRef);

      document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
      return () => document.removeEventListener('scroll', handleScroll, { capture: true } as any);

    } else {
      updateMetaTag('#000000', currentColorRef);
    }

  }, [location.pathname, isDark, location.state]);
}

let cachedMetaLight: HTMLMetaElement | null = null;
let cachedMetaDark: HTMLMetaElement | null = null;
let cachedMetaFallback: HTMLMetaElement | null = null;

function updateMetaTag(color: string, currentColorRef?: React.MutableRefObject<string>) {
  if (currentColorRef && currentColorRef.current === color) {
    return;
  }
  if (currentColorRef) {
    currentColorRef.current = color;
  }

  // Update light theme meta tag
  if (!cachedMetaLight || !cachedMetaLight.isConnected) {
    cachedMetaLight = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]') as HTMLMetaElement;
    if (!cachedMetaLight) {
      cachedMetaLight = document.createElement('meta');
      cachedMetaLight.name = 'theme-color';
      cachedMetaLight.media = '(prefers-color-scheme: light)';
      document.head.appendChild(cachedMetaLight);
    }
  }
  cachedMetaLight.content = color;

  // Update dark theme meta tag
  if (!cachedMetaDark || !cachedMetaDark.isConnected) {
    cachedMetaDark = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]') as HTMLMetaElement;
    if (!cachedMetaDark) {
      cachedMetaDark = document.createElement('meta');
      cachedMetaDark.name = 'theme-color';
      cachedMetaDark.media = '(prefers-color-scheme: dark)';
      document.head.appendChild(cachedMetaDark);
    }
  }
  cachedMetaDark.content = color;
  
  // Also update any theme-color tag without media query (legacy fallback)
  if (!cachedMetaFallback || !cachedMetaFallback.isConnected) {
    cachedMetaFallback = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement;
  }
  if (cachedMetaFallback) {
    cachedMetaFallback.content = color;
  }
}
