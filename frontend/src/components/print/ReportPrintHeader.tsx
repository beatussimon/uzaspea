import React from 'react';

interface ReportPrintHeaderProps {
  title: string;
  user: any;
  date?: string;
  logoUrl?: string;
}

export const ReportPrintHeader: React.FC<ReportPrintHeaderProps> = ({ 
  title, 
  user, 
  date = new Date().toLocaleDateString(),
  logoUrl = '/logo_dark.png' 
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
    <div className="hidden print:block font-sans text-black bg-white">
      {/* Header: Centered Logo */}
      <div className="flex justify-center mb-4 mt-4">
        <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
      </div>

      {/* Info Section: 3-Column Layout */}
      <div className="grid grid-cols-3 gap-6 pb-4 border-b-2 border-gray-900 mb-6">
        {/* Left Column: Store Details */}
        <div className="text-left space-y-1">
          <h1 className="text-base font-black uppercase text-gray-900">{storeName}</h1>
          {fullName && storeName !== fullName && <p className="text-sm font-bold text-gray-800">{fullName}</p>}
          {location && <p className="text-sm text-gray-700">{location}</p>}
        </div>

        {/* Center Column: Contact Info */}
        <div className="text-center space-y-1">
          {phone && <p className="text-sm text-gray-700">{phone}</p>}
          {website && <p className="text-sm text-gray-700">{website.replace(/^https?:\/\//, '')}</p>}
          {instagram && <p className="text-sm text-gray-700">@{instagram}</p>}
          {(!phone && !website && !instagram) && (
            <p className="text-sm text-gray-400 italic">No contact info provided</p>
          )}
        </div>
        
        {/* Right Column: Report Details */}
        <div className="text-right space-y-1">
          <h2 className="text-base font-black uppercase text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-2">Generated: {date}</p>
        </div>
      </div>
    </div>
  );
};
