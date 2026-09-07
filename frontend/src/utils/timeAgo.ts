import i18n from '../i18n';

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return i18n.t('years_ago', { count: Math.floor(interval), defaultValue: `${Math.floor(interval)} years ago` });
  interval = seconds / 2592000;
  if (interval > 1) return i18n.t('months_ago', { count: Math.floor(interval), defaultValue: `${Math.floor(interval)} months ago` });
  interval = seconds / 86400;
  if (interval > 1) return i18n.t('days_ago', { count: Math.floor(interval), defaultValue: `${Math.floor(interval)} days ago` });
  interval = seconds / 3600;
  if (interval > 1) return i18n.t('hours_ago', { count: Math.floor(interval), defaultValue: `${Math.floor(interval)} hours ago` });
  interval = seconds / 60;
  if (interval > 1) return i18n.t('minutes_ago', { count: Math.floor(interval), defaultValue: `${Math.floor(interval)} minutes ago` });
  return i18n.t('just_now', { defaultValue: 'Just now' });
}

