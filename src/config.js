/**
 * CONFIG — every tunable number in the app.
 *
 * The mask manifest is the heart of this file. Each entry describes a 3D
 * mask that attaches to a MediaPipe face-mesh landmark via MindAR's anchor
 * API. Masks are either:
 *   - `kind: 'procedural'` → built from Three.js primitives in maskBuilders.js
 *   - `kind: 'gltf'`       → loaded from a .glb/.gltf URL via GLTFLoader
 *   - `kind: 'none'`       → no mask (bare camera feed)
 *
 * Common MediaPipe face-mesh landmark indices (useful when adding masks):
 *   1   — nose tip
 *   6   — between the eyes (nasion)  ← best for glasses / eye masks
 *   10  — upper forehead             ← best for headwear / ears
 *   152 — chin
 *   168 — mid-face (below the eyes)  ← best for full-face coverage
 */
export const CONFIG = Object.freeze({
    debug: false,
    app: {
        boot: {
            stages: [
                { msg: 'STARTING', minDuration: 180 },
                { msg: 'LOADING AR', minDuration: 220 },
                { msg: 'READY', minDuration: 140 },
            ],
        },
        faceLostGraceMs: 2000,
    },
    capture: {
        maxVideoDurationMs: 60_000,
        videoFps: 30,
        videoBitsPerSecond: 4_500_000,
    },
    performance: {
        pixelRatioCap: 2,
    },
    masks: [
        { id: 'none',       name: 'No Mask',     kind: 'none' },
        { id: 'sunglasses', name: 'Sunglasses',  kind: 'procedural', builder: 'sunglasses', landmark: 6,   scale: 0.55, offset: [0, -0.02, 0.06] },
        { id: 'cat',        name: 'Cat Ears',    kind: 'procedural', builder: 'cat',        landmark: 10,  scale: 0.5,  offset: [0,  0.25, 0.00] },
        { id: 'bunny',      name: 'Bunny Ears',  kind: 'procedural', builder: 'bunny',      landmark: 10,  scale: 0.5,  offset: [0,  0.32, 0.00] },
        { id: 'fox',        name: 'Fox Mask',    kind: 'procedural', builder: 'fox',        landmark: 6,   scale: 0.55, offset: [0,  0.02, 0.05] },
        { id: 'skull',      name: 'Skull',       kind: 'procedural', builder: 'skull',      landmark: 168, scale: 0.50, offset: [0,  0.05, 0.02] },
        { id: 'visor',      name: 'Cyber Visor', kind: 'procedural', builder: 'visor',      landmark: 6,   scale: 0.55, offset: [0, -0.01, 0.08] },
    ],
});
