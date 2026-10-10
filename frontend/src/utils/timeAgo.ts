import i18n from '../i18n';

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return i18n.t('just_now', { defaultValue: 'Just now' });
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return i18n.t('minutes_ago', { count: minutes, defaultValue: `${minutes} minutes ago` });
  }

  const hours = Math.floor(seconds / 3600);
  if (hours < 24) {
    return i18n.t('hours_ago', { count: hours, defaultValue: `${hours} hours ago` });
  }

  const days = Math.floor(seconds / 86400);
  if (days < 30) {
    return i18n.t('days_ago', { count: days, defaultValue: `${days} days ago` });
  }

  const months = Math.floor(seconds / 2592000);
  if (months < 12) {
    return i18n.t('months_ago', { count: months, defaultValue: `${months} months ago` });
  }

  const years = Math.floor(seconds / 31536000);
  return i18n.t('years_ago', { count: years, defaultValue: `${years} years ago` });
}
