import { numberKey } from './personal';

/** Identity of a printing: language and set must never be guessed from artwork. */
export interface VisualReference {
  id: string;
  language: 'de' | 'en' | 'ja';
  setId: string;
  number: string;
}

/** Packed, row-major int8 embeddings, produced by exactly the same model. */
export interface VisualIndex {
  modelId: string;
  dimensions: number;
  references: readonly VisualReference[];
  vectors: Int8Array;
}

export interface VisualQuery {
  modelId: string;
  values: Float32Array;
}

export interface VisualHit {
  reference: VisualReference;
  similarity: number;
  /** Image rank before OCR. Similarity is NOT a probability. */
  visualRank: number;
}

export interface PrintedNumber {
  number: string;
  setId?: string;
  language?: string;
}

export interface VisualReview {
  kind: 'exact-print' | 'review';
  /** Only 'exact-print' may be proposed as a selected printing, never as owned. */
  suggested?: VisualHit;
  choices: VisualHit[];
}

/**
 * Bounded, allocation-light cosine search. A full scan of 100,000 x 384 int8
 * records uses no extra array proportional to the size of the collection.
 */
export function searchVisualIndex(
  query: VisualQuery,
  index: VisualIndex,
  topK = 5,
): VisualHit[] {
  if (
    !index.modelId ||
    query.modelId !== index.modelId ||
    !Number.isInteger(index.dimensions) ||
    index.dimensions < 1 ||
    query.values.length !== index.dimensions ||
    index.vectors.length !== index.references.length * index.dimensions ||
    !Number.isInteger(topK) ||
    topK < 1 ||
    topK > 20
  ) {
    throw new Error('Bildmodell und Referenzindex passen nicht zusammen.');
  }
  let queryNormSquared = 0;
  for (const value of query.values) {
    if (!Number.isFinite(value))
      throw new Error('Das Bild-Embedding enthält ungültige Werte.');
    queryNormSquared += value * value;
  }
  if (queryNormSquared <= 0)
    throw new Error('Das Bild-Embedding ist leer.');
  const queryNorm = Math.sqrt(queryNormSquared);
  const ranked: { reference: VisualReference; similarity: number }[] = [];
  for (let row = 0; row < index.references.length; row++) {
    let dot = 0;
    let norm = 0;
    const offset = row * index.dimensions;
    for (let j = 0; j < index.dimensions; j++) {
      const value = index.vectors[offset + j]!;
      dot += query.values[j]! * value;
      norm += value * value;
    }
    if (norm <= 0) continue;
    const entry = {
      reference: index.references[row]!,
      similarity: dot / (queryNorm * Math.sqrt(norm)),
    };
    // Stable deterministic ordering for equidistant candidates.
    let position = ranked.findIndex(
      (other) =>
        entry.similarity > other.similarity ||
        (entry.similarity === other.similarity &&
          entry.reference.id < other.reference.id),
    );
    if (position < 0) position = ranked.length;
    if (position < topK) ranked.splice(position, 0, entry);
    if (ranked.length > topK) ranked.pop();
  }
  return ranked.map((hit, index) => ({ ...hit, visualRank: index + 1 }));
}

/**
 * OCR only reranks *visual* candidates. Partial numbers are useful as hints,
 * but can never uniquely confirm an exact printing without the full fraction.
 */
export function reviewVisualCandidates(
  hits: readonly VisualHit[],
  clues: readonly PrintedNumber[],
  limit = 3,
): VisualReview {
  const exactFor = (hit: VisualHit) =>
    clues.some(
      (clue) =>
        clue.number.includes('/') &&
        numberKey(clue.number) === numberKey(hit.reference.number) &&
        (!clue.setId || clue.setId === hit.reference.setId) &&
        (!clue.language || clue.language === hit.reference.language),
    );
  const partialFor = (hit: VisualHit) =>
    clues.some((clue) => {
      if (clue.number.includes('/')) return false;
      const part = numberKey(clue.number);
      return (
        part.length >= 2 &&
        (numberKey(hit.reference.number).split('/')[0] === part ||
          numberKey(hit.reference.number).startsWith(part)) &&
        (!clue.setId || clue.setId === hit.reference.setId) &&
        (!clue.language || clue.language === hit.reference.language)
      );
    });
  const ranked = [...hits].sort((a, b) => {
    const score = (hit: VisualHit) =>
      (exactFor(hit) ? 2 : partialFor(hit) ? 1 : 0);
    return (
      score(b) - score(a) ||
      b.similarity - a.similarity ||
      a.reference.id.localeCompare(b.reference.id)
    );
  });
  const exact = ranked.filter(exactFor);
  return {
    kind: exact.length === 1 ? 'exact-print' : 'review',
    suggested: exact.length === 1 ? exact[0] : undefined,
    choices: ranked.slice(0, Math.max(1, Math.min(5, limit))),
  };
}

/**
 * Agreement across actual consecutive camera frames. Reprocessing the same
 * still image is not independent evidence and must not count as consensus.
 */
export function stableFrameCandidate(
  recent: readonly (string | null)[],
  minimumFrames = 2,
): string | null {
  if (minimumFrames < 2 || recent.length < minimumFrames) return null;
  const latest = recent.at(-1);
  if (!latest) return null;
  let count = 0;
  for (let index = recent.length - 1; index >= 0; index--) {
    if (recent[index] !== latest) break;
    count++;
  }
  return count >= minimumFrames ? latest : null;
}
