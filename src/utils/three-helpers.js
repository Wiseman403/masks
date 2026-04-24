/**
 * Three.js-specific helpers: safe disposal of an Object3D tree.
 */

/**
 * Recursive dispose of a THREE object tree.
 *   - Materials are deduped via a Set so shared materials are disposed exactly
 *     once per tree.
 *   - Textures on material props AND ShaderMaterial uniforms are released.
 *   - InstancedMesh instance buffers are released explicitly.
 *
 * @param {import('three').Object3D | null} obj
 */
export function disposeTree(obj) {
    if (!obj) return;
    const seenMat = new Set();
    const seenGeo = new Set();
    obj.traverse(node => {
        if (node.geometry && !seenGeo.has(node.geometry)) {
            seenGeo.add(node.geometry);
            try { node.geometry.dispose(); } catch (_) { }
        }
        if (node.isInstancedMesh) {
            try { node.instanceMatrix?.dispose?.(); } catch (_) { }
            try { node.instanceColor?.dispose?.(); } catch (_) { }
        }
        if (node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(m => {
                if (!m || seenMat.has(m)) return;
                seenMat.add(m);
                for (const k in m) {
                    const v = m[k];
                    if (v && v.isTexture) { try { v.dispose(); } catch (_) { } }
                }
                if (m.uniforms) {
                    for (const uk in m.uniforms) {
                        const uv = m.uniforms[uk] && m.uniforms[uk].value;
                        if (uv && uv.isTexture) { try { uv.dispose(); } catch (_) { } }
                    }
                }
                try { m.dispose(); } catch (_) { }
            });
        }
    });
    if (obj.parent) obj.parent.remove(obj);
}
