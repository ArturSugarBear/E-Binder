/**
 * Conservative card-boundary estimate inside an already perspective-corrected
 * binder pocket. This is NOT a general-purpose card detector.
 *
 * A full, row-major pocket is always available as the safe fallback. Return
 * a tighter card rect only when all four long borders are visible and their
 * edge directions and dimensions are mutually consistent. Never use a guessed
 * boundary to infer that a pocket is occupied or to confirm inventory.
 */
export interface CardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Edge = {
  position: number;
  polarity: number;
  score: number;
};

export function detectCardBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): CardBounds | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 64 ||
    height < 88 ||
    width > 512 ||
    height > 720 ||
    rgba.length !== width * height * 4
  )
    return null;

  const gray = new Uint8Array(width * height);
  for (let index = 0; index < gray.length; index++) {
    const pixel = index * 4;
    gray[index] = Math.round(
      0.2126 * rgba[pixel]! +
        0.7152 * rgba[pixel + 1]! +
        0.0722 * rgba[pixel + 2]!,
    );
  }

  const edge = (vertical: boolean, side: 'near' | 'far'): Edge | null => {
    const dimension = vertical ? width : height;
    const cross = vertical ? height : width;
    // Only consider borders near pocket edges. An edge around the artwork
    // must never be mistaken for the actual outer edge of the printed card.
    const low = Math.max(
      2,
      Math.round(dimension * (side === 'near' ? 0.015 : 0.85)),
    );
    const high = Math.min(
      dimension - 3,
      Math.round(dimension * (side === 'near' ? 0.15 : 0.985)),
    );
    let best: Edge | null = null;
    for (let coordinate = low; coordinate <= high; coordinate++) {
      let signed = 0;
      let magnitude = 0;
      let strong = 0;
      let count = 0;
      // Compare across long sections of the border, not a tiny feature.
      for (
        let along = Math.round(cross * 0.19);
        along < Math.round(cross * 0.81);
        along += 3
      ) {
        const before = vertical
          ? gray[along * width + coordinate - 2]!
          : gray[(coordinate - 2) * width + along]!;
        const after = vertical
          ? gray[along * width + coordinate + 2]!
          : gray[(coordinate + 2) * width + along]!;
        const difference = after - before;
        signed += difference;
        magnitude += Math.abs(difference);
        if (Math.abs(difference) >= 22) strong++;
        count++;
      }
      if (!count || !magnitude) continue;
      const coherence = Math.abs(signed) / magnitude;
      const coverage = strong / count;
      const score = Math.abs(signed) / count;
      if (
        coherence < 0.78 ||
        coverage < 0.7 ||
        score < 18 ||
        (best && score <= best.score)
      )
        continue;
      best = {
        position: coordinate,
        polarity: Math.sign(signed),
        score,
      };
    }
    return best;
  };

  const left = edge(true, 'near');
  const right = edge(true, 'far');
  const top = edge(false, 'near');
  const bottom = edge(false, 'far');
  if (!left || !right || !top || !bottom) return null;

  // A card-sized rectangle must have paired borders with opposite edge
  // polarity. This rejects one-axis seams and most interior artwork lines.
  if (left.polarity === right.polarity || top.polarity === bottom.polarity)
    return null;
  const cardWidth = right.position - left.position;
  const cardHeight = bottom.position - top.position;
  const centreX = (left.position + right.position) / 2;
  const centreY = (top.position + bottom.position) / 2;
  const pocketRatio = width / height;
  const cardRatio = cardWidth / cardHeight;
  if (
    cardWidth < width * 0.74 ||
    cardHeight < height * 0.74 ||
    Math.abs(centreX - width / 2) > width * 0.045 ||
    Math.abs(centreY - height / 2) > height * 0.045 ||
    Math.abs(cardRatio / pocketRatio - 1) > 0.12
  )
    return null;

  // One to two pixels outside the measured card border keep the entire
  // header, illustrator line and printed set/collector footer available.
  const x = Math.max(0, left.position - 2);
  const y = Math.max(0, top.position - 2);
  const rightEdge = Math.min(width, right.position + 3);
  const bottomEdge = Math.min(height, bottom.position + 3);
  return {
    x,
    y,
    width: rightEdge - x,
    height: bottomEdge - y,
  };
}
