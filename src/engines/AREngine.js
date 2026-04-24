import * as THREE from 'three';

import { CONFIG } from '../config.js';
import { warn } from '../utils/logger.js';
import { errMsg } from '../utils/errors.js';
import { disposeTree } from '../utils/three-helpers.js';
import { makeVideoBackground } from '../render/videoBackground.js';
import { MaskEngine } from '../render/MaskEngine.js';

/**
 * AREngine — wraps MindAR's face tracker + Three.js renderer + MaskEngine.
 *
 * Lifecycle: init() → start() → (frame loop) → stop() / dispose().
 * `start()` and `stop()` are idempotent; concurrent calls are rejected by
 * `starting`/`stopping` guards so double-clicks never leak two MindAR sessions.
 *
 * MindAR is an ES module loaded at boot by App.boot(); by the time init() runs,
 * `window.MINDAR.FACE.MindARThree` must be available.
 */
export class AREngine {
    /**
     * @param {HTMLElement} container
     * @param {import('../core/AppState.js').AppState} state
     */
    constructor(container, state) {
        this.container = container;
        this.state = state;
        this.mindarThree = null;
        /** @type {MaskEngine|null} */
        this.maskEngine = null;
        this.running = false;
        this.starting = false;
        this.stopping = false;
        this.lastTick = 0;
        this.lastFaceSeen = 0;
        this.videoBg = null;
        this.faceMesh = null;
        this._sizeVec = new THREE.Vector2();
    }

    async init() {
        if (!(window.MINDAR && window.MINDAR.FACE && window.MINDAR.FACE.MindARThree)) {
            throw new Error('MindAR face module not available');
        }
        const { MindARThree } = window.MINDAR.FACE;
        this.mindarThree = new MindARThree({
            container: this.container,
            shouldFaceUser: this.state.data.facing === 'user',
        });
        const { renderer, scene } = this.mindarThree;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.performance.pixelRatioCap));
        scene.background = null;

        // Simple 3-point lighting — key + fill + ambient. Masks use PBR materials
        // so decent lighting matters; the scene is face-facing so we light from +Z.
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 0.85);
        key.position.set(0.4, 0.6, 1.0);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.35);
        fill.position.set(-0.6, -0.2, 0.8);
        scene.add(fill);

        // Suppress MindAR's default white face-mesh material — we still need
        // the mesh in the scene as a tracking reference but don't want it visible.
        this.faceMesh = this.mindarThree.addFaceMesh();
        if (this.faceMesh.material) {
            const mats = Array.isArray(this.faceMesh.material) ? this.faceMesh.material : [this.faceMesh.material];
            mats.forEach(m => {
                if (!m) return;
                m.transparent = true;
                m.opacity = 0;
                m.colorWrite = false;
                m.depthWrite = false;
            });
        }
        scene.add(this.faceMesh);

        this.maskEngine = new MaskEngine(this.mindarThree);
        await this.maskEngine.applyMask(this.state.data.preset);
    }

    async start() {
        if (this.running || this.starting) {
            warn('AREngine.start ignored: already running/starting');
            return;
        }
        this.starting = true;
        try {
            if (!this.mindarThree) await this.init();
            try {
                await this.mindarThree.start();
            } catch (e) {
                throw new Error(`Camera start failed: ${errMsg(e)}`);
            }

            const video = this.mindarThree.video;
            this.videoBg = makeVideoBackground(video, this.state.data.mirror);
            this.mindarThree.scene.add(this.videoBg.mesh);

            this.running = true;
            this.lastTick = performance.now();
            this.mindarThree.renderer.setAnimationLoop(() => this.frame());

            this.resize();
        } finally {
            this.starting = false;
        }
    }

    frame() {
        if (!this.running || !this.mindarThree) return;
        const now = performance.now();
        this.lastTick = now;

        if (this.videoBg) {
            const v = this.mindarThree.video;
            if (v?.videoWidth && v?.videoHeight) {
                this.videoBg.uniforms.uVideoAspect.value = v.videoWidth / v.videoHeight;
            }
            const s = this.mindarThree.renderer.getSize(this._sizeVec);
            if (s.y > 0) this.videoBg.uniforms.uScreenAspect.value = s.x / s.y;
            this.videoBg.uniforms.uMirror.value = this.state.data.mirror ? 1 : 0;
        }

        // Face-detected state for UI signalling.
        const faceVisible = this.faceMesh?.visible === true;
        if (faceVisible) {
            this.lastFaceSeen = now;
            if (!this.state.data.faceDetected) this.state.set({ faceDetected: true });
        } else if (this.state.data.faceDetected && now - this.lastFaceSeen > CONFIG.app.faceLostGraceMs) {
            this.state.set({ faceDetected: false });
        }

        try {
            this.mindarThree.renderer.render(this.mindarThree.scene, this.mindarThree.camera);
        } catch (_) { /* context loss — toast is shown by main.js listener */ }
    }

    resize() {
        if (!this.mindarThree?.renderer) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (!w || !h) return;
        this.mindarThree.renderer.setSize(w, h, false);
        if (this.mindarThree.camera?.isPerspectiveCamera) {
            this.mindarThree.camera.aspect = w / h;
            this.mindarThree.camera.updateProjectionMatrix();
        }
    }

    setMask(id) {
        if (this.maskEngine) return this.maskEngine.applyMask(id);
    }

    setMirror(mirror) {
        if (this.videoBg) this.videoBg.uniforms.uMirror.value = mirror ? 1 : 0;
    }

    async setFacing(facing) {
        // Hard restart so MindAR reacquires the camera with the new facingMode.
        await this.dispose();
        this.state.set({ facing });
        await this.init();
        await this.start();
    }

    async stop() {
        if (this.stopping) return;
        this.stopping = true;
        this.running = false;
        try {
            if (this.mindarThree?.renderer) {
                this.mindarThree.renderer.setAnimationLoop(null);
            }
            if (this.mindarThree) {
                try { this.mindarThree.stop(); } catch (_) { }
            }
        } finally {
            this.stopping = false;
        }
    }

    async dispose() {
        await this.stop();
        if (this.maskEngine) { this.maskEngine.dispose(); this.maskEngine = null; }
        if (this.videoBg) {
            try { this.videoBg.texture.dispose(); } catch (_) { }
            disposeTree(this.videoBg.mesh);
            this.videoBg = null;
        }
        if (this.mindarThree?.renderer) {
            try { this.mindarThree.renderer.setAnimationLoop(null); } catch (_) { }
            try { this.mindarThree.renderer.dispose(); } catch (_) { }
            try { this.mindarThree.renderer.forceContextLoss?.(); } catch (_) { }
        }
        this.mindarThree = null;
        this.faceMesh = null;
        while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
    }

    getRenderer() { return this.mindarThree?.renderer; }
    getVideo()    { return this.mindarThree?.video; }
}
