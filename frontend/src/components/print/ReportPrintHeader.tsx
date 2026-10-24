import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface ReportPrintHeaderProps {
  title: string;
  user: any;
  date?: string;
  logoUrl?: string;
  qrCodeUrl?: string;
}

export const ReportPrintHeader: React.FC<ReportPrintHeaderProps> = ({ 
  title, 
  user, 
  date = new Date().toLocaleDateString(),
  logoUrl = '/logo_dark.png',
  qrCodeUrl
}) => {
  const fullName = (user?.first_name || user?.last_name)
    ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
    : null;
  const storeName = user?.store_profile?.store_name || user?.store_name || fullName || user?.username || 'Store Name';
  const location = user?.store_profile?.location || user?.location;
  const phone = user?.store_profile?.phone || user?.store_profile?.phone_number || user?.phone_number || user?.phone;
  const website = user?.store_profile?.website;
  const instagram = user?.store_profile?.instagram;

  return (
    <div className="font-sans text-black bg-white">
      {/* Header: Centered Logo */}
      <div className="flex justify-center mb-3 mt-1">
        <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
      </div>

      {/* Info Section: 3-Column Layout */}
      <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-gray-900 mb-4 items-center">
        {/* Left Column: Store Details */}
        <div className="text-left space-y-0.5">
          <h1 className="text-sm font-black uppercase text-gray-900">{storeName}</h1>
          {fullName && storeName !== fullName && <p className="text-xs font-semibold text-gray-700">{fullName}</p>}
          {location && <p className="text-xs text-gray-600">{location}</p>}
        </div>

        {/* Center Column: Contact Info */}
        <div className="text-center space-y-0.5">
          {phone && <p className="text-xs text-gray-700 font-medium">{phone}</p>}
          {website && <p className="text-xs text-gray-700">{website.replace(/^https?:\/\//, '')}</p>}
          {instagram && <p className="text-xs text-gray-700">@{instagram}</p>}
          {(!phone && !website && !instagram) && (
            <p className="text-xs text-gray-400 italic">No contact info provided</p>
          )}
        </div>
        
        {/* Right Column: Report Details & Optional QR Code */}
        <div className="flex items-center justify-end gap-3 text-right">
          <div className="space-y-0.5">
            <h2 className="text-xs font-black uppercase text-gray-900 leading-tight">{title}</h2>
            <p className="text-[10px] text-gray-500">Date: {date}</p>
          </div>
          {qrCodeUrl && (
            <div className="flex flex-col items-center shrink-0">
              <QRCodeSVG value={qrCodeUrl} size={44} level="M" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
