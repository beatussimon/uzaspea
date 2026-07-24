import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

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

    let targetColor = '';

    if (isLandingPage) {
      // Landing page hero is dark, regardless of theme
      targetColor = '#000000';
      
      // On scroll, the navbar gets a glass effect, so we transition the color
      // A more robust implementation would listen to scroll events and interpolate the color,
      // but for simplicity and performance, we'll set the initial color to black.
      // The Navbar scroll handler in Navbar.tsx will manage the class changes for the UI.
      // We could add a scroll listener here if we want the actual OS status bar to change color on scroll.
      
      const handleScroll = () => {
         const snapContainer = document.querySelector('.snap-container') as HTMLElement;
         const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
         const currentY = snapContainer 
           ? snapContainer.scrollTop 
           : Math.max(0, Math.min(maxScrollY, window.pageYOffset || document.documentElement.scrollTop));
         
         // If scrolled past hero, change to standard theme color
         if (currentY > 120) {
            updateMetaTag(isDark ? '#050505' : '#fafafa');
         } else {
            updateMetaTag('#000000');
         }
      };

      document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
      
      // Cleanup scroll listener when leaving landing page
      return () => document.removeEventListener('scroll', handleScroll, { capture: true } as any);

    } else if (isDashboard) {
      // Dashboard has slightly different background colors potentially, 
      // but assuming it uses surface-muted / surface-dark for now
      targetColor = isDark ? '#050505' : '#f9fafb';
    } else {
      // Standard pages
      targetColor = isDark ? '#050505' : '#fafafa';
    }

    updateMetaTag(targetColor);

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
