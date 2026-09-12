import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Define the interface for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Check if the user has dismissed the prompt or already installed
    const hasDismissed = localStorage.getItem('pwaPromptDismissed');
    const isInstalled = localStorage.getItem('pwaInstalled');
    
    // Also check if app is already installed natively (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;

    if (hasDismissed || isInstalled || isStandalone) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If app is successfully installed, clear the deferredPrompt
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setIsVisible(false);
      localStorage.setItem('pwaInstalled', 'true');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Hide our custom UI
    setIsVisible(false);
    
    // Show the native install prompt
    await deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Remember the user's choice permanently
    localStorage.setItem('pwaPromptDismissed', 'true');
  };

  if (!isVisible || !deferredPrompt) return null;

  return (
    <aside
      aria-label="App installation notice"
      className="relative w-full max-w-sm sm:w-[360px] md:w-[380px] pointer-events-auto bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border border-gray-200/80 dark:border-neutral-800 shadow-2xl rounded-2xl p-4 transition-all duration-300 animate-slide-up flex items-start gap-3.5 text-left"
    >
      <div className="shrink-0">
        <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-black flex items-center justify-center p-2 shrink-0 shadow-inner border border-gray-200/60 dark:border-neutral-800">
          <img src="/logo.png" alt="SokoniMax Logo" className="w-full h-full object-contain" />
        </div>
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
          {t('install_app_title', 'Install SokoniMax App')}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed pr-4">
          {t('install_app_desc', 'Install SokoniMax to receive instant message notifications even when your phone is locked.')}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstallClick}
            className="btn-primary text-xs font-bold py-2 px-4 rounded-btn flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <Download size={14} />
            <span>{t('install_now', 'Install Now')}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-full p-1.5 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </aside>
  );
};

