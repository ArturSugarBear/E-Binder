import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { T, mark, word, lockup, appIcon } from './rare-room-v2.mjs';
mkdirSync('public/brand', { recursive: true });
mkdirSync('public/icons', { recursive: true });
for (const [variant, colors] of Object.entries({
  default: T.rare.neg,
  positive: T.rare.pos,
  mono: { ink: '#141519', acc: '#141519' },
  reversed: { ink: '#FFFFFF', acc: '#FFFFFF' },
})) {
  for (const [name, svg] of Object.entries({
    symbol: mark('rare', colors.ink, colors.acc),
    wordmark: word('rare', colors.ink, colors.acc),
    lockup: lockup('rare', 'h', colors.ink, colors.acc),
  })) {
    writeFileSync(
      `public/brand/rare-room-${name}${variant === 'default' ? '' : '-' + variant}.svg`,
      svg,
    );
  }
}
writeFileSync('public/brand/rare-room-app.svg', appIcon('rare'));
for (const [name, size] of [
  ['icon-180.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
]) {
  // Maskable artwork stays inside the central 80%-diameter safe circle.
  const svg = name.includes('maskable')
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="translate(5 5) scale(.9)">${appIcon('rare', '', 100)}</g></svg>`
    : appIcon('rare', '', size);
  writeFileSync(
    'public/icons/' + name,
    new Resvg(svg, {
      background: '#141519',
      fitTo: { mode: 'width', value: size },
    })
      .render()
      .asPng(),
  );
}
