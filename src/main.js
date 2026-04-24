/**
 * main.js — single entry point.
 *
 * Responsibilities:
 *   1. Expose THREE globally so MindAR's ES module and our importmap share
 *      the same Three.js instance.
 *   2. Hydrate persisted state (chosen mask + mirror flag).
 *   3. Persist state changes (debounced) to localStorage.
 *   4. Boot the app.
 */

import * as THREE from 'three';

import { CONFIG } from './config.js';
import { debounce } from './utils/dom.js';
import { errMsg } from './utils/errors.js';
import { App } from './app/App.js';

window.THREE = THREE;

const app = new App();

const LS_KEY = 'xr.masks.v1';
try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
            if (typeof saved.preset === 'string' && CONFIG.masks.some(m => m.id === saved.preset)) {
                app.state.data.preset = saved.preset;
            }
            if (typeof saved.mirror === 'boolean') app.state.data.mirror = saved.mirror;
        }
    }
} catch (_) { /* private-mode / no storage — silent */ }

const persist = debounce(() => {
    try {
        const { preset, mirror } = app.state.data;
        localStorage.setItem(LS_KEY, JSON.stringify({ preset, mirror }));
    } catch (_) { /* quota / private-mode */ }
}, 250);
app.state.on('data', persist);

// Visibility pause — stop driving the animation loop when hidden. Saves
// battery on mobile and prevents a huge dt on resume.
document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden';
    const eng = app.arEngine;
    const renderer = eng?.getRenderer?.();
    if (!renderer) return;
    if (hidden) {
        try { renderer.setAnimationLoop(null); } catch (_) { }
    } else {
        try { renderer.setAnimationLoop(() => eng.frame()); } catch (_) { }
    }
});

window.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    app.notify.push('GPU CONTEXT LOST', 'Attempting recovery…', 'warn', 4000);
}, true);

app.boot().catch(e => {
    console.error('[XR] Fatal boot error:', e);
    const statusEl = document.getElementById('boot-status');
    if (statusEl) statusEl.textContent = 'CRITICAL FAILURE';
    app.notify.push('FATAL', errMsg(e, 'Boot sequence failed'), 'error', 8000);
});

if (CONFIG.debug) window.__xr = app;
