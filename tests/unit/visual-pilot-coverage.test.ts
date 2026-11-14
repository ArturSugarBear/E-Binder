import { describe, expect, it } from 'vitest';
import {
  reviewVisualCandidates,
  searchVisualIndex,
  type VisualIndex,
  type VisualReference,
} from '../../src/domain/visual-retrieval';
import { fuseScanEvidence } from '../../src/data/scan-evidence-fusion';
import type { PersonalCard } from '../../src/domain/personal';

/**
 * P0 coverage regression for the opt-in DINOv2 pilot.
 *
 * The shipped pilot index contains exactly nine German sv01/sv02/sv03
 * printings (scripts/prepare-visual-beta-input.mjs). A nearest-neighbour
 * search over that index can only return those nine cards. The P0 recovery
 * plan requires the scanner to stop presenting that shortlist as general
 * recognition when the photographed card is not covered:
 *
 *   docs/plans/2026-11-14-scanner-p0-recovery-implementation.md
 *   §4.7  "fall back to OCR/catalog search instead of always returning a
 *          visually similar pilot card"
 *   §8    "No forced nine-card shortlist in general scanner suggestions."
 *
 * On 2026-11-14 a local probe with the exact deployed INT8 weights
 * (sha256 7cfc69bd…, 24,427,763 bytes) and this exact index packing showed
 * that unrelated frames still receive five pilot cards: a grey frame scored
 * cosine 0.10…0.004, camera noise 0.20…0.11, and non-indexed cards 0.74…0.38.
 * The tests below pin that behaviour down so a future coverage gate can flip
 * the expected-failure test to a normal pass.
 */

/** The nine exact printings bundled by scripts/prepare-visual-beta-input.mjs. */
const pilotReferences: VisualReference[] = [
  { id: 'de:sv01-211', language: 'de', setId: 'sv01', number: '211/198' },
  { id: 'de:sv01-212', language: 'de', setId: 'sv01', number: '212/198' },
  { id: 'de:sv01-245', language: 'de', setId: 'sv01', number: '245/198' },
  { id: 'de:sv03-207', language: 'de', setId: 'sv03', number: '207/197' },
  { id: 'de:sv03-208', language: 'de', setId: 'sv03', number: '208/197' },
  { id: 'de:sv03-225', language: 'de', setId: 'sv03', number: '225/197' },
  { id: 'de:sv02-208', language: 'de', setId: 'sv02', number: '208/193' },
  { id: 'de:sv02-209', language: 'de', setId: 'sv02', number: '209/193' },
  { id: 'de:sv02-210', language: 'de', setId: 'sv02', number: '210/193' },
];

/**
 * Every reference lives in the first two dimensions; the last two stay zero.
 * A query on axis 4 is therefore orthogonal to the whole index and scores a
 * cosine similarity of exactly 0 against every pilot card — the mathematical
 * equivalent of a frame that contains no evidence at all.
 */
function pilotIndex(): VisualIndex {
  const rows = pilotReferences.length;
  const vectors = new Int8Array(rows * 4);
  for (let row = 0; row < rows; row++) {
    vectors[row * 4] = 100;
    vectors[row * 4 + 1] = 90 - row * 5;
  }
  return {
    modelId: 'dinov2-small-onnx-08c606e-int8-beta9',
    dimensions: 4,
    references: pilotReferences,
    vectors,
  };
}

function pilotCard(reference: VisualReference): PersonalCard {
  const sourceId = reference.id.slice(reference.language.length + 1);
  return {
    key: 'tcgdex:' + reference.language + ':' + sourceId,
    source: 'tcgdex',
    sourceId,
    language: reference.language,
    setId: reference.setId,
    setName: 'Test Set',
    number: reference.number,
    name: 'Pilotkarte ' + sourceId,
    image: '',
    artist: '',
    artistSource: 'unknown',
    evolvesFrom: '',
    stage: '',
    finishes: ['normal'],
  };
}

const noEvidenceQuery = () => ({
  modelId: 'dinov2-small-onnx-08c606e-int8-beta9',
  values: new Float32Array([0, 0, 0, 1]),
});

describe('DINOv2 pilot coverage (P0)', () => {
  it('always fills Top-5 from the nine-card pilot, even at zero similarity', () => {
    const hits = searchVisualIndex(noEvidenceQuery(), pilotIndex(), 5);
    expect(hits).toHaveLength(5);
    expect(hits.every((hit) => hit.similarity === 0)).toBe(true);
    expect(reviewVisualCandidates(hits, []).suggested).toBeUndefined();
  });

  it('returns the identical pilot shortlist for two unrelated frames', () => {
    // Deterministic tie-break by reference ID makes the repetition explicit.
    const first = searchVisualIndex(noEvidenceQuery(), pilotIndex(), 5);
    const second = searchVisualIndex(noEvidenceQuery(), pilotIndex(), 5);
    expect(first.map((hit) => hit.reference.id)).toEqual(
      second.map((hit) => hit.reference.id),
    );
  });

  it.fails(
    'must not turn a no-evidence frame into five pilot candidates',
    () => {
      const index = pilotIndex();
      const hits = searchVisualIndex(noEvidenceQuery(), index, 5);
      const cards = pilotReferences.map(pilotCard);
      const fused = fuseScanEvidence('', cards, hits, 'de');
      // Desired P0 contract: no catalog evidence + no coverage => no candidate
      // list and no "visual-review" state that the review screen renders as a
      // concrete card (src/ui/add-cards.ts, basis === 'visual-review' branch).
      expect(fused.state).not.toBe('visual-review');
      expect(fused.candidates).toHaveLength(0);
      expect(fused.suggested).toBeUndefined();
    },
  );
});
