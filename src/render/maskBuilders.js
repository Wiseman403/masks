import * as THREE from 'three';

/**
 * Procedural 3D mask builders.
 *
 * Each builder returns a THREE.Group centered at the origin, facing +Z, sized
 * so that roughly 1 unit covers a typical face width. The MaskEngine applies
 * the per-mask scale/offset from the config when attaching to a landmark.
 *
 * All geometries/materials are owned by the returned Group — dispose via
 * `disposeTree(group)` from utils/three-helpers.
 */

function cloneMaterialPerMesh(group) {
    // MaskEngine's disposeTree will dispose each material once; nothing to do.
    return group;
}

/** A pair of round lenses + bridge + arm stubs. */
function buildSunglasses() {
    const g = new THREE.Group();
    const lensMat = new THREE.MeshPhysicalMaterial({
        color: 0x0a0a12, metalness: 0.2, roughness: 0.1,
        transmission: 0.0, transparent: true, opacity: 0.82,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.25 });

    const lensGeo = new THREE.RingGeometry(0.14, 0.20, 48);
    const lensL = new THREE.Mesh(lensGeo, lensMat);
    const lensR = new THREE.Mesh(lensGeo, lensMat);
    lensL.position.set(-0.22, 0, 0);
    lensR.position.set( 0.22, 0, 0);
    g.add(lensL, lensR);

    // Solid dark disc behind each ring (gives the "lens glass" feel).
    const discGeo = new THREE.CircleGeometry(0.18, 48);
    const discL = new THREE.Mesh(discGeo, lensMat.clone());
    const discR = new THREE.Mesh(discGeo, lensMat.clone());
    discL.position.copy(lensL.position); discL.position.z = -0.002;
    discR.position.copy(lensR.position); discR.position.z = -0.002;
    g.add(discL, discR);

    // Bridge
    const bridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12),
        frameMat,
    );
    bridge.rotation.z = Math.PI / 2;
    g.add(bridge);

    // Arms (short stubs extending back)
    const armGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.30, 12);
    const armL = new THREE.Mesh(armGeo, frameMat);
    const armR = new THREE.Mesh(armGeo, frameMat);
    armL.rotation.x = Math.PI / 2;
    armR.rotation.x = Math.PI / 2;
    armL.position.set(-0.38, 0, -0.12);
    armR.position.set( 0.38, 0, -0.12);
    g.add(armL, armR);

    return cloneMaterialPerMesh(g);
}

/** Two triangular cat ears sitting on top of the head. */
function buildCatEars() {
    const g = new THREE.Group();
    const outer = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.0 });
    const inner = new THREE.MeshStandardMaterial({ color: 0xff6b9d, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide });

    const earGeo = new THREE.ConeGeometry(0.16, 0.30, 3);
    earGeo.rotateY(Math.PI / 2);
    const innerGeo = new THREE.ConeGeometry(0.10, 0.22, 3);
    innerGeo.rotateY(Math.PI / 2);

    const earL = new THREE.Mesh(earGeo, outer);
    const earR = new THREE.Mesh(earGeo, outer);
    earL.position.set(-0.22, 0, 0);
    earR.position.set( 0.22, 0, 0);
    earL.rotation.z =  0.22;
    earR.rotation.z = -0.22;
    g.add(earL, earR);

    const innerL = new THREE.Mesh(innerGeo, inner);
    const innerR = new THREE.Mesh(innerGeo, inner);
    innerL.position.set(-0.22, -0.02, 0.01);
    innerR.position.set( 0.22, -0.02, 0.01);
    innerL.rotation.z =  0.22;
    innerR.rotation.z = -0.22;
    g.add(innerL, innerR);

    return cloneMaterialPerMesh(g);
}

/** Tall bunny ears with pink inner. */
function buildBunnyEars() {
    const g = new THREE.Group();
    const outer = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.85, metalness: 0.0 });
    const inner = new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide });

    // Use CapsuleGeometry for rounded bunny-ear shape.
    const earGeo = new THREE.CapsuleGeometry(0.06, 0.36, 8, 16);
    const innerGeo = new THREE.CapsuleGeometry(0.035, 0.30, 8, 16);

    const earL = new THREE.Mesh(earGeo, outer);
    const earR = new THREE.Mesh(earGeo, outer);
    earL.position.set(-0.14, 0, 0);
    earR.position.set( 0.14, 0, 0);
    earL.rotation.z =  0.12;
    earR.rotation.z = -0.12;
    g.add(earL, earR);

    const innerL = new THREE.Mesh(innerGeo, inner);
    const innerR = new THREE.Mesh(innerGeo, inner);
    innerL.position.set(-0.14, 0.02, 0.04);
    innerR.position.set( 0.14, 0.02, 0.04);
    innerL.rotation.z =  0.12;
    innerR.rotation.z = -0.12;
    g.add(innerL, innerR);

    return cloneMaterialPerMesh(g);
}

/** Orange fox "domino" mask covering the eyes, with small pointed ears. */
function buildFoxMask() {
    const g = new THREE.Group();
    const orange = new THREE.MeshStandardMaterial({ color: 0xd8521a, roughness: 0.6, metalness: 0.05 });
    const white  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.0 });
    const black  = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4, metalness: 0.1 });

    // Upper mask shape — a rounded shield across the eyes.
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(-0.42, -0.08);
    shieldShape.bezierCurveTo(-0.52,  0.10, -0.30,  0.22,  0.00,  0.18);
    shieldShape.bezierCurveTo( 0.30,  0.22,  0.52,  0.10,  0.42, -0.08);
    shieldShape.bezierCurveTo( 0.28, -0.20,  0.10, -0.14,  0.00, -0.14);
    shieldShape.bezierCurveTo(-0.10, -0.14, -0.28, -0.20, -0.42, -0.08);
    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
    const shield = new THREE.Mesh(shieldGeo, orange);
    g.add(shield);

    // Eye cut-outs — white holes.
    const eyeGeo = new THREE.CircleGeometry(0.07, 24);
    const eyeL = new THREE.Mesh(eyeGeo, white);
    const eyeR = new THREE.Mesh(eyeGeo, white);
    eyeL.position.set(-0.17, 0.01, 0.045);
    eyeR.position.set( 0.17, 0.01, 0.045);
    g.add(eyeL, eyeR);

    // Small triangular pupils to give presence.
    const pupilGeo = new THREE.CircleGeometry(0.025, 16);
    const pupilL = new THREE.Mesh(pupilGeo, black);
    const pupilR = new THREE.Mesh(pupilGeo, black);
    pupilL.position.set(-0.17, 0.01, 0.046);
    pupilR.position.set( 0.17, 0.01, 0.046);
    g.add(pupilL, pupilR);

    // Ears (small pointed, above the mask).
    const earGeo = new THREE.ConeGeometry(0.07, 0.14, 3);
    earGeo.rotateY(Math.PI / 2);
    const earL = new THREE.Mesh(earGeo, orange);
    const earR = new THREE.Mesh(earGeo, orange);
    earL.position.set(-0.28, 0.26, 0);
    earR.position.set( 0.28, 0.26, 0);
    earL.rotation.z =  0.15;
    earR.rotation.z = -0.15;
    g.add(earL, earR);

    return cloneMaterialPerMesh(g);
}

/** A stylised skull mask covering the face. */
function buildSkull() {
    const g = new THREE.Group();
    const bone   = new THREE.MeshStandardMaterial({ color: 0xe8e4d6, roughness: 0.75, metalness: 0.05 });
    const socket = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9, metalness: 0.0 });

    // Cranium — flattened sphere.
    const cranGeo = new THREE.SphereGeometry(0.32, 32, 32);
    cranGeo.scale(1.0, 1.05, 0.85);
    const cran = new THREE.Mesh(cranGeo, bone);
    g.add(cran);

    // Eye sockets — deep set, tinted black.
    const eyeGeo = new THREE.SphereGeometry(0.09, 24, 24);
    eyeGeo.scale(1.0, 0.8, 0.6);
    const eyeL = new THREE.Mesh(eyeGeo, socket);
    const eyeR = new THREE.Mesh(eyeGeo, socket);
    eyeL.position.set(-0.12,  0.04, 0.22);
    eyeR.position.set( 0.12,  0.04, 0.22);
    g.add(eyeL, eyeR);

    // Nasal cavity — small inverted triangle.
    const nasalGeo = new THREE.ConeGeometry(0.035, 0.08, 3);
    const nasal = new THREE.Mesh(nasalGeo, socket);
    nasal.position.set(0, -0.04, 0.27);
    nasal.rotation.x = Math.PI;
    g.add(nasal);

    // Teeth — a row of little boxes across the jaw.
    const toothGeo = new THREE.BoxGeometry(0.022, 0.04, 0.02);
    for (let i = -5; i <= 5; i++) {
        const t = new THREE.Mesh(toothGeo, bone);
        t.position.set(i * 0.026, -0.18, 0.24);
        g.add(t);
    }

    // Jawline — a thin curved slab under the teeth.
    const jawGeo = new THREE.TorusGeometry(0.18, 0.02, 8, 24, Math.PI);
    const jaw = new THREE.Mesh(jawGeo, bone);
    jaw.position.set(0, -0.22, 0.2);
    jaw.rotation.z = Math.PI;
    g.add(jaw);

    return cloneMaterialPerMesh(g);
}

/** A glowing cyberpunk visor — flat strip across the eyes. */
function buildVisor() {
    const g = new THREE.Group();

    // Emissive panel — the glowing strip.
    const panelGeo = new THREE.BoxGeometry(0.8, 0.12, 0.02);
    // Soften edges with bevel-ish by beveling the box corners via RoundedBox if available.
    const panelMat = new THREE.MeshStandardMaterial({
        color: 0x00141a,
        emissive: 0x00f0ff,
        emissiveIntensity: 1.2,
        metalness: 0.6,
        roughness: 0.3,
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    g.add(panel);

    // Rim — darker surround giving depth.
    const rimGeo = new THREE.BoxGeometry(0.86, 0.16, 0.02);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.9, roughness: 0.3 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.z = -0.005;
    g.add(rim);

    // Side arms wrapping toward temples.
    const armGeo = new THREE.BoxGeometry(0.14, 0.12, 0.02);
    const armL = new THREE.Mesh(armGeo, rimMat);
    const armR = new THREE.Mesh(armGeo, rimMat);
    armL.position.set(-0.48, 0, -0.04);
    armR.position.set( 0.48, 0, -0.04);
    armL.rotation.y =  0.5;
    armR.rotation.y = -0.5;
    g.add(armL, armR);

    return cloneMaterialPerMesh(g);
}

export const builders = {
    sunglasses: buildSunglasses,
    cat:        buildCatEars,
    bunny:      buildBunnyEars,
    fox:        buildFoxMask,
    skull:      buildSkull,
    visor:      buildVisor,
};
