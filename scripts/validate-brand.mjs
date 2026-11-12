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
const approvedMark = readFileSync('public/brand/rare-room-mark.svg', 'utf8');
const approvedLockup = readFileSync('public/brand/rare-room-lockup.svg', 'utf8');
assert.ok(approvedMark.includes('viewBox="0 0 128 128"'));
assert.ok(approvedLockup.includes('Rare Room — E-Binder'));
assert.ok(approvedLockup.includes('E-BINDER'));
assert.ok(!/<script|<foreignObject|<image|onload=/i.test(approvedMark));
console.log(
  'Rare Room legacy source and approved Retro-Futurism masters validated.',
);
