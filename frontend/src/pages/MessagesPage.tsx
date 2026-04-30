import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import api from '../api';

// FIX B-12: Buyer-Seller Messaging Page
const MessagesPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeConv, setActiveConv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const username = localStorage.getItem('username') || '';
  const currentUserId = parseInt(localStorage.getItem('user_id') || '0');

  useEffect(() => {
    api.get('/api/conversations/')
      .then(r => setConversations(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (id) {
      api.get(`/api/conversations/${id}/messages/`)
        .then(r => setMessages(r.data.results || r.data))
        .catch(() => {});
      const conv = conversations.find(c => c.id === parseInt(id));
      if (conv) setActiveConv(conv);
    }
  }, [id, conversations]);

  // FIX HIGH-01: real-time message delivery
  useEffect(() => {
    if (!id || !localStorage.getItem('access_token')) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('access_token');
    const wsUrl = `${proto}://${window.location.host}/ws/chat/?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'chat_message' && data.conversation_id === parseInt(id)) {
            setMessages(prev => {
                // Avoid duplicate if already in list
                if (prev.some((m: any) => m.id === data.message.id)) return prev;
                return [...prev, data.message];
            });
        }
    };

    return () => { ws.close(); };
  }, [id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !id) return;
    try {
      const res = await api.post(`/api/conversations/${id}/messages/`, { content: newMessage });
      setMessages(prev => [...prev, res.data]);
      setNewMessage('');
    } catch (e) { /* ignore */ }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin h-8 w-8 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <MessageSquare size={24} /> Messages
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[60vh]">
        {/* Conversation List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-100 dark:border-gray-700 font-bold text-sm text-gray-500">
            Conversations
          </div>
          {conversations.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">No conversations yet</p>
          ) : conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => navigate(`/messages/${conv.id}`)}
              className={`p-4 border-b border-gray-50 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                id && parseInt(id) === conv.id ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''
              }`}
            >
              <p className="font-bold text-sm text-gray-900 dark:text-white">
                {conv.buyer_username === username ? conv.seller_username : conv.buyer_username}
              </p>
              {conv.product_name && (
                <p className="text-xs text-brand-600 mt-0.5">Re: {conv.product_name}</p>
              )}
              {conv.last_message && (
                <p className="text-xs text-gray-500 mt-1 truncate">{conv.last_message.content}</p>
              )}
              {conv.unread_count > 0 && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {conv.unread_count}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Message Thread */}
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
          {!id ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                <button onClick={() => navigate('/messages')} className="md:hidden btn-ghost p-1">
                  <ArrowLeft size={18} />
                </button>
                <span className="font-bold text-gray-900 dark:text-white">
                  {activeConv ? (activeConv.buyer_username === username ? activeConv.seller_username : activeConv.buyer_username) : 'Chat'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
                {messages.map(msg => {
                  const isOwn = msg.sender === currentUserId;
                  return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                      isOwn
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                <input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="input flex-1"
                />
                <button onClick={sendMessage} className="btn-primary px-4 py-2 flex items-center gap-1">
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
