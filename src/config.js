/**
 * CONFIG — every tunable number in the app.
 *
 * The mask manifest is the heart of this file. Each entry is a GLTF/GLB
 * model fetched from a CDN at runtime and attached to a MediaPipe
 * face-mesh landmark via MindAR's anchor API.
 *
 * Common MediaPipe face-mesh landmark indices (useful when adding masks):
 *   1   — nose tip
 *   6   — between the eyes (nasion)  ← best for glasses / eye masks
 *   10  — upper forehead             ← best for headwear / hats
 *   152 — chin
 *   168 — mid-face (below the eyes)  ← best for full-face coverage / helmets
 *
 * Every GLTF entry includes:
 *   url       — direct cross-origin URL (CORS open)
 *   landmark  — anchor index above
 *   scale     — multiplier on the model's authored size
 *   offset    — local translation [x, y, z] applied AFTER scale
 *   rotation  — local Euler rotation [x, y, z] in radians
 *   credit    — attribution string for CC-BY assets (shown in UI)
 *
 * All seven assets verified live on jsdelivr with `access-control-allow-origin: *`.
 */
export const CONFIG = Object.freeze({
    debug: false,
    app: {
        boot: {
            stages: [
                { msg: 'STARTING',     minDuration: 180 },
                { msg: 'LOADING AR',   minDuration: 220 },
                { msg: 'READY',        minDuration: 140 },
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
            kind: 'gltf',
            url: 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@master/examples/face-tracking/assets/glasses/scene.gltf',
            landmark: 6,
            scale: 0.55,
            offset: [0, -0.02, 0.06],
            rotation: [0, 0, 0],
            credit: '"Thug-Life Glasses" by MR EXPERT (CC-BY-4.0)',
        },
        {
            id: 'helmet',
            name: 'Sci-Fi Helmet',
            kind: 'gltf',
            url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
            landmark: 168,
            scale: 0.7,
            offset: [0, 0.08, 0.0],
            rotation: [0, 0, 0],
            credit: '"Battle Damaged Sci-Fi Helmet" by theblueturtle_ (CC-BY-4.0)',
        },
        {
            id: 'skull',
            name: 'Skull',
            kind: 'gltf',
            url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ScatteringSkull/glTF-Binary/ScatteringSkull.glb',
            landmark: 168,
            scale: 0.45,
            offset: [0, 0.06, 0.0],
            rotation: [0, 0, 0],
            credit: '"Scattering Skull" — Khronos sample (CC0-1.0)',
        },
        {
            id: 'face',
            name: 'Face Replace',
            kind: 'gltf',
            url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb',
            landmark: 168,
            scale: 0.45,
            offset: [0, 0.04, 0.05],
            rotation: [0, 0, 0],
            credit: '"Lee Perry-Smith" head scan / Infinite Realities (CC-BY-3.0)',
        },
        {
            id: 'facecap',
            name: 'Animated Face',
            kind: 'gltf',
            url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/facecap.glb',
            landmark: 168,
            scale: 0.6,
            offset: [0, 0.0, 0.05],
            rotation: [0, 0, 0],
            credit: '"Face Cap" by Bannaflak (CC-BY-4.0)',
        },
        {
            id: 'hat',
            name: 'Clown Hat',
            kind: 'gltf',
            url: 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@master/examples/face-tracking/assets/hat/scene.gltf',
            landmark: 10,
            scale: 0.6,
            offset: [0, 0.32, 0.0],
            rotation: [0, 0, 0],
            credit: '"Clown Hat" by PatelDev (CC-BY-4.0)',
        },
    ],
});
