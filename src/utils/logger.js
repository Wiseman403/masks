import { CONFIG } from '../config.js';

/**
 * Debug-gated logger. The `log` and `warn` channels no-op in production
 * (CONFIG.debug === false). `err` is always surfaced so operators still see
 * genuine failures even with debug muted.
 */
export const log = (...args) => { if (CONFIG.debug) console.log('[NMP]', ...args); };
export const warn = (...args) => { if (CONFIG.debug) console.warn('[NMP]', ...args); };
export const err = (...args) => console.error('[NMP]', ...args);
