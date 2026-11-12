import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const base = process.env.VITE_BASE_PATH || '/E-Binder/';
const root = 'dist/';
const file = (name) => readFile(root + name, 'utf8');

const [manifest, main, archive, worker] = await Promise.all([
  file('manifest.webmanifest').then(JSON.parse),
  file('index.html'),
  file('archive.html'),
  file('sw.js'),
]);
assert.equal(manifest.start_url, base);
assert.equal(manifest.scope, base);
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.background_color, '#141519');
assert.ok(main.includes(base + 'manifest.webmanifest'));
assert.ok(main.includes(base + 'icons/icon-180.png'));
assert.ok(archive.includes(base + 'icons/icon-180.png'));
assert.ok(!main.includes('href="/src/'));
assert.ok(!archive.includes('href="/src/'));
assert.ok(worker.includes('e-binder-public-catalog'));
assert.ok(!worker.includes('auth/v1'));
for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith(base + 'icons/'));
  const name = icon.src.slice(base.length);
  const bytes = await readFile(root + name);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
}
const master = await readFile('public/brand/rare-room-mark.svg', 'utf8');
for (const [name, size] of [
  ['icon-180.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
]) {
  const data = await readFile(root + 'icons/' + name);
  assert.equal(data.readUInt32BE(16), size, name + ' width');
  assert.equal(data.readUInt32BE(20), size, name + ' height');
  if (!name.includes('maskable')) {
    assert.deepEqual(
      data,
      new Resvg(master, {
        background: '#141519',
        fitTo: { mode: 'width', value: size },
      })
        .render()
        .asPng(),
      name + ' must derive from final SVG',
    );
  }
}
assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
assert.ok(main.includes(base + 'brand/rare-room-mark.svg'));
const apple = await stat(root + 'icons/icon-180.png');
assert.ok(apple.size > 100);
console.log(
  'PWA validation passed: manifest, both entry points, icons, worker and base paths.',
);
