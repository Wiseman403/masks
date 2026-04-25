import { CONFIG } from '../config.js';
import { log, warn, err } from '../utils/logger.js';
import { errMsg } from '../utils/errors.js';
import { AppState } from '../core/AppState.js';
import { NotificationSystem } from '../services/NotificationSystem.js';
import { CaptureEngine } from '../capture/CaptureEngine.js';
import { UIController } from '../ui/UIController.js';
import { AREngine } from '../engines/AREngine.js';

// MindAR 1.2.5 ships `dist/mindar-face-three.prod.js` as an ES module (not UMD),
// so it must be loaded via dynamic import() — a classic <script src> throws
// SyntaxError on the top-level `import` statements and never attaches
// window.MINDAR.FACE. The module imports "three" which our importmap resolves.
const MINDAR_ESM_URL = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-face-three.prod.js';

/**
 * App — orchestrator. Owns the AREngine, CaptureEngine, UI, and notifications.
 * Boot sequence:
 *   1. Splash-screen stages (minimum durations so the UI doesn't flash too fast).
 *   2. Dynamic import of MindAR.
 *   3. Permission overlay → startAR().
 */
export class App {
    constructor() {
        this.state = new AppState();
        this.notify = new NotificationSystem(document.getElementById('toast-container'));
        this.capture = new CaptureEngine(this.state, this.notify);
        this.ui = new UIController(this.state, this.notify, this.capture);
        /** @type {AREngine|null} */
        this.arEngine = null;
        this.mindARLoaded = false;
        /** @type {(() => void) | null} */
        this._permCleanup = null;
    }

    async boot() {
        const bootEl = document.getElementById('boot-screen');
        const statusEl = document.getElementById('boot-status');
        const updateBoot = (msg) => {
            if (statusEl) statusEl.textContent = msg;
            log('boot:', msg);
        };

        try {
            updateBoot(CONFIG.app.boot.stages[0].msg);
            await this.delay(CONFIG.app.boot.stages[0].minDuration);

            updateBoot(CONFIG.app.boot.stages[1].msg);
            const loadStart = performance.now();
            try {
                const mod = await import(/* @vite-ignore */ MINDAR_ESM_URL);
                if (!(window.MINDAR && window.MINDAR.FACE)) {
                    window.MINDAR = window.MINDAR || {};
                    window.MINDAR.FACE = window.MINDAR.FACE || {};
                }
                if (!window.MINDAR.FACE.MindARThree && mod?.MindARThree) {
                    window.MINDAR.FACE.MindARThree = mod.MindARThree;
                }
                this.mindARLoaded = !!(window.MINDAR?.FACE?.MindARThree);
                if (!this.mindARLoaded) warn('MindAR module loaded but MindARThree export missing');
            } catch (e) {
                warn('MindAR load failed:', errMsg(e));
            }
            const elapsed = performance.now() - loadStart;
            if (elapsed < CONFIG.app.boot.stages[1].minDuration) {
                await this.delay(CONFIG.app.boot.stages[1].minDuration - elapsed);
            }

            updateBoot(CONFIG.app.boot.stages[2].msg);
            this.ui.init();
            await this.delay(CONFIG.app.boot.stages[2].minDuration);

            if (bootEl) bootEl.classList.add('hidden');
            await this.delay(300);

            if (!this.mindARLoaded) {
                const reason = !window.isSecureContext
                    ? 'Camera AR needs HTTPS. Serve over https:// or localhost.'
                    : 'The AR module failed to load. Check your network.';
                this.notify.push('AR UNAVAILABLE', reason, 'error', 8000);
                return;
            }
            if (!window.isSecureContext) {
                this.notify.push(
                    'INSECURE CONTEXT',
                    'Camera access needs HTTPS. Serve over https:// or localhost.',
                    'warn',
                    6000,
                );
            }
            this.showPermissionOverlay();
        } catch (e) {
            err('Boot failed:', e);
            updateBoot('BOOT FAILED');
            this.notify.push('FATAL', errMsg(e, 'Boot sequence failed'), 'error', 8000);
        }
    }

    /** Permission overlay — idempotent listener management. */
    showPermissionOverlay() {
        const overlay = document.getElementById('permission-overlay');
        const grantBtn = document.getElementById('perm-grant');
        if (!overlay || !grantBtn) return;

        if (this._permCleanup) { try { this._permCleanup(); } catch (_) { } this._permCleanup = null; }
        overlay.classList.add('visible');

        const onGrant = async () => { cleanup(); await this.startAR(); };
        const cleanup = () => {
            overlay.classList.remove('visible');
            grantBtn.removeEventListener('click', onGrant);
            this._permCleanup = null;
        };
        this._permCleanup = cleanup;
        grantBtn.addEventListener('click', onGrant);
        try { grantBtn.focus({ preventScroll: true }); } catch (_) { }
    }

    async startAR() {
        try {
            const arCont = document.getElementById('ar-container');
            arCont?.classList.remove('hidden-util');
            arCont?.setAttribute('aria-hidden', 'false');

            if (!this.arEngine) this.arEngine = new AREngine(arCont, this.state, this.notify);
            await this.arEngine.start();
            this.capture.setEngine(this.arEngine);
            this.ui.setEngine(this.arEngine);
            this.notify.push('AR ACTIVE', 'Face tracking engaged.', 'success', 1800);
        } catch (e) {
            err('AR start failed:', e);
            this.notify.push('AR FAILED', errMsg(e, 'Camera error'), 'error', 5000);
        }
    }

    delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    async dispose() {
        if (this._permCleanup) { try { this._permCleanup(); } catch (_) { } this._permCleanup = null; }
        if (this.arEngine) { try { await this.arEngine.dispose(); } catch (_) { } this.arEngine = null; }
        try { this.capture.dispose(); } catch (_) { }
        try { this.ui.dispose(); } catch (_) { }
        try { this.notify.clear(); } catch (_) { }
    }
}
