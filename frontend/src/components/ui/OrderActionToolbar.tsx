import React from 'react';
import { Phone, Navigation, MessageSquare } from 'lucide-react';
import { useMessages } from '../../context/MessageContext';

interface OrderActionToolbarProps {
  phone?: string | null;
  phoneLabel?: string;
  username?: string | null;
  messageLabel?: string;
  orderId?: number;
  location?: {
    lat?: number | string | null;
    lng?: number | string | null;
    address?: string | null;
  } | null;
  locationLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const getNavigationUrl = (
  lat?: number | string | null,
  lng?: number | string | null,
  address?: string | null
): string | null => {
  if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address && address.trim().length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
  }
  return null;
};

export const getCleanTelLink = (phone?: string | null): string | null => {
  if (!phone) return null;
  const cleaned = phone.replace(/[^+\d]/g, '');
  return cleaned && cleaned.length >= 6 ? `tel:${cleaned}` : null;
};

export const OrderActionToolbar: React.FC<OrderActionToolbarProps> = ({
  phone,
  phoneLabel = 'Call',
  username,
  messageLabel = 'Message',
  orderId,
  location,
  locationLabel = 'Navigate',
  size = 'sm',
  className = '',
}) => {
  const { startDirectChat } = useMessages();

  const telLink = getCleanTelLink(phone);
  const navUrl = location ? getNavigationUrl(location.lat, location.lng, location.address) : null;

  const handleMessageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (username) {
      startDirectChat(username, undefined, orderId ? `Hi! Inquiring regarding order #${orderId}.` : undefined);
    }
  };

  const btnClasses =
    size === 'sm'
      ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm'
      : 'inline-flex items-center gap-2 px-3.5 py-2 rounded-btn text-sm font-bold transition-all border shadow-sm';

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} onClick={(e) => e.stopPropagation()}>
      {/* Direct In-App Message */}
      {username && (
        <button
          type="button"
          onClick={handleMessageClick}
          className={`${btnClasses} bg-white dark:bg-[#141414] text-gray-800 dark:text-gray-200 border-surface-border dark:border-surface-dark-border hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-brand-500`}
          title={`Message @${username}`}
        >
          <MessageSquare size={size === 'sm' ? 13 : 15} className="text-brand-500" />
          <span>{messageLabel}</span>
        </button>
      )}

      {/* Direct Phone Call */}
      {telLink && (
        <a
          href={telLink}
          onClick={(e) => e.stopPropagation()}
          className={`${btnClasses} bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20`}
          title={`Call ${phone}`}
        >
          <Phone size={size === 'sm' ? 13 : 15} className="text-emerald-500" />
          <span>{phoneLabel}</span>
        </a>
      )}

      {/* Google Maps Navigation */}
      {navUrl && (
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`${btnClasses} bg-blue-500/10 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-500/20 hover:bg-blue-500/20`}
          title="Open directions in Google Maps"
        >
          <Navigation size={size === 'sm' ? 13 : 15} className="text-blue-500" />
          <span>{locationLabel}</span>
        </a>
      )}
    </div>
  );
};

export default OrderActionToolbar;
