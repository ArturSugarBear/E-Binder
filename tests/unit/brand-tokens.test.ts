import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const kit = JSON.parse(readFileSync('brand/tokens.json', 'utf8')) as {
  status: string;
  concepts: Record<string, {
    color: Record<string,string>;
    type: {display: string; body: string};
  }>;
};

function luminance(hex: string): number {
  expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  const c = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
}
function ratio(a: string, b: string): number {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright! + 0.05) / (dark! + 0.05);
}
describe('Lovebrand kit proposals', () => {
  it('contains three complete but non-live identities', () => {
    expect(kit.status).toBe('candidate-not-live');
    expect(Object.keys(kit.concepts)).toEqual(['keepsake','rare','folio']);
    for (const theme of Object.values(kit.concepts)) {
      expect(theme.type.display).not.toBe(theme.type.body);
      expect(Object.keys(theme.color)).toEqual([
        'canvas','surface','ink','muted','action','actionInk',
        'accent','sleeve','focus','success','error','border',
      ]);
    }
  });
  it('meets WCAG AA for essential text and button combinations', () => {
    for (const [name, concept] of Object.entries(kit.concepts)) {
      const c = concept.color;
      for (const [front, back] of [
        ['ink','canvas'],['muted','canvas'],['ink','surface'],
        ['muted','surface'],['actionInk','action'],
      ]) {
        expect(ratio(c[front]!, c[back]!), name + ':' + front).toBeGreaterThanOrEqual(4.5);
      }
      expect(ratio(c.focus!, c.canvas!), name + ':focus').toBeGreaterThanOrEqual(3);
    }
  });
  it('keeps logos SVG-only, with no script, external images or brand confusion', () => {
    for (const name of ['keepsake','rare-room','folio-house']) {
      const svg = readFileSync('brand/logos/' + name + '.svg', 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox="0 0 80 80"');
      expect(svg).toContain('<title');
      expect(svg).not.toMatch(/<script|<image|<foreignObject|http:|href=/i);
    }
  });
});
