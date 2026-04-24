/**
 * Pure math helpers — no DOM, no side effects.
 */

/** Clamp `v` into the inclusive [a, b] range. */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Linear interpolation between a and b by t (0..1). */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Pad non-negative integer with leading zeros to a target width. */
export function pad(n, width = 3) {
    const s = String(Math.max(0, Math.floor(n)));
    return s.padStart(width, '0');
}

/** Format MM:SS from a duration in seconds. */
export function fmtTime(sec) {
    const s = Math.floor(sec) % 60;
    const m = Math.floor(sec / 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Deterministic 1D hash → [0, 1). Not a CSPRNG — purely decorative. */
export function hash01(x) {
    const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
}
