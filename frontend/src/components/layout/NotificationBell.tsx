import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import api from '../../api';

const NotificationBell: React.FC = () => {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const isAuthenticated = !!localStorage.getItem('access_token');

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/api/notifications/unread_count/').then(r => setCount(r.data.count)).catch(() => {});
  }, [isAuthenticated]);

  const openPanel = () => {
    setOpen(!open);
    if (!open) {
      api.get('/api/notifications/').then(r => setNotifications(r.data.results || r.data)).catch(() => {});
      api.post('/api/notifications/mark_all_read/').then(() => setCount(0)).catch(() => {});
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={openPanel} className="relative btn-ghost p-2 text-gray-600 dark:text-gray-300 hover:scale-110 transition-transform">
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-100 dark:border-gray-800 font-bold text-sm">Notifications</div>
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">All caught up!</p>
          ) : notifications.map(n => (
            <div key={n.id} className={`p-3 border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${!n.is_read ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}
              onClick={() => { setOpen(false); if (n.link) window.location.href = n.link; }}>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{n.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
