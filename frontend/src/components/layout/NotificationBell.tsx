import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import api from '../../api';

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const isAuthenticated = !!localStorage.getItem('access_token');

  useEffect(() => {
    if (!isAuthenticated) return;

    // Request HTML5 notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const checkNotifications = async () => {
      try {
        const res = await api.get('/api/notifications/');
        const list = res.data.results || res.data || [];
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => b.id - a.id);
          const newest = sorted[0];
          const storedLastId = localStorage.getItem('last_notified_notification_id');
          
          if (storedLastId) {
            const lastId = parseInt(storedLastId, 10);
            const newUnreads = sorted.filter(n => n.id > lastId && !n.is_read);
            
            newUnreads.reverse().forEach(n => {
              if (Notification.permission === 'granted') {
                try {
                  new Notification(n.title, {
                    body: n.message,
                  });
                } catch (e) {
                  console.error('Failed to trigger native notification:', e);
                }
              }
            });
          }
          localStorage.setItem('last_notified_notification_id', String(newest.id));
        }

        const countRes = await api.get('/api/notifications/unread_count/');
        setCount(countRes.data.count);
      } catch (err: any) {
        if (err.response?.status === 401) {
          // Token expired or invalid, silently ignore to avoid console spam
          clearInterval(interval);
        } else {
          console.error('Error fetching notifications:', err);
        }
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    const closePanel = () => setOpen(false);
    document.addEventListener('click', closePanel);
    return () => document.removeEventListener('click', closePanel);
  }, []);

  const openPanel = () => {
    setOpen(!open);
    if (!open) {
      api.get('/api/notifications/').then(r => {
        const list = r.data.results || r.data || [];
        setNotifications(list);
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => b.id - a.id);
          localStorage.setItem('last_notified_notification_id', String(sorted[0].id));
        }
      }).catch(() => {});
      api.post('/api/notifications/mark_all_read/').then(() => setCount(0)).catch(() => {});
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={openPanel} className={`relative btn-ghost p-2 hover:scale-110 transition-transform ${className || 'text-gray-600 dark:text-gray-300'}`}>
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
