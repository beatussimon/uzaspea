import React from 'react';

interface VerifiedBadgeProps {
  tier?: string;
  isVerified?: boolean;
  className?: string;
}

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ tier, isVerified, className = "w-4 h-4" }) => {
  if (!isVerified) return null;
  
  const normalizedTier = tier?.toLowerCase();
  
  if (normalizedTier === 'premium') {
    return <img src="/gold_checkmark.png" alt="Premium" className={className} title="Premium Seller" />;
  }
  
  if (normalizedTier === 'standard') {
    return <img src="/greeen_ckeckmark.png" alt="Standard" className={className} title="Standard Seller" />;
  }
  
  return null;
};

export default VerifiedBadge;
