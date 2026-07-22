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
    // Check if the user has previously dismissed the prompt
    const hasDismissed = localStorage.getItem('pwaPromptDismissed');

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the prompt if not previously dismissed
      if (!hasDismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If app is successfully installed, clear the deferredPrompt
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setIsVisible(false);
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
    // Remember the user's choice so we don't annoy them
    localStorage.setItem('pwaPromptDismissed', 'true');
  };

  if (!isVisible || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[100] animate-slide-up">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-xl rounded-2xl p-4 flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-black flex items-center justify-center p-2 shadow-inner border border-gray-200 dark:border-neutral-800">
            <img src="/logo.png" alt="SokoniMax Logo" className="w-full h-full object-contain" />
          </div>
        </div>
        
        <div className="flex-1 pt-0.5">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
            {t('install_app_title', 'Install SokoniMax App')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed pr-4">
            {t('install_app_desc', 'Get the app on your home screen for a faster, better experience.')}
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold py-2 px-4 rounded-full transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/20"
            >
              <Download size={14} />
              {t('install_now', 'Install Now')}
            </button>
          </div>
        </div>
        
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-full p-1.5 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
