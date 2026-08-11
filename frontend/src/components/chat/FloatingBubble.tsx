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
      'from-amber-500 ',
      'bg-blue-500 ',
      'from-emerald-500 ',
      'bg-purple-500 ',
      'from-rose-500 ',
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
      onClick={() => openChatWindow(conv.id)}
      className="group relative mb-2 p-1 bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-neutral-800 rounded-full shadow-card-hover flex items-center cursor-pointer hover:scale-105 transition-all border-brand-500/20"
      title={`Chat with ${personName}`}
    >
      <div className="relative shrink-0">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-xs  ${getGradient(personName)} shadow-md`}>
          {personName ? personName.substring(0, 2).toUpperCase() : <MessageSquare size={14} />}
        </div>

        {/* Online dot */}
        {conv.is_online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-black" />
        )}

        {/* Typing indicator pulse dot */}
        {isTyping && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-brand-500 rounded-full border-2 border-white dark:border-black flex items-center justify-center animate-ping" />
        )}

        {/* Person-specific unread count badge */}
        {conv.unread_count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-pulse shadow-md border-2 border-white dark:border-black">
            {conv.unread_count > 99 ? '99' : conv.unread_count}
          </span>
        )}
      </div>

      {/* Close button on bubble hover */}
      <button 
        onClick={(e) => { e.stopPropagation(); closeChatWindow(conv.id); }}
        className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 p-0.5 bg-gray-800 text-white rounded-full hover:bg-red-500 transition-all shadow-md z-10"
        title="Close bubble"
      >
        <X size={12} />
      </button>
    </motion.div>
  );
};
