/**
 * DOM + network-adjacent utilities.
 */

/**
 * Debounce a function — trailing-edge. Subsequent calls within `delay`
 * reset the timer; only the final call's args are applied.
 */
export function debounce(fn, delay) {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Trigger a Blob download by creating a temporary <a href="blob:">.
 * The object URL is revoked after a short grace window so in-flight
 * browser downloads don't race the GC.
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 400);
}
