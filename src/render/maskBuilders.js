import * as THREE from 'three';

/**
 * Procedural mask builders — used as a fallback / supplement to GLTF
 * assets where a reliable, lightweight mesh is preferable to a CDN
 * fetch (e.g. small accessory items where a CDN model rendered invisibly
 * or is overkill).
 *
 * Each builder returns a THREE.Group centered at the origin, sized so
 * that the dominant dimension is roughly 1 unit. The MaskEngine still
 * runs _normalise() on the result to guarantee maxDim = 1 before
 * applying the per-mask config scale/offset/rotation.
 */

/** Aviator-style sunglasses: two tinted lens discs + bridge + arms. */
function buildSunglasses() {
    const g = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x111111, metalness: 0.85, roughness: 0.25,
    });
    const lensMat = new THREE.MeshPhysicalMaterial({
        color: 0x080812, metalness: 0.4, roughness: 0.15,
        transmission: 0.15, transparent: true, opacity: 0.85,
        ior: 1.45,
    });

    // Lens rims (rings).
    const rimGeo = new THREE.TorusGeometry(0.34, 0.025, 12, 48);
    const rimL = new THREE.Mesh(rimGeo, frameMat);
    const rimR = new THREE.Mesh(rimGeo, frameMat);
    rimL.position.set(-0.40, 0, 0);
    rimR.position.set( 0.40, 0, 0);
    g.add(rimL, rimR);

    // Lens glass (filled discs slightly behind the rims).
    const lensGeo = new THREE.CircleGeometry(0.34, 48);
    const lensL = new THREE.Mesh(lensGeo, lensMat);
    const lensR = new THREE.Mesh(lensGeo, lensMat.clone());
    lensL.position.set(-0.40, 0, -0.005);
    lensR.position.set( 0.40, 0, -0.005);
    g.add(lensL, lensR);

    // Bridge between lenses.
    const bridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.14, 16),
        frameMat,
    );
    bridge.rotation.z = Math.PI / 2;
    g.add(bridge);

    // Arms — extend from the outer edge back along -Z toward the ears.
    const armGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.65, 16);
    const armL = new THREE.Mesh(armGeo, frameMat);
    const armR = new THREE.Mesh(armGeo, frameMat);
    armL.rotation.x = Math.PI / 2;
    armR.rotation.x = Math.PI / 2;
    armL.position.set(-0.74, 0, -0.30);
    armR.position.set( 0.74, 0, -0.30);
    g.add(armL, armR);

    return g;
}

/** Two cat ears with pink inner lining. */
function buildCatEars() {
    const g = new THREE.Group();

    const outer = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85 });
    const inner = new THREE.MeshStandardMaterial({ color: 0xff80a0, roughness: 0.6, side: THREE.DoubleSide });

    const earGeo   = new THREE.ConeGeometry(0.30, 0.55, 4);
    earGeo.rotateY(Math.PI / 4);
    const innerGeo = new THREE.ConeGeometry(0.20, 0.40, 4);
    innerGeo.rotateY(Math.PI / 4);

    const earL = new THREE.Mesh(earGeo, outer);
    const earR = new THREE.Mesh(earGeo, outer);
    earL.position.set(-0.40, 0, 0);
    earR.position.set( 0.40, 0, 0);
    earL.rotation.z =  0.20;
    earR.rotation.z = -0.20;
    g.add(earL, earR);

    const innerL = new THREE.Mesh(innerGeo, inner);
    const innerR = new THREE.Mesh(innerGeo, inner);
    innerL.position.set(-0.40, -0.05, 0.025);
    innerR.position.set( 0.40, -0.05, 0.025);
    innerL.rotation.z =  0.20;
    innerR.rotation.z = -0.20;
    g.add(innerL, innerR);

    return g;
}

export const builders = {
    sunglasses: buildSunglasses,
    cat:        buildCatEars,
};
