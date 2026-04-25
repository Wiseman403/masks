import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { CONFIG } from '../config.js';
import { warn, err } from '../utils/logger.js';
import { errMsg } from '../utils/errors.js';
import { disposeTree } from '../utils/three-helpers.js';
import { builders } from './maskBuilders.js';

/**
 * MaskEngine — attaches a 3D mask (GLTF) to a MindAR face-mesh landmark.
 *
 * Lifecycle per swap:
 *   1. Remove + dispose the previously active mesh.
 *   2. Load the GLTF (cached after first fetch).
 *   3. Look up (or create) the anchor group for the target landmark.
 *   4. Attach the mesh.
 *
 * Anchor groups are cached by landmark index so swapping between two
 * masks that share a landmark doesn't re-create the anchor and MindAR
 * keeps a stable tracking reference.
 *
 * GLTF scenes are cached so re-selecting a mask after disposal is instant
 * — we clone the scene each time so per-anchor transforms don't bleed
 * between selections.
 */
export class MaskEngine {
    /**
     * @param {*} mindarThree — the MindARThree instance from AREngine
     * @param {{ onLoadStart?: (def: any) => void, onLoadEnd?: (def: any, ok: boolean) => void }} [hooks]
     */
    constructor(mindarThree, hooks = {}) {
        this.mindarThree = mindarThree;
        /** @type {Map<number, any>} */
        this.anchors = new Map();
        /** @type {THREE.Object3D | null} */
        this.activeMesh = null;
        /** @type {any} */
        this.activeAnchor = null;
        this.gltfLoader = new GLTFLoader();
        /** @type {Map<string, THREE.Group>} */
        this._gltfCache = new Map();
        this._swapSeq = 0;
        this.hooks = hooks;
    }

    _getAnchor(landmarkIndex) {
        let a = this.anchors.get(landmarkIndex);
        if (!a) {
            a = this.mindarThree.addAnchor(landmarkIndex);
            this.anchors.set(landmarkIndex, a);
        }
        return a;
    }

    _clearActive() {
        if (this.activeMesh) {
            if (this.activeAnchor?.group) this.activeAnchor.group.remove(this.activeMesh);
            disposeTree(this.activeMesh);
            this.activeMesh = null;
            this.activeAnchor = null;
        }
    }

    /**
     * Re-center a loaded GLTF scene at its bounding-box center AND normalise
     * it to maxDim = 1. Authors put their models wherever they want in local
     * space and at whatever scale they want; we collapse all of that so the
     * per-mask `scale` field in CONFIG means "fraction of face dimension."
     *
     * Transform order matters: in Three.js a node's matrix is T * R * S, so
     * vertex_world = position + scale * vertex_local. To center the SCALED
     * bounds at origin, position must be `-center * invDim`, NOT `-center`.
     * The previous implementation got this wrong and that's why scales
     * looked off — the mask drifted away from the anchor as you tuned size.
     */
    _normalise(root) {
        root.position.set(0, 0, 0);
        root.scale.set(1, 1, 1);
        root.rotation.set(0, 0, 0);
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        if (!box.isEmpty()) {
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const invDim = 1 / maxDim;
            root.scale.setScalar(invDim);
            root.position.set(-center.x * invDim, -center.y * invDim, -center.z * invDim);
        }
        return root;
    }

    async _loadGltf(url) {
        const cached = this._gltfCache.get(url);
        if (cached) return cached.clone(true);
        const gltf = await this.gltfLoader.loadAsync(url);
        const scene = this._normalise(gltf.scene);
        // Make sure all materials respect the env map for proper PBR shading.
        scene.traverse(o => {
            if (o.isMesh && o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach(m => { if (m && 'envMapIntensity' in m) m.envMapIntensity = 1.0; });
            }
        });
        this._gltfCache.set(url, scene);
        return scene.clone(true);
    }

    /**
     * Apply a mask by id. Safe to call repeatedly — `_swapSeq` guards against
     * a slow GLTF load clobbering a newer selection.
     */
    async applyMask(maskId) {
        const seq = ++this._swapSeq;
        this._clearActive();

        const def = CONFIG.masks.find(m => m.id === maskId);
        if (!def || def.kind === 'none') return;

        let mesh;
        const t0 = performance.now();
        try {
            this.hooks.onLoadStart?.(def);
            if (def.kind === 'gltf') {
                mesh = await this._loadGltf(def.url);
            } else if (def.kind === 'procedural') {
                const build = builders[def.builder];
                if (!build) throw new Error(`Unknown builder: ${def.builder}`);
                mesh = this._normalise(build());
            } else {
                throw new Error(`Unknown mask kind: ${def.kind}`);
            }
        } catch (e) {
            err('mask load failed:', errMsg(e));
            warn('Falling back to no mask.');
            this.hooks.onLoadEnd?.(def, false);
            return;
        }

        // A newer applyMask() call already happened — drop this one.
        if (seq !== this._swapSeq) {
            disposeTree(mesh);
            return;
        }

        // Wrap the loaded scene in an outer group so we can apply the
        // config's scale/offset/rotation without disturbing the GLTF's
        // internal transforms (which we already normalised in _loadGltf).
        const wrap = new THREE.Group();
        wrap.add(mesh);
        if (typeof def.scale === 'number') wrap.scale.setScalar(def.scale);
        if (Array.isArray(def.offset)) wrap.position.set(def.offset[0], def.offset[1], def.offset[2]);
        if (Array.isArray(def.rotation)) wrap.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);

        const anchor = this._getAnchor(def.landmark);
        anchor.group.add(wrap);
        this.activeAnchor = anchor;
        this.activeMesh = wrap;
        this.hooks.onLoadEnd?.(def, true);
        if (CONFIG.debug) {
            const ms = Math.round(performance.now() - t0);
            warn(`mask "${def.id}" loaded in ${ms} ms`);
        }
    }

    dispose() {
        this._clearActive();
        this.anchors.clear();
        // Dispose cached scenes (they were never added to the live scene
        // graph, so we just dispose materials/geometries directly).
        for (const scene of this._gltfCache.values()) disposeTree(scene);
        this._gltfCache.clear();
    }
}
