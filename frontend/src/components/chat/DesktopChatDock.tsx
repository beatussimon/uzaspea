import React from 'react';
import { useMessages } from '../../context/MessageContext';
import { FloatingChatWindow } from './FloatingChatWindow';
import { FloatingBubble } from './FloatingBubble';
import { MessengerListWidget } from './MessengerListWidget';

export const DesktopChatDock: React.FC = () => {
  const {
    conversations,
    openChatWindows,
    minimizedChatWindows,
  } = useMessages();

  // Active open chat windows (not minimized)
  const activeWindows = openChatWindows.filter(id => !minimizedChatWindows.includes(id));

  // Minimized chat windows (rendered as circular floating bubbles)
  const minimizedConversations = conversations.filter(c => minimizedChatWindows.includes(c.id));

  return (
    <div className="fixed bottom-0 right-6 z-50 hidden md:flex items-end gap-3 pointer-events-none">
      {/* --- Minimized Person-Specific Bubbles Stack --- */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {minimizedConversations.map(conv => (
          <FloatingBubble key={conv.id} conv={conv} />
        ))}
      </div>

      {/* --- Concurrent Open Floating Chat Windows --- */}
      <div className="pointer-events-auto">
        {activeWindows.map((convId, index) => {
          // Compute horizontal rightOffset so multiple chat windows stack neatly side-by-side!
          // Window 0: right 24px (6rem)
          // Window 1: right 370px (24 + 330 + 16)
          // Window 2: right 716px (370 + 330 + 16)
          const rightOffset = 24 + index * 346;
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
