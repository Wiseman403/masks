import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { CONFIG } from '../config.js';
import { warn, err } from '../utils/logger.js';
import { errMsg } from '../utils/errors.js';
import { disposeTree } from '../utils/three-helpers.js';
import { builders } from './maskBuilders.js';

/**
 * MaskEngine — attaches a 3D mask to a MindAR face-mesh landmark.
 *
 * Lifecycle per mask swap:
 *   1. Remove + dispose the previously active mesh.
 *   2. Build the new mesh (procedural factory or GLTFLoader).
 *   3. Look up (or create) the anchor group for the target landmark.
 *   4. Add the mesh to the anchor.
 *
 * Anchor groups are cached by landmark index — swapping between masks that
 * share a landmark (e.g. two eye-level masks) doesn't re-create the anchor,
 * so MindAR keeps a stable tracking reference.
 */
export class MaskEngine {
    /**
     * @param {*} mindarThree — the MindARThree instance from AREngine
     */
    constructor(mindarThree) {
        this.mindarThree = mindarThree;
        /** @type {Map<number, any>} */
        this.anchors = new Map();
        /** @type {THREE.Object3D | null} */
        this.activeMesh = null;
        /** @type {any} */
        this.activeAnchor = null;
        this.gltfLoader = new GLTFLoader();
        /** Incremented on each swap; stale async loads check this before attaching. */
        this._swapSeq = 0;
    }

    /** Ensure an anchor exists for the given landmark index; return it. */
    _getAnchor(landmarkIndex) {
        let a = this.anchors.get(landmarkIndex);
        if (!a) {
            a = this.mindarThree.addAnchor(landmarkIndex);
            this.anchors.set(landmarkIndex, a);
        }
        return a;
    }

    /** Remove + dispose the currently mounted mesh (if any). */
    _clearActive() {
        if (this.activeMesh) {
            if (this.activeAnchor?.group) this.activeAnchor.group.remove(this.activeMesh);
            disposeTree(this.activeMesh);
            this.activeMesh = null;
            this.activeAnchor = null;
        }
    }

    /**
     * Apply a mask by id. Finds the config entry, builds the mesh, attaches.
     * Safe to call repeatedly — the swap sequence guards against late-resolving
     * GLTF loads clobbering a newer selection.
     *
     * @param {string} maskId
     */
    async applyMask(maskId) {
        const seq = ++this._swapSeq;
        this._clearActive();

        const def = CONFIG.masks.find(m => m.id === maskId);
        if (!def || def.kind === 'none') return;

        let mesh;
        try {
            if (def.kind === 'procedural') {
                const build = builders[def.builder];
                if (!build) throw new Error(`Unknown builder: ${def.builder}`);
                mesh = build();
            } else if (def.kind === 'gltf') {
                const gltf = await this.gltfLoader.loadAsync(def.url);
                mesh = gltf.scene;
            } else {
                throw new Error(`Unknown mask kind: ${def.kind}`);
            }
        } catch (e) {
            err('mask build failed:', errMsg(e));
            warn('Falling back to no mask.');
            return;
        }

        // A newer applyMask() call already happened — drop this one.
        if (seq !== this._swapSeq) {
            disposeTree(mesh);
            return;
        }

        if (typeof def.scale === 'number') mesh.scale.setScalar(def.scale);
        if (Array.isArray(def.offset)) mesh.position.set(def.offset[0], def.offset[1], def.offset[2]);

        const anchor = this._getAnchor(def.landmark);
        anchor.group.add(mesh);
        this.activeAnchor = anchor;
        this.activeMesh = mesh;
    }

    dispose() {
        this._clearActive();
        this.anchors.clear();
    }
}
