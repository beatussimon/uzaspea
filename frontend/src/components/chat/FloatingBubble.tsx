import React from 'react';
import { motion } from 'framer-motion';
import { X, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMessages, Conversation } from '../../context/MessageContext';

interface FloatingBubbleProps {
  conv: Conversation;
}

export const FloatingBubble: React.FC<FloatingBubbleProps> = ({ conv }) => {
  const { user } = useAuth();
  const userId = Number(user?.user_id || (user as any)?.id || parseInt(localStorage.getItem('user_id') || '0'));
  const { openChatWindow, closeChatWindow, typingStatus } = useMessages();

  const isBuyer = Number(conv.buyer) === userId;
  const personName = isBuyer ? conv.seller_username : conv.buyer_username;
  const isTyping = typingStatus[conv.id] || false;

  const getGradient = (name: string) => {
    const gradients = [
      'from-amber-500 to-amber-600',
      'from-blue-500 to-blue-600',
      'from-emerald-500 to-emerald-600',
      'from-purple-500 to-purple-600',
      'from-rose-500 to-rose-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 20 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      onClick={() => openChatWindow(conv.id)}
      className="group relative w-11 h-11 rounded-full shadow-xl flex items-center justify-center cursor-pointer transition-transform shrink-0"
      title={`Chat with ${personName}`}
    >
      <div className="relative w-full h-full">
        <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${getGradient(personName || '')} shadow-md border-2 border-white dark:border-[#1f2022]`}>
          {personName ? personName.substring(0, 2).toUpperCase() : <MessageSquare size={14} />}
        </div>

        {/* Online dot */}
        {conv.is_online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#1f2022]" />
        )}

        {/* Typing indicator pulse dot */}
        {isTyping && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-brand-500 rounded-full border-2 border-white dark:border-[#1f2022] flex items-center justify-center animate-ping" />
        )}

        {/* Person-specific unread count badge */}
        {conv.unread_count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse shadow-md border-2 border-white dark:border-[#1f2022]">
            {conv.unread_count > 99 ? '99' : conv.unread_count}
          </span>
        )}
      </div>

      {/* Close button on bubble hover */}
      <button 
        onClick={(e) => { e.stopPropagation(); closeChatWindow(conv.id); }}
        className="absolute -top-1.5 -left-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 bg-gray-900/90 dark:bg-black/90 text-white rounded-full hover:bg-red-500 dark:hover:bg-red-500 transition-all shadow-md z-10 flex items-center justify-center border border-white/20"
        title="Close bubble"
      >
        <X size={11} />
      </button>
    </motion.div>
  );
};
