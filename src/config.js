/**
 * CONFIG — every tunable number in the app.
 *
 * MASK MANIFEST
 * ─────────────
 * Two kinds of masks:
 *   - `kind: 'procedural'` — built from THREE primitives in maskBuilders.js
 *     (used where a CDN GLTF rendered invisibly or was unreliable)
 *   - `kind: 'gltf'` — fetched from a CDN at runtime, normalised, attached
 *     to a face landmark
 *
 * Common MediaPipe face-mesh landmark indices:
 *   1   — nose tip
 *   6   — between the eyes (nasion)
 *   10  — upper forehead             ← good for headwear
 *   152 — chin
 *   168 — mid-face (below the eyes)  ← canonical anchor for face/head masks
 *
 * Per-mask transform fields:
 *   `landmark` — face-mesh vertex index above
 *   `scale`    — applied AFTER MaskEngine._normalise() shrinks the model to
 *                maxDim = 1. Empirically, MindAR's anchor space needs much
 *                larger numbers than naive face-width math suggests:
 *                   sunglasses     ~1.2
 *                   face-cover     ~3.0
 *                   head-cover     ~4.0
 *                   hat (vertical) ~3.0
 *   `offset`   — local translation [x, y, z] applied AFTER scale
 *   `rotation` — local Euler [x, y, z] in radians
 *   `credit`   — attribution string for CC-BY assets (toast on load)
 */
export const CONFIG = Object.freeze({
    debug: false,
    app: {
        boot: {
            stages: [
                { msg: 'STARTING',   minDuration: 180 },
                { msg: 'LOADING AR', minDuration: 220 },
                { msg: 'READY',      minDuration: 140 },
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
        {
            id: 'none',
            name: 'No Mask',
            kind: 'none',
        },
        {
            id: 'sunglasses',
            name: 'Sunglasses',
            kind: 'procedural',
            builder: 'sunglasses',
            landmark: 168,
            scale: 1.2,
            offset: [0, 0.55, 0.15],
            rotation: [0, 0, 0],
        },
        {
            id: 'cat',
            name: 'Cat Ears',
            kind: 'procedural',
            builder: 'cat',
            landmark: 10,
            scale: 1.6,
            offset: [0, 0.8, 0.0],
            rotation: [0, 0, 0],
        },
        {
            id: 'helmet',
            name: 'Sci-Fi Helmet',
            kind: 'gltf',
            url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
            landmark: 168,
            scale: 4.0,
            offset: [0, 0.4, 0.0],
            rotation: [0, 0, 0],
            credit: '"Battle Damaged Sci-Fi Helmet" by theblueturtle_ (CC-BY-4.0)',
        },
        {
            id: 'skull',
            name: 'Skull',
            kind: 'gltf',
            url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ScatteringSkull/glTF-Binary/ScatteringSkull.glb',
            landmark: 168,
            scale: 3.5,
            offset: [0, 0.3, 0.0],
            rotation: [0, 0, 0],
            credit: '"Scattering Skull" — Khronos sample (CC0-1.0)',
        },
        {
            id: 'hat',
            name: 'Clown Hat',
            kind: 'gltf',
            url: 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@master/examples/face-tracking/assets/hat/scene.gltf',
            landmark: 10,
            scale: 3.0,
            offset: [0, 1.6, 0.0],
            rotation: [0, 0, 0],
            credit: '"Clown Hat" by PatelDev (CC-BY-4.0)',
        },
    ],
});
