import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMessages } from '../../context/MessageContext';

export const MobileIncomingMessageBubble: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const userId = Number(user?.user_id || (user as any)?.id || parseInt(localStorage.getItem('user_id') || '0'));

  const {
    conversations,
    totalUnread,
    minimizedChatWindows,
    typingStatus,
  } = useMessages();

  // Route exclusions: do not show inside full messages or checkout
  const isMessagesRoute = location.pathname.startsWith('/messages');
  const isCheckoutRoute = location.pathname.startsWith('/checkout');

  // Identify active or incoming conversation
  const unreadConvs = conversations.filter(c => c.unread_count > 0);
  const minimizedConvs = conversations.filter(c => minimizedChatWindows.includes(c.id));
  const targetConv = unreadConvs[0] || minimizedConvs[0] || (totalUnread > 0 ? conversations[0] : null);

  const isBuyer = targetConv ? Number(targetConv.buyer) === userId : false;
  const personName = targetConv ? (isBuyer ? targetConv.seller_username : targetConv.buyer_username) : '';
  const isTyping = targetConv ? typingStatus[targetConv.id] || false : false;
  const unreadCount = totalUnread > 0 ? totalUnread : (targetConv?.unread_count || 0);

  // Track dismissal state until a new incoming message arrives
  const [isDismissed, setIsDismissed] = useState(false);
  const prevLastMsgIdRef = useRef<number | string | null>(null);
  const prevUnreadRef = useRef<number>(unreadCount);
  const [isPopping, setIsPopping] = useState(false);

  useEffect(() => {
    const latestMsgId = targetConv?.last_message?.id;
    const isNewMsg = latestMsgId && prevLastMsgIdRef.current && prevLastMsgIdRef.current !== latestMsgId;
    const isCountIncreased = unreadCount > prevUnreadRef.current;

    if (isNewMsg || isCountIncreased) {
      setIsDismissed(false); // Un-dismiss on new incoming message!
      setIsPopping(true);
      const timer = setTimeout(() => setIsPopping(false), 900);
      prevLastMsgIdRef.current = latestMsgId || null;
      prevUnreadRef.current = unreadCount;
      return () => clearTimeout(timer);
    }

    prevLastMsgIdRef.current = latestMsgId || null;
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, targetConv?.last_message?.id]);

  const showBubble = Boolean(
    isAuthenticated &&
    !isMessagesRoute &&
    !isCheckoutRoute &&
    !isDismissed &&
    (unreadCount > 0 || minimizedConvs.length > 0)
  );

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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (targetConv?.id) {
      navigate(`/messages/${targetConv.id}`);
    } else {
      navigate('/messages');
    }
  };

  return (
    <AnimatePresence>
      {showBubble && (
        <motion.div
          key="mobile-incoming-message-bubble"
          layout
          initial={{ scale: 0, opacity: 0, y: 15 }}
          animate={isPopping ? {
            scale: [1, 1.3, 0.9, 1.12, 1],
            opacity: 1,
            y: [0, -10, 3, 0],
          } : { scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0, opacity: 0, y: 15 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          onClick={handleClick}
          className="pointer-events-auto group relative w-11 h-11 rounded-full shadow-2xl flex items-center justify-center cursor-pointer select-none shrink-0"
          title={personName ? `Chat with ${personName}` : 'Messages'}
          aria-label={personName ? `Open chat with ${personName}` : 'Open messages'}
        >
          <div className="relative w-full h-full">
            {/* Sender avatar gradient or fallback icon */}
            <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${getGradient(personName || 'Messages')} shadow-lg border-2 border-white dark:border-[#1f2022]`}>
              {personName ? personName.substring(0, 2).toUpperCase() : <MessageSquare size={16} />}
            </div>

            {/* Online indicator dot */}
            {targetConv?.is_online && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#1f2022]" />
            )}

            {/* Typing indicator pulse */}
            {isTyping && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-brand-500 rounded-full border-2 border-white dark:border-[#1f2022] flex items-center justify-center animate-ping" />
            )}

            {/* Unread count badge with energetic pop animation */}
            {unreadCount > 0 && (
              <motion.span
                key={`badge-mobile-${unreadCount}`}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.45, 0.88, 1.12, 1] }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-[#1f2022]"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsDismissed(true);
            }}
            className="absolute -top-1 -left-1 opacity-70 hover:opacity-100 w-4 h-4 bg-gray-900/90 text-white rounded-full flex items-center justify-center shadow-md border border-white/20 transition-opacity"
            title="Dismiss bubble"
            aria-label="Dismiss message bubble"
          >
            <X size={9} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
