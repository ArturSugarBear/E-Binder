import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { L, T, mark, word, lockup, appIcon } from './rare-room-v2.mjs';
const html = readFileSync('public/E-Binder_Brand-Lab_v2.html', 'utf8');
const original = runInNewContext(
  html.slice(html.indexOf('const L ='), html.indexOf('function sparkle(')) +
    '\n({L,T,mark,word,lockup,appIcon})',
);
assert.equal(JSON.stringify(L.rare), JSON.stringify(original.L.rare));
assert.equal(JSON.stringify(T.rare), JSON.stringify(original.T.rare));
for (const [name, build, source] of [
  ['symbol', mark, original.mark],
  ['wordmark', word, original.word],
  ['lockup', lockup, original.lockup],
]) {
  const args =
    name === 'lockup'
      ? ['rare', 'h', T.rare.neg.ink, T.rare.neg.acc]
      : ['rare', T.rare.neg.ink, T.rare.neg.acc];
  assert.equal(build(...args), source(...args));
  assert.equal(
    readFileSync(`public/brand/rare-room-${name}.svg`, 'utf8'),
    source(...args),
  );
}
assert.equal(appIcon('rare'), original.appIcon('rare'));
console.log(
  'Rare Room V2 paths, configuration, SVG outputs and icon match authoritative HTML exactly.',
);
