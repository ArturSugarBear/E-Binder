import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  discoverNumberedCards,
  resolvePhotoScan,
} from '../../src/data/scan-auto-resolve';

afterEach(() => vi.unstubAllGlobals());

describe('autonomous Japanese card matching', () => {
  const set = {
    id: 'M1L',
    name: 'メガブレイブ',
    cardCount: { official: 63 },
  };
  const otherSet = {
    id: 'M1S',
    name: 'メガシンフォニア',
    cardCount: { official: 63 },
  };
  const lucario = {
    id: 'M1L-088',
    localId: '088',
    name: 'メガルカリオex',
  };
  const other = {
    id: 'M1S-088',
    localId: '088',
    name: 'メガサーナイトex',
  };

  function mockCatalog() {
    const fetcher = vi.fn(async (request: string) => {
      const url = new URL(request);
      const ja = url.pathname.includes('/ja/');
      let data: unknown = [];
      if (url.pathname.endsWith('/sets')) {
        data = ja ? [set, otherSet] : [];
      } else if (url.pathname.endsWith('/series/tcgp')) {
        data = { id: 'tcgp', sets: [] };
      } else if (url.pathname.endsWith('/cards')) {
        data =
          ja && url.searchParams.get('localId') === 'eq:088'
            ? [lucario, other]
            : [];
      } else if (url.pathname.endsWith('/cards/M1L-088')) {
        data = { ...lucario, set, variants: { holo: true } };
      } else if (url.pathname.endsWith('/cards/M1S-088')) {
        data = { ...other, set: otherSet, variants: { holo: true } };
      }
      return new Response(JSON.stringify(data));
    });
    vi.stubGlobal('fetch', fetcher);
    return fetcher;
  }

  it('finds M1L from full number even with German as preferred language', async () => {
    const fetcher = mockCatalog();
    const cards = await discoverNumberedCards(
      '088/063',
      'de',
      new AbortController().signal,
    );
    expect(cards.map((card) => card.sourceId).sort()).toEqual([
      'M1L-088',
      'M1S-088',
    ]);
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes('/ja/')),
    ).toBe(true);
  });

  it('resolves exact Japanese name and number without any set input', async () => {
    mockCatalog();
    const result = await resolvePhotoScan(
      new Blob(['fake']),
      '088/063\nメガルカリオex',
      [],
      'de',
      new AbortController().signal,
    );
    expect(result.basis).toBe('full-name');
    expect(result.suggested?.sourceId).toBe('M1L-088');
  });

  it('retains a visual catalogue match when OCR is empty', async () => {
    mockCatalog();
    const signal = new AbortController().signal;
    const known = await discoverNumberedCards('088/063', 'ja', signal);
    const visualHit = {
      reference: {
        id: 'ja:M1L-088',
        language: 'ja' as const,
        setId: 'M1L',
        number: '088/063',
      },
      similarity: 0.92,
      visualRank: 1,
    };
    const result = await resolvePhotoScan(
      new Blob(['camera']),
      '',
      known,
      'ja',
      signal,
      null,
      1000,
      Promise.resolve([visualHit]),
    );
    expect(result.basis).toBe('visual-review');
    expect(result.suggested).toBeUndefined();
    expect(result.candidates[0]?.sourceId).toBe('M1L-088');
    expect(result.visualModelCandidates).toBe(1);
  });

  it('does not call a shared number an exact printing without extra evidence', async () => {
    mockCatalog();
    const result = await resolvePhotoScan(
      new Blob(['fake']),
      '088/063',
      [],
      'de',
      new AbortController().signal,
    );
    expect(result.basis).toBe('review');
    expect(result.suggested).toBeUndefined();
    expect(result.candidates).toHaveLength(2);
  });
});
