import { describe, expect, it } from 'vitest';
import {
  reviewVisualCandidates,
  searchVisualIndex,
  stableFrameCandidate,
  type VisualIndex,
  type VisualReference,
} from '../../src/domain/visual-retrieval';

const refs: VisualReference[] = [
  { id: 'de:sv01-001', language: 'de', setId: 'sv01', number: '001/198' },
  { id: 'en:sv01-001', language: 'en', setId: 'sv01', number: '001/198' },
  { id: 'ja:SV2a-001', language: 'ja', setId: 'SV2a', number: '001/165' },
  { id: 'de:sv04-123', language: 'de', setId: 'sv04', number: '123/182' },
  { id: 'de:sv05-077', language: 'de', setId: 'sv05', number: '077/162' },
  { id: 'de:sv06-077', language: 'de', setId: 'sv06', number: '077/167' },
];
function fixture(): VisualIndex {
  // Same artwork may produce identical vectors for different printings.
  const vectors = new Int8Array(
    [100, 1, 0, 0, 100, 1, 0, 0, 100, 1, 0, 0, 0, 100, 0, 0, 0, 0, 100, 0, 0, 0, 90, 20],
  );
  return { modelId: 'fixture-v1', dimensions: 4, references: refs, vectors };
}
describe('visual-first card retrieval', () => {
  it('ranks cosine matches deterministically and respects top K', () => {
    const index = fixture();
    const hits = searchVisualIndex(
      { modelId: 'fixture-v1', values: new Float32Array([1, 0, 0, 0]) },
      index,
      5,
    );
    expect(hits).toHaveLength(5);
    expect(hits.slice(0, 3).map((hit) => hit.reference.id)).toEqual([
      'de:sv01-001',
      'en:sv01-001',
      'ja:SV2a-001',
    ]);
    expect(hits[0]!.similarity).toBeGreaterThan(0.999);
    expect(hits[0]!.visualRank).toBe(1);
  });
  it('rejects wrong model versions, malformed vectors, zeros and invalid rank counts', () => {
    const index = fixture();
    const vector = new Float32Array([1, 0, 0, 0]);
    expect(() => searchVisualIndex({ modelId: 'other', values: vector }, index)).toThrow();
    expect(() => searchVisualIndex({ modelId: index.modelId, values: new Float32Array(3) }, index)).toThrow();
    expect(() => searchVisualIndex({ modelId: index.modelId, values: new Float32Array(4) }, index)).toThrow();
    expect(() => searchVisualIndex({ modelId: index.modelId, values: vector }, { ...index, vectors: new Int8Array(5) })).toThrow();
    expect(() => searchVisualIndex({ modelId: index.modelId, values: vector }, index, 100)).toThrow();
  });
  it('uses the full OCR fraction to separate identical artwork without guessing the language', () => {
    const hits = searchVisualIndex(
      { modelId: 'fixture-v1', values: new Float32Array([1, 0, 0, 0]) },
      fixture(),
    );
    const ambiguous = reviewVisualCandidates(hits, [{ number: '001/198' }]);
    expect(ambiguous.kind).toBe('review');
    expect(ambiguous.suggested).toBeUndefined();
    const exact = reviewVisualCandidates(hits, [
      { number: '001/165', setId: 'SV2a', language: 'ja' },
    ]);
    expect(exact.kind).toBe('exact-print');
    expect(exact.suggested?.reference.id).toBe('ja:SV2a-001');
    expect(exact.choices[0]?.reference.id).toBe('ja:SV2a-001');
  });
  it('never treats partial or inconsistent numbers as an exact printing', () => {
    const hits = searchVisualIndex(
      { modelId: 'fixture-v1', values: new Float32Array([0, 0, 0, 1]) },
      fixture(),
    );
    expect(reviewVisualCandidates(hits, [{ number: '07' }]).kind).toBe('review');
    expect(
      reviewVisualCandidates(hits, [{ number: '077/167', setId: 'different' }]).kind,
    ).toBe('review');
  });
  it('only counts independent consecutive frame candidates toward stability', () => {
    expect(stableFrameCandidate(['card-a'])).toBeNull();
    expect(stableFrameCandidate(['card-a', null, 'card-a'])).toBeNull();
    expect(stableFrameCandidate(['card-a', 'card-b', 'card-b'])).toBe('card-b');
    expect(stableFrameCandidate(['card-a', 'card-a', 'card-b'])).toBeNull();
  });
});

it('uses incomplete OCR digits only as visual ranking hints, never as printing proof', async () => {
  const { visualNumberClues } = await import('../../src/data/card-catalog');
  const clues = visualNumberClues('SVI de\n2I1\n211');
  expect(clues[0]).toMatchObject({ number: '211', observations: 2 });
  const hits = searchVisualIndex(
    { modelId: 'fixture-v1', values: new Float32Array([0, 1, 0, 0]) },
    fixture(),
  );
  const review = reviewVisualCandidates(hits, clues);
  expect(review.kind).toBe('review');
  expect(review.suggested).toBeUndefined();
  expect(visualNumberClues('SVI DE 211/198')[0]?.number).toBe('211/198');
});
