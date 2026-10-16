import React from 'react';
import { useMessages } from '../../context/MessageContext';
import { FloatingChatWindow } from './FloatingChatWindow';
import { FloatingBubble } from './FloatingBubble';
import { MessengerListWidget } from './MessengerListWidget';

import { AnimatePresence } from 'framer-motion';

export const DesktopChatDock: React.FC = () => {
  const {
    conversations,
    openChatWindows,
    minimizedChatWindows,
  } = useMessages();

  const [hasPageActions, setHasPageActions] = React.useState(false);

  React.useEffect(() => {
    const slot = document.getElementById('desktop-floating-actions-slot');
    if (!slot) return;
    const observer = new MutationObserver(() => {
      setHasPageActions(slot.children.length > 0);
    });
    observer.observe(slot, { childList: true });
    setHasPageActions(slot.children.length > 0);
    return () => observer.disconnect();
  }, []);

  // Active open chat windows (not minimized)
  const activeWindows = openChatWindows.filter(id => !minimizedChatWindows.includes(id));

  // Minimized chat windows (rendered as circular floating bubbles)
  const minimizedConversations = conversations.filter(c => minimizedChatWindows.includes(c.id));

  return (
    <div className="fixed bottom-6 right-6 z-[200] hidden md:flex items-end gap-3 pointer-events-none">
      {/* --- Minimized Person-Specific Bubbles Stack --- */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <AnimatePresence>
          {minimizedConversations.map(conv => (
            <FloatingBubble key={conv.id} conv={conv} />
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
          // Compute horizontal rightOffset so multiple chat windows stack neatly side-by-side!
          // Window 0: right 24px
          // Window 1: right 400px (24 + 360 + 16)
          // Window 2: right 776px (400 + 360 + 16)
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
