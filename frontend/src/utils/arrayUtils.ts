/**
 * Safely extracts an array from API responses (both paginated `{ results: [...] }` and direct array `[...]`).
 * Returns an empty array `[]` if the input is null, undefined, or a non-array error object.
 */
export function ensureArray<T = any>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
}
