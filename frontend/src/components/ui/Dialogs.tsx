import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface DialogOptions {
  title?: string;
  message: string;
  type: 'alert' | 'confirm' | 'prompt';
  defaultValue?: string;
  placeholder?: string;
  resolve: (value: any) => void;
}

interface DialogContextType {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  showPrompt: (message: string, placeholder?: string, defaultValue?: string, title?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDialog, setActiveDialog] = useState<DialogOptions | null>(null);
  const [inputValue, setInputValue] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const showAlert = (message: string, title = 'Alert') => {
    return new Promise<void>((resolve) => {
      setActiveDialog({ title, message, type: 'alert', resolve });
    });
  };

  const showConfirm = (message: string, title = 'Confirm') => {
    return new Promise<boolean>((resolve) => {
      setActiveDialog({ title, message, type: 'confirm', resolve });
    });
  };

  const showPrompt = (message: string, placeholder = '', defaultValue = '', title = 'Prompt') => {
    return new Promise<string | null>((resolve) => {
      setInputValue(defaultValue);
      setActiveDialog({ title, message, type: 'prompt', placeholder, defaultValue, resolve });
    });
  };

  const handleClose = (value: any) => {
    if (activeDialog) {
      activeDialog.resolve(value);
      setActiveDialog(null);
      setInputValue('');
    }
  };

  // Keyboard navigation & escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeDialog) return;
      if (e.key === 'Escape') {
        handleClose(activeDialog.type === 'confirm' ? false : null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDialog]);

  // Focus trap
  useEffect(() => {
    if (activeDialog && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        (focusable[0] as HTMLElement).focus();
      }
    }
  }, [activeDialog]);

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      <AnimatePresence>
        {activeDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleClose(activeDialog.type === 'confirm' ? false : null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Dialog Panel */}
            <motion.div
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white p-6 shadow-xl dark:border-white/5 dark:bg-[#0A0A0A] text-gray-900 dark:text-white"
            >
              {activeDialog.title && (
                <h3 className="text-base font-black uppercase tracking-wider text-[#f59e0b] mb-2">
                  {activeDialog.title}
                </h3>
              )}
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-6">
                {activeDialog.message}
              </p>

              {activeDialog.type === 'prompt' && (
                <div className="mb-6">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={activeDialog.placeholder}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:border-[#f59e0b] focus:outline-none dark:border-white/5 dark:bg-[#080808] dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleClose(inputValue);
                      }
                    }}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                {activeDialog.type !== 'alert' && (
                  <button
                    onClick={() => handleClose(activeDialog.type === 'confirm' ? false : null)}
                    className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-[#080808] transition"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => handleClose(activeDialog.type === 'prompt' ? inputValue : true)}
                  className="rounded-lg bg-[#f59e0b] px-4 py-2 text-xs font-black uppercase tracking-wider text-black hover:bg-[#d97706] transition shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};
