/**
 * NotificationSystem — queued toasts with per-toast lifetime.
 *
 * Content is injected via `textContent` only, so strings from errors or
 * engine state can never execute markup (XSS-safe).
 * Click-to-dismiss is wired per-toast; the lifetime timer is cleared on
 * manual dismiss so the leaving animation doesn't race.
 */
export class NotificationSystem {
    /** @param {HTMLElement} container */
    constructor(container) {
        this.container = container;
        this.seq = 0;
        /** @type {Map<number, {timer: any, el: HTMLElement}>} */
        this.live = new Map();
    }

    /**
     * Show a toast.
     * @param {string} title
     * @param {string} body
     * @param {'info'|'warn'|'error'|'success'} [kind='info']
     * @param {number} [ttlMs=3400]
     * @returns {number} opaque id (reserved for future per-toast dismissal).
     */
    push(title, body, kind = 'info', ttlMs = 3400) {
        const id = ++this.seq;
        const el = document.createElement('div');
        el.className = `toast ${kind}`;
        el.setAttribute('role', kind === 'error' ? 'alert' : 'status');

        const titleEl = document.createElement('span');
        titleEl.className = 'toast-title';
        titleEl.textContent = String(title ?? '');
        const bodyEl = document.createElement('span');
        bodyEl.textContent = String(body ?? '');
        el.append(titleEl, bodyEl);

        this.container.appendChild(el);
        let killed = false;
        const kill = () => {
            if (killed) return;
            killed = true;
            el.removeEventListener('click', kill);
            clearTimeout(timer);
            this.live.delete(id);
            el.classList.add('leaving');
            setTimeout(() => { if (el.parentNode) el.remove(); }, 320);
        };
        const timer = setTimeout(kill, ttlMs);
        el.addEventListener('click', kill);
        this.live.set(id, { timer, el });
        return id;
    }

    /** Dismiss all live toasts (used during app teardown). */
    clear() {
        for (const [, rec] of this.live) {
            clearTimeout(rec.timer);
            if (rec.el.parentNode) rec.el.remove();
        }
        this.live.clear();
    }
}
