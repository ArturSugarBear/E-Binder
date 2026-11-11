import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRecognizedCards, recognitionClues } from '../../src/data/card-catalog';

afterEach(() => vi.unstubAllGlobals());

describe('Japanese print identification by OCR', () => {
  it('ignores the HP number without a printed collector fraction', () => {
    expect(recognitionClues('的\n340\nメガリザードン')).toEqual([]);
    expect(recognitionClues('M2a\nHP 340')).toEqual([]);
  });

  it('preserves case-sensitive Japanese set codes and a printed fraction', () => {
    expect(recognitionClues('SV2a 001/165\n340')).toEqual([
      {
        number: '1/165',
        setId: 'SV2a',
        language: 'ja',
        observations: 1,
      },
    ]);
  });

  it('resolves the exact padded Japanese print ID rather than using an HP number', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/ja/sets/SV2a'))
        return new Response(
          JSON.stringify({
            id: 'SV2a',
            name: 'ポケモンカード151',
            cardCount: { official: 165 },
            cards: [{ id: 'SV2a-001', localId: '001', name: 'フシギダネ' }],
          }),
        );
      if (url.endsWith('/ja/cards/SV2a-001'))
        return new Response(
          JSON.stringify({
            id: 'SV2a-001',
            localId: '001',
            name: 'フシギダネ',
            set: {
              id: 'SV2a',
              name: 'ポケモンカード151',
              cardCount: { official: 165 },
            },
          }),
        );
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetcher);
    const found = await fetchRecognizedCards('SV2a 001/165\nHP 340', 'de');
    expect(found.map((card) => card.sourceId)).toEqual(['SV2a-001']);
    expect(fetcher.mock.calls.every(([url]) => String(url).includes('/ja/'))).toBe(true);
  });
});
