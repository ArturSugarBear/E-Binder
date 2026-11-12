import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { T, mark, word } from './rare-room-v2.mjs';
mkdirSync('public/brand', { recursive: true });
mkdirSync('public/icons', { recursive: true });
// Approved Retro-Futurism vectors are the shipping source of truth.
const finalMark = readFileSync('public/brand/rare-room-mark.svg', 'utf8');
const finalLockup = readFileSync('public/brand/rare-room-lockup.svg', 'utf8');
const recolor = (svg, colors) =>
  svg.replace(/#[0-9a-f]{6}/gi, (hex) => colors[hex.toLowerCase()] ?? hex);

for (const [variant, colors] of Object.entries({
  default: T.rare.neg,
  positive: T.rare.pos,
  mono: { ink: '#141519', acc: '#141519' },
  reversed: { ink: '#FFFFFF', acc: '#FFFFFF' },
})) {
  for (const [name, svg] of Object.entries({
    symbol: mark('rare', colors.ink, colors.acc),
    wordmark: word('rare', colors.ink, colors.acc),
    lockup:
      variant === 'default'
        ? finalLockup
        : recolor(
            finalLockup,
            variant === 'mono'
              ? { '#d8f25a': '#f4f1ea', '#b9a6ff': '#f4f1ea' }
              : variant === 'positive'
                ? {
                    '#ffffff': '#141519',
                    '#d6d2e8': '#303038',
                    '#8e829f': '#65606f',
                    '#f4f1ea': '#141519',
                    '#d8f25a': '#648100',
                    '#b9a6ff': '#6f52aa',
                  }
                : {},
          ),
  })) {
    writeFileSync(
      `public/brand/rare-room-${name}${variant === 'default' ? '' : '-' + variant}.svg`,
      svg,
    );
  }
}
writeFileSync('public/brand/rare-room-app.svg', finalMark);
for (const [name, size] of [
  ['icon-180.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
]) {
  // Maskable artwork stays inside the central 80%-diameter safe circle.
  const svg = name.includes('maskable')
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#141519"/><svg x="20" y="20" width="88" height="88" viewBox="0 0 128 128">' +
      finalMark.slice(
        finalMark.indexOf('>') + 1,
        finalMark.lastIndexOf('</svg>'),
      ) +
      '</svg></svg>'
    : finalMark;
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
