import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useMessages } from '../../context/MessageContext';
import { FloatingChatWindow } from './FloatingChatWindow';
import { FloatingBubble } from './FloatingBubble';
import { MessengerListWidget } from './MessengerListWidget';
import { AnimatePresence } from 'framer-motion';

export const DesktopChatDock: React.FC = () => {
  const location = useLocation();
  const {
    conversations,
    openChatWindows,
    minimizedChatWindows,
  } = useMessages();

  const [hasPageActions, setHasPageActions] = useState(false);
  const [dismissedBubbleIds, setDismissedBubbleIds] = useState<number[]>([]);
  const prevLastMsgIds = useRef<{ [convId: number]: string | number }>({});
  const prevUnreadCounts = useRef<{ [convId: number]: number }>({});

  useEffect(() => {
    const slot = document.getElementById('desktop-floating-actions-slot');
    if (!slot) return;
    const observer = new MutationObserver(() => {
      setHasPageActions(slot.children.length > 0);
    });
    observer.observe(slot, { childList: true });
    setHasPageActions(slot.children.length > 0);
    return () => observer.disconnect();
  }, []);

  // When a new message arrives or unread count increments for a dismissed bubble, un-dismiss it!
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
    setDismissedBubbleIds(prev => prev.includes(convId) ? prev : [...prev, convId]);
  };

  // Hide desktop dock on full messages page or checkout
  const isMessagesPage = location.pathname.startsWith('/messages');
  const isCheckoutPage = location.pathname.startsWith('/checkout');

  if (isMessagesPage || isCheckoutPage) {
    return null;
  }

  // Active open chat windows (not minimized)
  const activeWindows = openChatWindows.filter(id => !minimizedChatWindows.includes(id));

  // Floating bubbles:
  // Render conversations that are:
  // 1. Not currently an active open window
  // 2. Either explicitly minimized OR have incoming unread messages
  // 3. Not dismissed by the user
  const floatingConversations = conversations.filter(c => 
    !activeWindows.includes(c.id) &&
    (minimizedChatWindows.includes(c.id) || c.unread_count > 0) &&
    !dismissedBubbleIds.includes(c.id)
  );

  return (
    <div className="fixed bottom-6 right-6 z-[200] hidden md:flex items-end gap-3 pointer-events-none">
      {/* --- Minimized / Incoming Person-Specific Bubbles Stack --- */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <AnimatePresence>
          {floatingConversations.map(conv => (
            <FloatingBubble 
              key={conv.id} 
              conv={conv} 
              onDismiss={handleDismissBubble}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* --- Page Floating Action Buttons Slot (Cart, Back-to-Top, etc.) --- */}
      <div 
        id="desktop-floating-actions-slot" 
        className={`flex flex-col items-center gap-3 pointer-events-auto ${hasPageActions ? '' : 'hidden'}`} 
      />

      {/* --- Concurrent Open Floating Chat Windows --- */}
      <div className="pointer-events-auto">
        {activeWindows.map((convId, index) => {
          // Compute horizontal rightOffset so multiple chat windows stack neatly side-by-side
          const rightOffset = 24 + index * 376;
          return (
            <FloatingChatWindow
              key={convId}
              convId={convId}
              rightOffset={rightOffset}
            />
          );
        })}
      </div>

      {/* --- Main Messenger Conversations List Popup --- */}
      <div className="pointer-events-auto">
        <MessengerListWidget />
      </div>
    </div>
  );
};

export default DesktopChatDock;
