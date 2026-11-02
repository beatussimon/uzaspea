import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMessages } from '../../context/MessageContext';

interface MobileBubbleItemProps {
  conv: any;
  userId: number;
  isTyping: boolean;
  onDismiss: (convId: number) => void;
}

const MobileBubbleItem: React.FC<MobileBubbleItemProps> = ({
  conv,
  userId,
  isTyping,
  onDismiss,
}) => {
  const navigate = useNavigate();
  const isBuyer = Number(conv.buyer) === userId;
  const personName = isBuyer ? conv.seller_username : conv.buyer_username;
  const unreadCount = conv.unread_count || 0;

  const [isPopping, setIsPopping] = useState(false);
  const prevMsgIdRef = useRef<number | string | null>(conv.last_message?.id || null);
  const prevUnreadRef = useRef<number>(unreadCount);

  useEffect(() => {
    const latestMsgId = conv.last_message?.id;
    const isNewMsg = latestMsgId && prevMsgIdRef.current && prevMsgIdRef.current !== latestMsgId;
    const isCountIncreased = unreadCount > prevUnreadRef.current;

    if (isNewMsg || isCountIncreased) {
      setIsPopping(true);
      const timer = setTimeout(() => setIsPopping(false), 900);
      prevMsgIdRef.current = latestMsgId || null;
      prevUnreadRef.current = unreadCount;
      return () => clearTimeout(timer);
    }

    prevMsgIdRef.current = latestMsgId || null;
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, conv.last_message?.id]);

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
    navigate(`/messages/${conv.id}`);
  };

  return (
    <motion.div
      key={`mobile-bubble-${conv.id}`}
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
        {/* Sender avatar gradient or fallback icon without outline */}
        <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${getGradient(personName || 'Messages')} shadow-lg border-0`}>
          {personName ? personName.substring(0, 2).toUpperCase() : <MessageSquare size={16} />}
        </div>

        {/* Online indicator dot without outline */}
        {conv.is_online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full shadow-xs border-0" />
        )}

        {/* Typing indicator pulse without outline */}
        {isTyping && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-brand-500 rounded-full flex items-center justify-center animate-ping border-0" />
        )}

        {/* Unread count badge without outline */}
        {unreadCount > 0 && (
          <motion.span
            key={`badge-mobile-${conv.id}-${unreadCount}`}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.45, 0.88, 1.12, 1] }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md border-0"
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
          onDismiss(conv.id);
        }}
        className="absolute -top-1 -left-1 opacity-70 hover:opacity-100 w-4 h-4 bg-gray-900/90 text-white rounded-full flex items-center justify-center shadow-md border-0 transition-opacity"
        title="Dismiss bubble"
        aria-label="Dismiss message bubble"
      >
        <X size={9} />
      </button>
    </motion.div>
  );
};

export const MobileIncomingMessageBubble: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const userId = Number(user?.user_id || (user as any)?.id || 0);

  const {
    conversations,
    totalUnread,
    minimizedChatWindows,
    typingStatus,
    closeChatWindow,
  } = useMessages();

  // Route exclusions: do not show inside full messages or checkout
  const isMessagesRoute = location.pathname.startsWith('/messages');
  const isCheckoutRoute = location.pathname.startsWith('/checkout');

  // Track dismissed conversation IDs
  const [dismissedBubbleIds, setDismissedBubbleIds] = useState<number[]>([]);
  const prevLastMsgIds = useRef<{ [convId: number]: string | number }>({});
  const prevUnreadCounts = useRef<{ [convId: number]: number }>({});

  // Auto un-dismiss if a new message arrives or unread increments
  useEffect(() => {
    conversations.forEach(c => {
      const lastId = c.last_message?.id;
      const prevId = prevLastMsgIds.current[c.id];
      const prevUnread = prevUnreadCounts.current[c.id] || 0;

      if ((lastId && prevId && lastId !== prevId) || c.unread_count > prevUnread) {
        setDismissedBubbleIds(prev => prev.filter(id => id !== c.id));
      }

      if (lastId) prevLastMsgIds.current[c.id] = lastId;
      prevUnreadCounts.current[c.id] = c.unread_count;
    });
  }, [conversations]);

  const handleDismissBubble = (convId: number) => {
    closeChatWindow(convId);
    setDismissedBubbleIds(prev => prev.includes(convId) ? prev : [...prev, convId]);
  };

  if (!isAuthenticated || isMessagesRoute || isCheckoutRoute) {
    return null;
  }

  // Active floating conversations with unread messages or minimized
  const activeConversations = conversations.filter(c =>
    minimizedChatWindows.includes(c.id) ||
    (Number(c.unread_count) > 0 && !dismissedBubbleIds.includes(c.id))
  );

  // Fallback if totalUnread > 0 but individual counts not populated
  let candidateConversations = activeConversations;
  if (candidateConversations.length === 0 && totalUnread > 0 && conversations.length > 0) {
    candidateConversations = conversations
      .filter(c => !dismissedBubbleIds.includes(c.id))
      .slice(0, 4);
  }

  if (candidateConversations.length === 0 && minimizedChatWindows.length > 0) {
    candidateConversations = conversations.filter(c => minimizedChatWindows.includes(c.id));
  }

  if (candidateConversations.length === 0) {
    return null;
  }

  // Deduplicate by personName so each person gets at most one bubble
  const uniqueByPerson = new Map<string, any>();
  candidateConversations.forEach(conv => {
    const isBuyer = Number(conv.buyer) === userId;
    const personName = isBuyer ? conv.seller_username : conv.buyer_username;
    const key = personName || String(conv.id);
    if (!uniqueByPerson.has(key)) {
      uniqueByPerson.set(key, conv);
    } else {
      const existing = uniqueByPerson.get(key);
      const isNewer = new Date(conv.updated_at || conv.created_at || 0) > new Date(existing.updated_at || existing.created_at || 0);
      const higherUnread = Math.max(conv.unread_count || 0, existing.unread_count || 0);
      const chosen = isNewer ? { ...conv } : { ...existing };
      chosen.unread_count = higherUnread;
      uniqueByPerson.set(key, chosen);
    }
  });

  const displayCandidates = Array.from(uniqueByPerson.values());

  // Sort candidate conversations oldest to newest:
  // In flex-col-reverse:
  // - oldest (previous message) is at index 0 (BOTTOM of the stack)
  // - newer messages from different people are at higher indices (rendered vertically ON TOP of previous message)
  const sortedConversations = displayCandidates.sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at || (a.last_message ? (a.last_message as any).created_at : 0) || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || (b.last_message ? (b.last_message as any).created_at : 0) || 0).getTime();
    return timeA - timeB; // ascending -> oldest first
  });

  // Limit to at most 4 bubbles so it doesn't overflow the mobile viewport
  const displayConversations = sortedConversations.slice(-4);

  return (
    <div className="flex flex-col-reverse items-center gap-2.5 pointer-events-none">
      <AnimatePresence>
        {displayConversations.map(conv => (
          <MobileBubbleItem
            key={conv.id}
            conv={conv}
            userId={userId}
            isTyping={Boolean(typingStatus[conv.id])}
            onDismiss={handleDismissBubble}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
