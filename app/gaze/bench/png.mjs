// Minimal PNG writer. Node's zlib is built in, so the corpus needs no
// image dependency and no ffmpeg spawn per crop -- 1800 spawns is
// minutes, this is milliseconds.
import zlib from 'zlib';

const T = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t; })();
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** rgb: Buffer of w*h*3 */
export function encodePNG(rgb, w, h) {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;                       // filter: none
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
/** Read a P6 PPM written by corpus-bank. */
export function readPPM(buf) {
  let p = 0; const tok = () => { while (buf[p] === 32 || buf[p] === 10 || buf[p] === 13 || buf[p] === 9) p++;
    const s = p; while (p < buf.length && ![32, 10, 13, 9].includes(buf[p])) p++; return buf.slice(s, p).toString(); };
  if (tok() !== 'P6') throw new Error('not P6');
  const w = +tok(), h = +tok(); tok(); p++;
  return { w, h, rgb: buf.slice(p, p + w * h * 3) };
}
