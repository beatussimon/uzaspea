import React from 'react';

interface VerifiedBadgeProps {
  tier?: string;
  isVerified?: boolean;
  className?: string;
}

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ tier, isVerified, className = "w-4 h-4" }) => {
  if (!isVerified) return null;
  
  const normalizedTier = tier?.toLowerCase();
  
  if (normalizedTier === 'business') {
    return <img src="/gold_checkmark.png" alt="Business Verified" className={className} title="Business Verified Seller" loading="eager" fetchPriority="high" />;
  }
  
  if (normalizedTier === 'seller_pro') {
    return <img src="/greeen_ckeckmark.png?v=2" alt="Verified Seller" className={`${className} scale-[0.85]`} title="Verified Seller" loading="eager" fetchPriority="high" />;
  }
  
  return null;
};

export default VerifiedBadge;
