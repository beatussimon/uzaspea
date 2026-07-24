import { useEffect } from 'react';
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

  useEffect(() => {
    // Determine the current context
    const isLandingPage = location.pathname === '/';
    const isDashboard = location.pathname.startsWith('/dashboard') || 
                        location.pathname.startsWith('/staff') ||
                        location.pathname.startsWith('/inspector');
    
    // We only update the theme-color if a modal isn't open
    const isModalOpen = !!(location.state as any)?.backgroundLocation;
    if (isModalOpen) return;

    if (isLandingPage) {
      // Landing page hero is dark, regardless of theme
      const startColor = '#000000';
      const endColor = isDark ? '#050505' : '#fafafa';
      
      const handleScroll = () => {
         const snapContainer = document.querySelector('.snap-container') as HTMLElement;
         const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
         const currentY = snapContainer 
           ? snapContainer.scrollTop 
           : Math.max(0, Math.min(maxScrollY, window.pageYOffset || document.documentElement.scrollTop));
         
         // Dynamically interpolate color between 0 and 120px scroll
         const scrollFactor = Math.min(1, Math.max(0, currentY / 120));
         const interpolatedColor = interpolateColor(startColor, endColor, scrollFactor);
         
         updateMetaTag(interpolatedColor);
      };

      // Set initial color immediately based on current scroll position if any
      handleScroll();

      document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
      
      // Cleanup scroll listener when leaving landing page
      return () => document.removeEventListener('scroll', handleScroll, { capture: true } as any);

    } else {
      let targetColor = '';
      if (isDashboard) {
        targetColor = isDark ? '#050505' : '#f9fafb';
      } else {
        // Standard pages
        targetColor = isDark ? '#050505' : '#fafafa';
      }
      updateMetaTag(targetColor);
    }

  }, [location.pathname, isDark, location.state]);
}

function updateMetaTag(color: string) {
  // Update light theme meta tag
  let metaLight = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]') as HTMLMetaElement;
  if (!metaLight) {
    metaLight = document.createElement('meta');
    metaLight.name = 'theme-color';
    metaLight.media = '(prefers-color-scheme: light)';
    document.head.appendChild(metaLight);
  }
  metaLight.content = color;

  // Update dark theme meta tag
  let metaDark = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]') as HTMLMetaElement;
  if (!metaDark) {
    metaDark = document.createElement('meta');
    metaDark.name = 'theme-color';
    metaDark.media = '(prefers-color-scheme: dark)';
    document.head.appendChild(metaDark);
  }
  metaDark.content = color;
  
  // Also update any theme-color tag without media query (legacy fallback)
  let metaFallback = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement;
  if (metaFallback) {
      metaFallback.content = color;
  }
}
