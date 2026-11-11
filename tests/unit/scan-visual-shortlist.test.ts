import { describe, expect, it, vi } from 'vitest';
import { resolveVisualPrintings } from '../../src/data/scan-visual-shortlist';
import { resolvePhotoScan } from '../../src/data/scan-auto-resolve';
import type { VisualHit } from '../../src/domain/visual-retrieval';
import type { PersonalCard } from '../../src/domain/personal';

function card(language: 'de' | 'en' | 'ja', id: string, number: string): PersonalCard {
  return {
    key: `tcgdex:${language}:${id}`,
    source: 'tcgdex',
    sourceId: id,
    language,
    setId: id.slice(0, id.lastIndexOf('-')),
    setName: 'Test Set',
    number,
    name: 'Groudon',
    image: '',
    artist: '',
    artistSource: 'unknown',
    evolvesFrom: '',
    stage: '',
    finishes: ['normal'],
  };
}

function hit(language: 'de' | 'en' | 'ja', id: string, number: string, rank: number): VisualHit {
  return {
    reference: {
      id: `${language}:${id}`,
      language,
      setId: id.slice(0, id.lastIndexOf('-')),
      number,
    },
    similarity: 0.97 - rank * 0.01,
    visualRank: rank,
  };
}

describe('P08 visual print resolution', () => {
  it('returns DE and EN printings separately when artwork is identical', async () => {
    const de = card('de', 'me06-111', '111/103');
    const en = card('en', 'me06-111', '111/103');
    const matches = [hit('de', 'me06-111', '111/103', 1), hit('en', 'me06-111', '111/103', 2)];
    const fetchCard = vi.fn();
    const resolved = await resolveVisualPrintings(matches, [de, en], new AbortController().signal, {
      readCard: fetchCard,
    });
    expect(resolved.map((item) => item.key)).toEqual([de.key, en.key]);
    expect(fetchCard).not.toHaveBeenCalled();
  });

  it('rejects incorrect set/number and language from remotely loaded card details', async () => {
    const seen = vi.fn(async (id: string, language: string) =>
      card(language === 'de' ? 'en' : 'de', id, '053/103'),
    );
    const resolved = await resolveVisualPrintings(
      [hit('de', 'me06-111', '111/103', 1)],
      [],
      new AbortController().signal,
      { readCard: seen },
    );
    expect(seen).toHaveBeenCalledWith('me06-111', 'de', expect.any(AbortSignal));
    expect(resolved).toEqual([]);
  });

  it('rejects malformed source IDs and silently missing catalogue results', async () => {
    const invalid: VisualHit = {
      reference: {
        id: 'ja:not/a/card',
        language: 'ja',
        setId: 'M1L',
        number: '088/063',
      },
      similarity: 0.9,
      visualRank: 1,
    };
    const fetcher = vi.fn();
    expect(
      await resolveVisualPrintings(
        [invalid],
        [],
        new AbortController().signal,
        { readCard: fetcher },
      ),
    ).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('leaves an aborted scan empty without contacting catalogues', async () => {
    const abort = new AbortController();
    abort.abort();
    const readCard = vi.fn();
    const output = await resolveVisualPrintings(
      [hit('ja', 'M1L-088', '088/063', 1)],
      [],
      abort.signal,
      { readCard },
    );
    expect(output).toEqual([]);
    expect(readCard).not.toHaveBeenCalled();
  });

  it('surfaces image candidate alternatives when OCR could not read any text, without automatic confirmation', async () => {
    const de = card('de', 'me06-111', '111/103');
    const en = card('en', 'me06-111', '111/103');
    const mockSession = {
      match: vi.fn(async () => [
        hit('en', 'me06-111', '111/103', 1),
        hit('de', 'me06-111', '111/103', 2),
      ]),
      close: vi.fn(),
    };
    const result = await resolvePhotoScan(
      new Blob(['photo'], { type: 'image/jpeg' }),
      '',
      [de, en],
      'de',
      new AbortController().signal,
      mockSession,
    );
    expect(mockSession.match).toHaveBeenCalledWith(expect.any(Blob), 5000);
    expect(result.candidates.map((entry) => entry.key).slice(0, 2)).toEqual([
      en.key,
      de.key,
    ]);
    expect(result.basis).toBe('visual-review');
    expect(result.suggested).toBeUndefined();
  });
});
