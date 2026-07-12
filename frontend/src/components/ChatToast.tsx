import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageSquare } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMessages } from '../context/MessageContext';

export const ChatToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useMessages();
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-20 md:bottom-6 right-0 md:right-6 z-[9999] flex flex-col gap-3 w-full md:w-80 max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ChatToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
            onClick={() => {
              dismissToast(toast.id);
              navigate(`/messages/${toast.conversationId}`);
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ChatToastItemProps {
  toast: any;
  onDismiss: () => void;
  onClick: () => void;
}

const ChatToastItem: React.FC<ChatToastItemProps> = ({ toast, onDismiss, onClick }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getGradient = (username: string) => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-purple-500 to-pink-600',
      'from-rose-500 to-orange-600',
      'from-amber-500 to-yellow-600',
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
      className="pointer-events-auto flex items-stretch bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 ring-1 ring-black/5 dark:ring-white/5 active:scale-98 group"
      onClick={onClick}
    >
      <div className="w-1.5 bg-brand-500 dark:bg-brand-400 shrink-0" />

      <div className="flex-1 p-3.5 flex items-center gap-3.5 min-w-0">
        <div className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br ${getGradient(toast.senderUsername)} shadow-md ring-2 ring-white dark:ring-gray-900`}>
          {toast.avatarText}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
              {toast.senderUsername}
            </span>
            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap flex items-center gap-0.5">
              <MessageSquare size={10} className="text-brand-500" /> Chat
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5 font-medium leading-relaxed font-sans">
            {toast.content}
          </p>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="p-3.5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white border-l border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};
