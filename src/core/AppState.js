import { CONFIG } from '../config.js';
import { err } from '../utils/logger.js';

/**
 * AppState — minimal reactive state bag with pub/sub.
 *
 * `data` holds the user-visible mutable slice: currently-selected mask,
 * camera facing, mirror flag, face-detection status, recording flag.
 *
 * Subscribers to `'data'` receive a shallow clone so handlers may mutate
 * their own copy without racing concurrent `.set()` calls.
 */
export class AppState {
    constructor() {
        this.data = {
            preset: CONFIG.masks[0].id, // 'preset' kept for CaptureEngine back-compat
            mirror: true,
            facing: 'user',
            faceDetected: false,
            recording: false,
        };
        /** @type {Map<string, Set<Function>>} */
        this.listeners = new Map();
    }

    on(event, cb) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event).add(cb);
        return () => this.listeners.get(event)?.delete(cb);
    }

    emit(event, payload) {
        const set = this.listeners.get(event);
        if (!set) return;
        for (const cb of Array.from(set)) {
            try { cb(payload); } catch (e) { err('listener', event, e); }
        }
    }

    set(partial) {
        Object.assign(this.data, partial);
        this.emit('data', { ...this.data });
    }
}
