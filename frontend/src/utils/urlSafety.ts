/**
 * URL Safety and Sanitization Utilities
 * Prevents Open Redirects, XSS via javascript:/data: URLs, and unsafe script tag injections.
 */

/**
 * Validates and sanitizes a target path for internal application redirects.
 * Rejects absolute URLs with protocol handlers, protocol-relative slashes (//),
 * backslashes (/\), and null bytes.
 */
export function safeRedirectPath(target: string | null | undefined, fallback: string = '/'): string {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const trimmed = target.trim();

  // Must start with a single slash, but not double slash (//) or backslash (/\ or \)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.startsWith('\\')) {
    return fallback;
  }

  // Reject CR/LF/null characters
  if (/[\r\n\0]/.test(trimmed)) {
    return fallback;
  }

  // Reject URLs containing protocol prefixes anywhere before a query parameter
  const pathBeforeQuery = trimmed.split('?')[0];
  if (pathBeforeQuery.includes(':')) {
    return fallback;
  }

  return trimmed;
}

/**
 * Validates external URLs, ensuring they use safe protocols (http/https).
 * Rejects javascript:, data:, vbscript:, etc.
 */
export function safeExternalUrl(url: string | null | undefined, allowedProtocols: string[] = ['https:', 'http:']): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (allowedProtocols.includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch {
    // Relative URL or invalid URL
    return null;
  }
  return null;
}

/**
 * HTML entity escaping for strings rendered into raw markup contexts.
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely serializes objects into JSON-LD script content.
 * Escapes '<' to avoid closing the enclosing script tag prematurely (`</script>`).
 */
export function safeJsonLdString(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
