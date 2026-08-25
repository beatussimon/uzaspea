import React from 'react';
import { SiWhatsapp, SiInstagram, SiFacebook, SiTiktok, SiX, SiYoutube } from 'react-icons/si';
import { FaLinkedin } from 'react-icons/fa';
import { Globe } from 'lucide-react';

interface SocialLinksProfile {
  whatsapp_number?: string;
  instagram_username?: string;
  facebook_url?: string;
  tiktok_username?: string;
  twitter_username?: string;
  youtube_url?: string;
  linkedin_url?: string;
  website?: string;
}

interface SocialLinksProps {
  profile: SocialLinksProfile;
  iconSize?: number;
  className?: string;
}

interface SocialLink {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

const ensureUrl = (url: string, prefix = 'https://') => {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${prefix}${trimmed}`;
};

const resolveWhatsAppUrl = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  
  // Full URL or wa.me link
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Phone number (e.g. +255 712 345 678, 0712345678, 255712345678)
  let digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    // Standard Tanzania local 07xx / 06xx phone format
    digits = `255${digits.slice(1)}`;
  }
  return `https://wa.me/${digits}`;
};

const SocialLinks: React.FC<SocialLinksProps> = ({ profile, iconSize = 18, className = '' }) => {
  const links: SocialLink[] = [];

  if (profile.whatsapp_number && profile.whatsapp_number.trim()) {
    links.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      href: resolveWhatsAppUrl(profile.whatsapp_number),
      icon: <SiWhatsapp size={iconSize} />,
      color: 'hover:text-[#25D366] hover:bg-[#25D366]/10',
    });
  }

  if (profile.instagram_username && profile.instagram_username.trim()) {
    const raw = profile.instagram_username.trim();
    const href = /^https?:\/\//i.test(raw) 
      ? raw 
      : `https://instagram.com/${raw.replace(/^@/, '')}`;
    links.push({
      key: 'instagram',
      label: 'Instagram',
      href,
      icon: <SiInstagram size={iconSize} />,
      color: 'hover:text-[#E4405F] hover:bg-[#E4405F]/10',
    });
  }

  if (profile.tiktok_username && profile.tiktok_username.trim()) {
    const raw = profile.tiktok_username.trim();
    const href = /^https?:\/\//i.test(raw)
      ? raw
      : `https://tiktok.com/@${raw.replace(/^@/, '')}`;
    links.push({
      key: 'tiktok',
      label: 'TikTok',
      href,
      icon: <SiTiktok size={iconSize} />,
      color: 'hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10',
    });
  }

  if (profile.twitter_username && profile.twitter_username.trim()) {
    const raw = profile.twitter_username.trim();
    const href = /^https?:\/\//i.test(raw)
      ? raw
      : `https://x.com/${raw.replace(/^@/, '')}`;
    links.push({
      key: 'twitter',
      label: 'X (Twitter)',
      href,
      icon: <SiX size={iconSize} />,
      color: 'hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10',
    });
  }

  if (profile.facebook_url && profile.facebook_url.trim()) {
    links.push({
      key: 'facebook',
      label: 'Facebook',
      href: ensureUrl(profile.facebook_url),
      icon: <SiFacebook size={iconSize} />,
      color: 'hover:text-[#1877F2] hover:bg-[#1877F2]/10',
    });
  }

  if (profile.youtube_url && profile.youtube_url.trim()) {
    links.push({
      key: 'youtube',
      label: 'YouTube',
      href: ensureUrl(profile.youtube_url),
      icon: <SiYoutube size={iconSize} />,
      color: 'hover:text-[#FF0000] hover:bg-[#FF0000]/10',
    });
  }

  if (profile.linkedin_url && profile.linkedin_url.trim()) {
    links.push({
      key: 'linkedin',
      label: 'LinkedIn',
      href: ensureUrl(profile.linkedin_url),
      icon: <FaLinkedin size={iconSize} />,
      color: 'hover:text-[#0A66C2] hover:bg-[#0A66C2]/10',
    });
  }

  if (profile.website && profile.website.trim()) {
    links.push({
      key: 'website',
      label: 'Website',
      href: ensureUrl(profile.website),
      icon: <Globe size={iconSize} />,
      color: 'hover:text-brand-500 hover:bg-brand-500/10',
    });
  }

  if (links.length === 0) return null;

  return (
    <div className={`flex items-center flex-wrap gap-1 ${className}`}>
      {links.map((link) => (
        <div key={link.key} className="relative group/tooltip inline-flex items-center justify-center">
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            title={link.label}
            aria-label={link.label}
            className={`p-1.5 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 active:scale-95 ${link.color}`}
          >
            {link.icon}
          </a>

          {/* Floating Hover Tooltip */}
          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-bold tracking-wide whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 group-hover/tooltip:-translate-y-1 transition-all duration-150 shadow-lg z-30">
            {link.label}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-white" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SocialLinks;
