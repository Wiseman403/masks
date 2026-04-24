import * as THREE from 'three';

/**
 * Full-screen clip-space quad that samples a VideoTexture with cover-fit
 * aspect correction + optional horizontal mirror.
 *
 * We render video via this plane (at renderOrder -1000, depth-test off) instead
 * of letting MindAR's raw <video> element be visible, because the Tailwind
 * preflight reset + MindAR's own sizing fight each other and produce black bars.
 * Going through the GL pipeline gives us full control over cover-fit + mirror.
 *
 * @param {HTMLVideoElement} video
 * @param {boolean} [mirror=true]
 * @returns {{
 *   mesh: THREE.Mesh,
 *   uniforms: {uMap: any, uVideoAspect: any, uScreenAspect: any, uMirror: any},
 *   texture: THREE.VideoTexture,
 * }}
 */
export function makeVideoBackground(video, mirror = true) {
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const uniforms = {
        uMap: { value: texture },
        uVideoAspect: { value: 1 },
        uScreenAspect: { value: 1 },
        uMirror: { value: mirror ? 1 : 0 },
    };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            varying vec2 vUv;
            uniform sampler2D uMap;
            uniform float uVideoAspect;
            uniform float uScreenAspect;
            uniform float uMirror;
            void main() {
                // Cover-fit
                vec2 uv = vUv;
                float sA = uScreenAspect;
                float vA = uVideoAspect;
                if (sA > vA) {
                    // screen wider than video: scale Y
                    uv.y = (uv.y - 0.5) * (vA / sA) + 0.5;
                } else {
                    uv.x = (uv.x - 0.5) * (sA / vA) + 0.5;
                }
                if (uMirror > 0.5) uv.x = 1.0 - uv.x;
                gl_FragColor = texture2D(uMap, uv);
            }
        `,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1000;
    mesh.material.transparent = false;
    return { mesh, uniforms, texture };
}
