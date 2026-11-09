import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

/** Deterministic, dependency-free PNG icon generator for the E-Binder identity.
 * Nine card sleeves and a bound spine; original artwork, no franchise assets.
 */
const colors = {
  background: '#02070a',
  rim: '#1c3947',
  surface: '#0b1822',
  cover: '#183444',
  coverEdge: '#4c9eb1',
  page: '#07121b',
  spine: '#102833',
  ring: '#6ad0e0',
  pocket: '#23445a',
  border: '#578495',
  inset: '#102b3a',
  art: '#2f6476',
  label: '#3c798b',
  active: '#6ad0e0',
  activeMark: '#0c3040',
};

function rgb(hex) {
  return [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  );
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name, payload) {
  const kind = Buffer.from(name, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([kind, payload])));
  return Buffer.concat([length, kind, payload, checksum]);
}

function drawIcon(size, safeScale = 1) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(size * stride);
  const bg = rgb(colors.background);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const offset = y * stride + 1 + 3 * x;
      raw[offset] = bg[0];
      raw[offset + 1] = bg[1];
      raw[offset + 2] = bg[2];
    }
  }

  function rect(x1, y1, x2, y2, radius, hex, scaled = true) {
    const factor = size / 512;
    const s = scaled ? safeScale : 1;
    const transform = (n) => (256 + (n - 256) * s) * factor;
    const left = transform(x1);
    const top = transform(y1);
    const right = transform(x2);
    const bottom = transform(y2);
    const r = radius * s * factor;
    const [red, green, blue] = rgb(hex);
    for (
      let y = Math.max(0, Math.floor(top));
      y < Math.min(size, Math.ceil(bottom));
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(left));
        x < Math.min(size, Math.ceil(right));
        x++
      ) {
        const px = x + 0.5;
        const py = y + 0.5;
        const cx = Math.max(left + r, Math.min(right - r, px));
        const cy = Math.max(top + r, Math.min(bottom - r, py));
        if ((px - cx) ** 2 + (py - cy) ** 2 > r ** 2) continue;
        const at = y * stride + 1 + x * 3;
        raw[at] = red;
        raw[at + 1] = green;
        raw[at + 2] = blue;
      }
    }
  }

  rect(33, 33, 479, 479, 82, colors.rim, false);
  rect(36, 36, 476, 476, 80, colors.surface, false);
  rect(113, 87, 410, 432, 39, colors.coverEdge);
  rect(117, 91, 407, 428, 37, colors.cover);
  rect(148, 102, 406, 419, 23, colors.page);
  rect(117, 92, 157, 425, 11, colors.spine);
  for (const y of [159, 261, 363]) {
    rect(101, y - 13, 165, y + 13, 13, colors.ring);
    rect(114, y - 4, 151, y + 4, 4, colors.spine);
  }
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      const x = 174 + column * 74;
      const y = 132 + row * 93;
      rect(x, y, x + 60, y + 78, 8, colors.border);
      rect(x + 2, y + 2, x + 58, y + 76, 7, colors.pocket);
      rect(x + 6, y + 7, x + 54, y + 67, 5, colors.inset);
      if (row === 1 && column === 1) {
        rect(x + 6, y + 7, x + 54, y + 67, 5, colors.active);
        rect(x + 18, y + 24, x + 42, y + 53, 5, colors.activeMark);
      } else {
        rect(x + 12, y + 15, x + 48, y + 45, 4, colors.art);
        rect(x + 12, y + 54, x + 47, y + 58, 2, colors.label);
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2; // RGB
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size, scale] of [
  ['icon-180.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.83],
]) {
  writeFileSync('public/icons/' + name, drawIcon(size, scale));
}
