import { CONFIG } from '../config.js';
import { errMsg } from '../utils/errors.js';
import { debounce } from '../utils/dom.js';

/**
 * UIController — wires the DOM to state, engine, and capture.
 *
 * Owns:
 *   - Mask picker (horizontal scroll strip of labelled buttons).
 *   - Capture controls (photo + video, mirroring the recording state in UI).
 *   - Mirror toggle + camera-flip button.
 *   - Keyboard shortcuts (Space = photo, R = record, M = mirror, ←/→ = cycle mask, F = fullscreen).
 *   - Viewport sync (--vh custom property + debounced engine.resize()).
 *
 * Every listener is collected in `this.listeners` so `dispose()` is thorough.
 */
export class UIController {
    /**
     * @param {import('../core/AppState.js').AppState} state
     * @param {import('../services/NotificationSystem.js').NotificationSystem} notify
     * @param {import('../capture/CaptureEngine.js').CaptureEngine} capture
     */
    constructor(state, notify, capture) {
        this.state = state;
        this.notify = notify;
        this.capture = capture;
        this.engineRef = null;
        /** @type {Array<() => void>} */
        this.listeners = [];
        this._recTimerHandle = null;
    }

    setEngine(engine) { this.engineRef = engine; }

    _on(el, evt, fn, opts) {
        if (!el) return;
        el.addEventListener(evt, fn, opts);
        this.listeners.push(() => el.removeEventListener(evt, fn, opts));
    }

    init() {
        this.buildMaskSelector();
        this.bindButtons();
        this.bindKeyboard();
        this.bindViewport();

        // Single aggregated re-render on any state change.
        this.state.on('data', () => {
            this.syncMaskSelector();
            this.syncCaptureButton();
            this.syncMirrorButton();
        });

        this.syncMaskSelector();
        this.syncCaptureButton();
        this.syncMirrorButton();
    }

    /* ── MASK PICKER ─────────────────────────────────────────────── */

    buildMaskSelector() {
        const host = document.getElementById('mask-selector');
        if (!host) return;
        host.innerHTML = '';
        for (const mask of CONFIG.masks) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mask-btn';
            btn.dataset.maskId = mask.id;
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', String(mask.id === this.state.data.preset));

            const label = document.createElement('span');
            label.className = 'mask-label';
            label.textContent = mask.name;
            btn.appendChild(label);

            this._on(btn, 'click', () => this.selectMask(mask.id));
            host.appendChild(btn);
        }
    }

    syncMaskSelector() {
        const host = document.getElementById('mask-selector');
        if (!host) return;
        const current = this.state.data.preset;
        host.querySelectorAll('.mask-btn').forEach(btn => {
            const selected = btn.dataset.maskId === current;
            btn.classList.toggle('selected', selected);
            btn.setAttribute('aria-selected', String(selected));
        });
    }

    selectMask(id) {
        if (!CONFIG.masks.some(m => m.id === id)) return;
        if (id === this.state.data.preset) return;
        this.state.set({ preset: id });
        if (this.engineRef?.setMask) {
            Promise.resolve(this.engineRef.setMask(id)).catch(e => {
                this.notify.push('MASK FAILED', errMsg(e), 'error');
            });
        }
    }

    cycleMask(delta) {
        const ids = CONFIG.masks.map(m => m.id);
        const i = ids.indexOf(this.state.data.preset);
        const next = ids[(i + delta + ids.length) % ids.length];
        this.selectMask(next);
    }

    /* ── BUTTONS ─────────────────────────────────────────────────── */

    bindButtons() {
        this._on(document.getElementById('btn-photo'),  'click', () => this.capture.photoAndDownload());
        this._on(document.getElementById('btn-video'),  'click', () => this.toggleRecording());
        this._on(document.getElementById('btn-flip'),   'click', () => this.flipCamera());
        this._on(document.getElementById('btn-mirror'), 'click', () => {
            const next = !this.state.data.mirror;
            this.state.set({ mirror: next });
            this.engineRef?.setMirror?.(next);
        });
        this._on(document.getElementById('btn-fullscreen'), 'click', () => this.toggleFullscreen());
    }

    syncCaptureButton() {
        const videoBtn = document.getElementById('btn-video');
        const rec = this.state.data.recording;
        if (videoBtn) {
            videoBtn.classList.toggle('recording', rec);
            videoBtn.setAttribute('aria-pressed', String(rec));
            videoBtn.textContent = rec ? 'STOP' : 'REC';
        }
        const recIndicator = document.getElementById('rec-indicator');
        if (recIndicator) recIndicator.classList.toggle('active', rec);
        // Drive the mm:ss timer while recording.
        if (rec && !this._recTimerHandle) {
            this._recTimerHandle = setInterval(() => {
                this.capture.tickTimerDisplay((s) => {
                    const t = document.getElementById('rec-time');
                    if (t) t.textContent = s;
                });
            }, 250);
        } else if (!rec && this._recTimerHandle) {
            clearInterval(this._recTimerHandle);
            this._recTimerHandle = null;
            const t = document.getElementById('rec-time');
            if (t) t.textContent = '00:00';
        }
    }

    syncMirrorButton() {
        const btn = document.getElementById('btn-mirror');
        if (!btn) return;
        btn.classList.toggle('active', !!this.state.data.mirror);
        btn.setAttribute('aria-pressed', String(!!this.state.data.mirror));
    }

    toggleRecording() {
        if (this.state.data.recording) this.capture.stopRecording();
        else this.capture.startRecording();
    }

    async flipCamera() {
        const next = this.state.data.facing === 'user' ? 'environment' : 'user';
        try {
            if (!this.engineRef?.setFacing) return;
            await this.engineRef.setFacing(next);
            this.notify.push('CAMERA FLIPPED', next === 'user' ? 'Front camera.' : 'Rear camera.', 'info', 1400);
        } catch (e) {
            this.notify.push('FLIP FAILED', errMsg(e), 'error');
        }
    }

    async toggleFullscreen() {
        try {
            if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
            else await document.exitFullscreen();
        } catch (e) {
            this.notify.push('FULLSCREEN FAILED', errMsg(e), 'warn');
        }
    }

    /* ── KEYBOARD ────────────────────────────────────────────────── */

    bindKeyboard() {
        const isTypingTarget = (el) => {
            if (!el || el === document.body) return false;
            const tag = el.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
        };
        this._on(window, 'keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (isTypingTarget(document.activeElement)) return;
            switch (e.key) {
                case ' ':        e.preventDefault(); this.capture.photoAndDownload(); break;
                case 'r': case 'R': this.toggleRecording(); break;
                case 'm': case 'M':
                    this.state.set({ mirror: !this.state.data.mirror });
                    this.engineRef?.setMirror?.(this.state.data.mirror);
                    break;
                case 'f': case 'F': this.toggleFullscreen(); break;
                case 'ArrowLeft':  this.cycleMask(-1); break;
                case 'ArrowRight': this.cycleMask( 1); break;
            }
        });
    }

    /* ── VIEWPORT ────────────────────────────────────────────────── */

    bindViewport() {
        const syncVh = () => {
            // iOS Safari address-bar compensation: use visualViewport when available.
            const h = (window.visualViewport?.height ?? window.innerHeight) || window.innerHeight;
            document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
        };
        syncVh();

        const onResize = debounce(() => {
            syncVh();
            this.engineRef?.resize?.();
        }, 80);

        this._on(window, 'resize', onResize);
        this._on(window, 'orientationchange', onResize);
        if (window.visualViewport) this._on(window.visualViewport, 'resize', onResize);

        // Block accidental pinch-zoom on the AR canvas — we don't want iOS
        // users to double-tap-zoom into the face mesh.
        const block = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
        this._on(document, 'touchmove', block, { passive: false });
    }

    /* ── TEARDOWN ────────────────────────────────────────────────── */

    dispose() {
        for (const off of this.listeners) { try { off(); } catch (_) { } }
        this.listeners = [];
        if (this._recTimerHandle) { clearInterval(this._recTimerHandle); this._recTimerHandle = null; }
    }
}
