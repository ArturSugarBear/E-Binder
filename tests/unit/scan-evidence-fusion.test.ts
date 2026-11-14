import { afterEach, describe, expect, it, vi } from 'vitest';
import { fuseScanEvidence } from '../../src/data/scan-evidence-fusion';
import { resolvePhotoScan } from '../../src/data/scan-auto-resolve';
import type { PersonalCard } from '../../src/domain/personal';
import type { VisualHit } from '../../src/domain/visual-retrieval';

function card(
  language: 'de' | 'en' | 'ja',
  sourceId: string,
  name: string,
  number: string,
): PersonalCard {
  return {
    key: 'tcgdex:' + language + ':' + sourceId,
    source: 'tcgdex',
    sourceId,
    language,
    setId: sourceId.slice(0, sourceId.lastIndexOf('-')),
    setName: 'Test Set',
    number,
    name,
    image: '',
    artist: '',
    artistSource: 'unknown',
    evolvesFrom: '',
    stage: '',
    finishes: ['normal'],
  };
}

function hit(card: PersonalCard, rank = 1, similarity = 0.9): VisualHit {
  return {
    reference: {
      id: card.language + ':' + card.sourceId,
      language: card.language as 'de' | 'en' | 'ja',
      setId: card.setId,
      number: card.number,
    },
    visualRank: rank,
    similarity,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('P0 scanner evidence fusion', () => {
  const lucario = card('ja', 'M1L-088', 'メガルカリオex', '088/063');
  const gardevoir = card('ja', 'M1S-088', 'メガサーナイトex', '088/063');

  it('fuses a real model reference with printed Japanese set, fraction and exact name', () => {
    const result = fuseScanEvidence(
      'M1L 088/063\nメガルカリオex',
      [gardevoir, lucario],
      [hit(lucario)],
      'ja',
    );
    expect(result.candidates[0]?.key).toBe(lucario.key);
    expect(result.suggested?.key).toBe(lucario.key);
    expect(result.state).toBe('text-image-agree');
    expect(result.visualAgreement).toBe(true);
    expect(result.basis).toBe('printed-set');
  });

  it('does not require the nine-card model to know a real printing when OCR is exact', () => {
    const result = fuseScanEvidence(
      'M1L 088/063\nメガルカリオex',
      [gardevoir, lucario],
      [],
      'ja',
    );
    expect(result.suggested?.key).toBe(lucario.key);
    expect(result.state).toBe('printed-identity');
    expect(result.visualAgreement).toBe(false);
  });

  it('downgrades contradictory footer set codes even if a matching visual candidate exists', () => {
    const groudon = card('de', 'me06-111', 'Groudon', '111/103');
    const result = fuseScanEvidence(
      'DLRDE 111/103\nPBLDE 111/103\nGroudon',
      [groudon],
      [hit(groudon)],
      'de',
    );
    expect(result.candidates[0]?.key).toBe(groudon.key);
    expect(result.suggested).toBeUndefined();
    expect(result.state).toBe('ocr-conflict');
    expect(result.retryRegion).toBe('footer-contrast');
  });

  it('refuses a conflicting title even if set, number and image match', () => {
    const result = fuseScanEvidence(
      'M1L 088/063\nLucario',
      [gardevoir, lucario],
      [hit(lucario)],
      'ja',
    );
    expect(result.candidates[0]?.key).toBe(lucario.key);
    expect(result.suggested).toBeUndefined();
    expect(result.state).toBe('ocr-conflict');
    expect(result.retryRegion).toBe('title');
  });

  it('does not make a visual-only match a verified identity or confidence probability', () => {
    const result = fuseScanEvidence(
      '',
      [lucario],
      [hit(lucario, 1, 0.999)],
      'ja',
    );
    expect(result.state).toBe('visual-review');
    expect(result.suggested).toBeUndefined();
    expect(result.retryRegion).toBe('footer');
    expect(result).not.toHaveProperty('confidence');
  });

  it('does not guess the language from artwork shared by DE and EN cards', () => {
    const de = card('de', 'me06-111', 'Groudon', '111/103');
    const en = card('en', 'me06-111', 'Groudon', '111/103');
    const result = fuseScanEvidence(
      '111/103\nGroudon',
      [de, en],
      [hit(en, 1, 0.99), hit(de, 2, 0.98)],
      'de',
    );
    expect(result.candidates).toHaveLength(2);
    expect(result.suggested).toBeUndefined();
    expect(result.state).toBe('visual-review');
  });

  it('keeps the image candidate on a misread complete collector fraction', () => {
    const result = fuseScanEvidence(
      'M1L 089/063\nメガルカリオex',
      [lucario],
      [hit(lucario)],
      'ja',
    );
    expect(result.candidates.map((item) => item.key)).toContain(lucario.key);
    expect(result.suggested).toBeUndefined();
    expect(result.state).toBe('ocr-conflict');
    expect(result.retryRegion).toBe('footer-contrast');
  });

  it('treats competing full fractions as contradictory, not repeated votes', () => {
    const result = fuseScanEvidence(
      'M1L 088/063\nM1L 089/063\nメガルカリオex',
      [lucario],
      [hit(lucario)],
    );
    expect(result.suggested).toBeUndefined();
    expect(result.state).toBe('ocr-conflict');
    expect(result.retryRegion).toBe('footer-contrast');
  });

  it('requires exact reference identity and rejects NaN or forged visual evidence', () => {
    const broken: VisualHit = {
      ...hit(lucario),
      reference: { ...hit(lucario).reference, setId: 'M1S' },
    };
    const notFinite = hit(lucario, 1, Number.NaN);
    const result = fuseScanEvidence('', [lucario], [broken, notFinite]);
    expect(result.visualAgreement).toBe(false);
    expect(result.state).toBe('review');
    expect(result.suggested).toBeUndefined();
  });

  it('handles empty model results, empty catalogues and partial numbers', () => {
    expect(fuseScanEvidence('', []).state).toBe('no-match');
    const result = fuseScanEvidence('088', [lucario], [hit(lucario)]);
    expect(result.candidates[0]?.key).toBe(lucario.key);
    expect(result.suggested).toBeUndefined();
    expect(result.retryRegion).toBe('footer');
  });

  it('runs OCR and ONNX candidate paths together without deleting the correct card after OCR error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]))),
    );
    const session = {
      match: vi.fn(async () => [hit(lucario)]),
      close: vi.fn(),
      limited: false,
    };
    const result = await resolvePhotoScan(
      new Blob(['photo']),
      'M1L 089/063\nメガルカリオex',
      [lucario],
      'ja',
      new AbortController().signal,
      session,
    );
    expect(session.match).toHaveBeenCalledTimes(1);
    expect(result.candidates[0]?.key).toBe(lucario.key);
    expect(result.suggested).toBeUndefined();
    expect(result.fusionState).toBe('ocr-conflict');
    expect(result.retryRegion).toBe('footer-contrast');
  });
});
