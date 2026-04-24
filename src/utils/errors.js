/**
 * Extract a readable message from any thrown value.
 * Handles Error instances, strings, numbers, and non-Error throws.
 *
 * @param {unknown} e
 * @param {string} [fallback='Unknown error']
 */
export function errMsg(e, fallback = 'Unknown error') {
    if (!e) return fallback;
    if (e instanceof Error && e.message) return e.message;
    if (typeof e === 'string') return e;
    try { return String(e) || fallback; } catch (_) { return fallback; }
}
