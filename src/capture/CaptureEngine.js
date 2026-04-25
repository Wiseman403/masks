import { CONFIG } from '../config.js';
import { err } from '../utils/logger.js';
import { errMsg } from '../utils/errors.js';
import { haptic } from '../utils/haptic.js';
import { downloadBlob } from '../utils/dom.js';
import { fmtTime } from '../utils/math.js';
import { injectPngTextChunks } from '../utils/png.js';

/**
 * CaptureEngine — photo + video capture via a composite 2D canvas that
 * sources from the engine's WebGL canvas (which already composites video
 * plane + mask + post-FX, so we don't need to composite the video manually).
 *
 * PHOTO PATH
 *   composite.toBlob('image/png') → PNG tEXt metadata injection
 *   (Software / Creation Time / Mask / Intensity / Mode) → Share sheet
 *   or direct download fallback. A timeout wraps toBlob so a browser glitch
 *   can't hang the shutter button.
 *
 * VIDEO PATH
 *   captureStream(fps) from the composite canvas → MediaRecorder with the
 *   best-available codec (WebM VP9/VP8/H.264 fallback). Audio track is
 *   merged via getUserMedia with a 3s timeout so a stuck permission dialog
 *   can't freeze the recorder. Auto-stop at CONFIG.capture.maxVideoDurationMs.
 */
export class CaptureEngine {
    /**
     * @param {import('../core/AppState.js').AppState} state
     * @param {import('../services/NotificationSystem.js').NotificationSystem} notify
     */
    constructor(state, notify) {
        this.state = state;
        this.notify = notify;
        this.engine = null; // AR or Demo
        this.recorder = null;
        this.recording = false;
        this.starting = false;
        this.chunks = [];
        this.recStartTs = 0;
        this.recTimer = null;
        this.composite = document.createElement('canvas');
        this.compositeCtx = this.composite.getContext('2d');
        this.compositeStream = null;
        this._audioStream = null;
        this._tickerHandle = null;
        // Cached watermark state (recomputed 1Hz, not per frame).
        this._wmTs = 0;
        this._wmText = '';
        this._wmLastUpdate = 0;
    }

    setEngine(engine) { this.engine = engine; }

    /** Resize the composite canvas to match the engine's viewport * DPR. */
    prepareComposite() {
        const renderer = this.engine?.getRenderer();
        if (!renderer) return { dpr: 1, w: 0, h: 0 };
        const dpr = renderer.getPixelRatio();
        const w = Math.floor(this.engine.container.clientWidth * dpr);
        const h = Math.floor(this.engine.container.clientHeight * dpr);
        if (this.composite.width !== w || this.composite.height !== h) {
            this.composite.width = w;
            this.composite.height = h;
        }
        return { dpr, w, h };
    }

    /** Refresh cached watermark string once per second (not per frame). */
    _refreshWatermark() {
        const now = performance.now();
        if (now - this._wmLastUpdate < 1000 && this._wmText) return;
        this._wmLastUpdate = now;
        const preset = CONFIG.masks.find(p => p.id === this.state.data.preset)?.name || '';
        // Keep only safe chars (defense-in-depth against any future state poisoning).
        const safePreset = preset.replace(/[^A-Za-z0-9 /._-]/g, '');
        this._wmText = safePreset;
    }

    /**
     * Draw one frame onto the composite canvas. The renderer canvas already
     * contains the video background plane + the masked face, so we blit it
     * directly — no need to re-composite the raw <video>.
     * When the renderer canvas isn't available (engine swap in flight) we
     * clear to obsidian to avoid recording stale pixels.
     */
    drawCompositeFrame() {
        if (!this.engine) return;
        const ctx = this.compositeCtx;
        const { w, h } = this.prepareComposite();
        if (!w || !h) return;
        const rendererCanvas = this.engine.getRenderer()?.domElement;
        if (rendererCanvas && rendererCanvas.width > 0 && rendererCanvas.height > 0) {
            ctx.drawImage(rendererCanvas, 0, 0, w, h);
        } else {
            ctx.fillStyle = '#05070d';
            ctx.fillRect(0, 0, w, h);
        }

        // Discreet mask-name watermark in the corner. No app branding —
        // the captured file should feel like the user's own photo/video.
        this._refreshWatermark();
        if (this._wmText) {
            const m = 18;
            const scale = w / 1080;
            ctx.font = `500 ${Math.round(12 * scale)}px 'Inter', sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.fillText(this._wmText, m, h - m);
        }
    }

    /** Capture a photo — returns a PNG Blob with tEXt metadata chunks. */
    async capturePhoto() {
        this.drawCompositeFrame();
        const raw = await Promise.race([
            new Promise((resolve, reject) => {
                try {
                    this.composite.toBlob(
                        b => b ? resolve(b) : reject(new Error('toBlob returned null')),
                        'image/png',
                        1.0,
                    );
                } catch (e) { reject(e); }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('toBlob timeout')), 8000)),
        ]);
        // Inject PNG tEXt metadata chunks.
        try {
            const buf = await raw.arrayBuffer();
            const presetName = CONFIG.masks.find(p => p.id === this.state.data.preset)?.name || '';
            const entries = [
                ['Software', 'AR Face Masks'],
                ['Creation Time', new Date().toUTCString()],
                ['Mask', presetName],
            ];
            const out = injectPngTextChunks(buf, entries);
            return new Blob([out], { type: 'image/png' });
        } catch (_) {
            return raw;
        }
    }

    /** Capture a photo, then share or download. */
    async photoAndDownload() {
        try {
            haptic(30);
            const blob = await this.capturePhoto();
            const filename = `mask-${Date.now()}.png`;
            const file = new File([blob], filename, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: 'AR Face Masks' });
                    this.notify.push('SHARED', 'Photo sent to share target.', 'success');
                    return;
                } catch (_) { /* fall through to download */ }
            }
            downloadBlob(blob, filename);
            this.notify.push('PHOTO CAPTURED', `${filename} saved.`, 'success');
        } catch (e) {
            this.notify.push('CAPTURE FAILED', errMsg(e), 'error');
            err(e);
        }
    }

    async startRecording() {
        if (this.recording || this.starting) return;
        this.starting = true;
        // Pre-clean any stale streams from prior sessions.
        this._teardownStreams();
        try {
            if (!this.engine) throw new Error('No engine available');
            if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder unsupported');
            this.prepareComposite();

            const ticker = () => { if (this.recording) this.drawCompositeFrame(); };
            this._tickerHandle = setInterval(ticker, Math.round(1000 / CONFIG.capture.videoFps));

            const stream = this.composite.captureStream(CONFIG.capture.videoFps);
            // Merge audio with a 3s timeout so a stuck permission dialog doesn't hang us.
            try {
                const audio = await Promise.race([
                    navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('audio permission timeout')), 3000)),
                ]);
                if (audio) {
                    audio.getAudioTracks().forEach(t => stream.addTrack(t));
                    this._audioStream = audio;
                }
            } catch (_) { /* audio-less recording is fine */ }

            this.compositeStream = stream;
            const mime = this.pickMimeType();
            this.recorder = new MediaRecorder(stream, {
                mimeType: mime,
                videoBitsPerSecond: CONFIG.capture.videoBitsPerSecond,
            });
            this.chunks = [];
            this.recorder.ondataavailable = e => { if (e.data && e.data.size > 0) this.chunks.push(e.data); };
            this.recorder.onstop = () => this.finalizeRecording(mime);
            this.recorder.onerror = ev => {
                this.notify.push('RECORDER ERROR', errMsg(ev.error), 'error');
                this.stopRecording();
            };
            this.recorder.start(100);
            this.recording = true;
            this.recStartTs = performance.now();
            this.state.set({ recording: true });
            haptic([20, 40, 20]);
            this.notify.push('RECORDING', `Capturing composite stream @ ${CONFIG.capture.videoFps}fps.`, 'info', 2200);
            this.recTimer = setTimeout(() => this.stopRecording(), CONFIG.capture.maxVideoDurationMs);
        } catch (e) {
            // Roll back any partial setup.
            this._teardownStreams();
            if (this._tickerHandle) { clearInterval(this._tickerHandle); this._tickerHandle = null; }
            this.notify.push('RECORD FAILED', errMsg(e), 'error');
            err(e);
        } finally {
            this.starting = false;
        }
    }

    _teardownStreams() {
        if (this._audioStream) {
            try { this._audioStream.getTracks().forEach(t => t.stop()); } catch (_) { }
            this._audioStream = null;
        }
        if (this.compositeStream) {
            try { this.compositeStream.getTracks().forEach(t => t.stop()); } catch (_) { }
            this.compositeStream = null;
        }
    }

    /** Pick the best MediaRecorder-supported mime type for the current browser. */
    pickMimeType() {
        const candidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4',
        ];
        for (const m of candidates) {
            if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
        }
        return '';
    }

    stopRecording() {
        if (!this.recording) return;
        this.recording = false;
        this.state.set({ recording: false });
        clearTimeout(this.recTimer); this.recTimer = null;
        clearInterval(this._tickerHandle); this._tickerHandle = null;
        try { this.recorder?.stop(); } catch (_) { }
    }

    finalizeRecording(mime) {
        try {
            this._teardownStreams();
            if (this.chunks.length === 0) {
                this.notify.push('RECORDING EMPTY', 'No frames were captured.', 'warn');
                return;
            }
            const ext = (mime || '').includes('mp4') ? 'mp4' : 'webm';
            const blob = new Blob(this.chunks, { type: mime || 'video/webm' });
            this.chunks = [];
            const filename = `mask-${Date.now()}.${ext}`;
            const file = new File([blob], filename, { type: blob.type });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({ files: [file], title: 'AR Face Masks' })
                    .then(() => this.notify.push('SHARED', 'Video sent to share target.', 'success'))
                    .catch(() => { downloadBlob(blob, filename); this.notify.push('VIDEO SAVED', `${filename}`, 'success'); });
            } else {
                downloadBlob(blob, filename);
                this.notify.push('VIDEO SAVED', `${filename}`, 'success');
            }
        } catch (e) {
            this.notify.push('FINALIZE FAILED', errMsg(e), 'error');
        }
    }

    /** Called by UIController to drive the recording timer HUD. */
    tickTimerDisplay(updateFn) {
        if (!this.recording) return 0;
        const sec = (performance.now() - this.recStartTs) / 1000;
        updateFn(fmtTime(sec));
        return sec;
    }

    dispose() {
        this.stopRecording();
        this._teardownStreams();
        this.composite.width = 0;
        this.composite.height = 0;
    }
}
