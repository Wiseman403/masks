/**
 * Haptic feedback. Silently no-ops on iOS Safari (which lacks navigator.vibrate).
 *
 * @param {number | number[]} [pattern=20]
 */
export function haptic(pattern = 20) {
    try {
        if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) { /* noop */ }
}
