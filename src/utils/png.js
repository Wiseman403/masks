/**
 * PNG metadata injection — inserts tEXt chunks (key\0value) before IEND.
 * Used by CaptureEngine to stamp software, timestamp, mask id, intensity,
 * and mode into captured photos so the context isn't lost when shared.
 *
 * @param {ArrayBuffer} arrayBuffer Raw PNG bytes.
 * @param {Array<[string, string]>} entries Array of [key, value] pairs.
 * @returns {Uint8Array} PNG bytes with tEXt chunks inserted, or original bytes on error.
 */
export function injectPngTextChunks(arrayBuffer, entries) {
    try {
        const bytes = new Uint8Array(arrayBuffer);
        // PNG signature 8 bytes
        if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return bytes;
        // Locate IEND chunk start. Chunks: 4 length + 4 type + data + 4 CRC.
        let offset = 8;
        let iendStart = -1;
        while (offset + 8 <= bytes.length) {
            const len = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
            const t0 = bytes[offset + 4], t1 = bytes[offset + 5], t2 = bytes[offset + 6], t3 = bytes[offset + 7];
            const type = String.fromCharCode(t0, t1, t2, t3);
            if (type === 'IEND') { iendStart = offset; break; }
            offset += 8 + len + 4;
        }
        if (iendStart < 0) return bytes;

        // CRC-32 (PNG uses IEEE polynomial).
        const crcTable = (() => {
            const t = new Uint32Array(256);
            for (let n = 0; n < 256; n++) {
                let c = n;
                for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
                t[n] = c >>> 0;
            }
            return t;
        })();
        const crc32 = (buf) => {
            let c = 0xffffffff;
            for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
            return (c ^ 0xffffffff) >>> 0;
        };

        const chunks = [];
        for (const [k, v] of entries) {
            const key = String(k).slice(0, 79);
            const val = String(v);
            const data = new Uint8Array(key.length + 1 + val.length);
            for (let i = 0; i < key.length; i++) data[i] = key.charCodeAt(i) & 0xff;
            data[key.length] = 0;
            for (let i = 0; i < val.length; i++) data[key.length + 1 + i] = val.charCodeAt(i) & 0xff;
            const typeAndData = new Uint8Array(4 + data.length);
            typeAndData.set([0x74, 0x45, 0x58, 0x74], 0); // 'tEXt'
            typeAndData.set(data, 4);
            const crc = crc32(typeAndData);
            const chunk = new Uint8Array(4 + typeAndData.length + 4);
            const dv = new DataView(chunk.buffer);
            dv.setUint32(0, data.length);
            chunk.set(typeAndData, 4);
            dv.setUint32(4 + typeAndData.length, crc);
            chunks.push(chunk);
        }
        const total = chunks.reduce((a, c) => a + c.length, 0);
        const out = new Uint8Array(bytes.length + total);
        out.set(bytes.subarray(0, iendStart), 0);
        let pos = iendStart;
        for (const c of chunks) { out.set(c, pos); pos += c.length; }
        out.set(bytes.subarray(iendStart), pos);
        return out;
    } catch (_) {
        return new Uint8Array(arrayBuffer);
    }
}
