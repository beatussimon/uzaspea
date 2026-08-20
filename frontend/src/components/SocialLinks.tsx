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

const SocialLinks: React.FC<SocialLinksProps> = ({ profile, iconSize = 18, className = '' }) => {
  const links: SocialLink[] = [];

  if (profile.whatsapp_number) {
    const cleanNumber = profile.whatsapp_number.replace(/[^0-9]/g, '');
    links.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/${cleanNumber}`,
      icon: <SiWhatsapp size={iconSize} />,
      color: 'hover:text-[#25D366]',
    });
  }

  if (profile.instagram_username) {
    const handle = profile.instagram_username.replace('@', '');
    links.push({
      key: 'instagram',
      label: 'Instagram',
      href: `https://instagram.com/${handle}`,
      icon: <SiInstagram size={iconSize} />,
      color: 'hover:text-[#E4405F]',
    });
  }

  if (profile.facebook_url) {
    links.push({
      key: 'facebook',
      label: 'Facebook',
      href: profile.facebook_url,
      icon: <SiFacebook size={iconSize} />,
      color: 'hover:text-[#1877F2]',
    });
  }

  if (profile.tiktok_username) {
    const handle = profile.tiktok_username.replace('@', '');
    links.push({
      key: 'tiktok',
      label: 'TikTok',
      href: `https://tiktok.com/@${handle}`,
      icon: <SiTiktok size={iconSize} />,
      color: 'hover:text-[#000000] dark:hover:text-[#ffffff]',
    });
  }

  if (profile.twitter_username) {
    const handle = profile.twitter_username.replace('@', '');
    links.push({
      key: 'twitter',
      label: 'X (Twitter)',
      href: `https://x.com/${handle}`,
      icon: <SiX size={iconSize} />,
      color: 'hover:text-[#000000] dark:hover:text-[#ffffff]',
    });
  }

  if (profile.youtube_url) {
    links.push({
      key: 'youtube',
      label: 'YouTube',
      href: profile.youtube_url,
      icon: <SiYoutube size={iconSize} />,
      color: 'hover:text-[#FF0000]',
    });
  }

  if (profile.linkedin_url) {
    links.push({
      key: 'linkedin',
      label: 'LinkedIn',
      href: profile.linkedin_url,
      icon: <FaLinkedin size={iconSize} />,
      color: 'hover:text-[#0A66C2]',
    });
  }

  if (profile.website) {
    links.push({
      key: 'website',
      label: 'Website',
      href: profile.website,
      icon: <Globe size={iconSize} />,
      color: 'hover:text-brand-500',
    });
  }

  if (links.length === 0) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          title={link.label}
          className={`text-gray-500 dark:text-gray-400 transition-colors duration-200 ${link.color}`}
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
};

export default SocialLinks;
