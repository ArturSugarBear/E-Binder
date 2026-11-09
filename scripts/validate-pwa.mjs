import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

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
assert.equal(manifest.background_color, '#02070a');
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
const apple = await stat(root + 'icons/icon-180.png');
assert.ok(apple.size > 100);
console.log('PWA validation passed: manifest, both entry points, icons, worker and base paths.');
