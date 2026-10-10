import i18n from '../i18n';

export const LOCALE_MAP: Record<string, string> = {
  sw: 'sw-TZ',
  en: 'en-TZ',
  fr: 'fr-FR',
  zh: 'zh-CN',
};

export const getIntlLocale = (lang?: string): string => {
  const currentLang = lang || i18n.language || 'sw';
  const baseLang = currentLang.split('-')[0].toLowerCase();
  return LOCALE_MAP[baseLang] || 'en-TZ';
};

/**
 * Format monetary amounts with currency symbol and locale-aware separators.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency = 'TZS',
  localeOverride?: string
): string {
  if (amount === null || amount === undefined) {
    return `${currency === 'TZS' ? 'TSh' : currency} 0`;
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) {
    return `${currency === 'TZS' ? 'TSh' : currency} 0`;
  }

  const locale = localeOverride || getIntlLocale();

  if (currency.toUpperCase() === 'TZS') {
    // East African formatting convention: TSh 10,000
    return `TSh ${Math.round(num).toLocaleString(locale)}`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: currency === 'TZS' ? 0 : 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString(locale)}`;
  }
}

/**
 * Format dates with locale-aware calendar conventions.
 */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  localeOverride?: string
): string {
  if (!dateInput) return '';

  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  if (isNaN(date.getTime())) return String(dateInput);

  const locale = localeOverride || getIntlLocale();
  const defaultOptions: Intl.DateTimeFormatOptions = options || {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
}

/**
 * Format numbers with locale-aware thousand separators.
 */
export function formatNumber(
  numInput: number | string | null | undefined,
  options?: Intl.NumberFormatOptions,
  localeOverride?: string
): string {
  if (numInput === null || numInput === undefined) return '0';
  const num = typeof numInput === 'string' ? parseFloat(numInput) : Number(numInput);
  if (isNaN(num)) return '0';

  const locale = localeOverride || getIntlLocale();
  return new Intl.NumberFormat(locale, options).format(num);
}
