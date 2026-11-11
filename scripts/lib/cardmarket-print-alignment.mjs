/**
 * Exact-print alignment against Cardmarket's public Pokémon singles catalog.
 * Cardmarket has no collector number in the bulk export. We therefore align
 * its order to an independent, numbered set manifest, and only accept
 * individually name-matched printings inside a well-aligned expansion.
 *
 * Never infer a price from just a name or the position of an unmatched row.
 */
export function canonicalProductName(name) {
  return String(name ?? '')
    .split('[')[0]
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function canonicalCollectorNumber(value) {
  const normalized = String(value ?? '').toUpperCase().replace(/\s+/g, '');
  const match = normalized.match(/^([A-Z]*)(0*)([0-9]+)([A-Z]*)$/);
  return match
    ? match[1] + String(Number(match[3])) + match[4]
    : normalized;
}

/**
 * Determine a monotone matching. Skips are allowed because marketplace
 * expansions sometimes contain a few early promotional/bonus products.
 * Matching names are not sufficient on their own: validate coverage,
 * one-to-one uniqueness and surrounding anchors below.
 */
export function alignProductPrints(products, numberedCards) {
  const market = [...products].sort((a, b) => a.idProduct - b.idProduct);
  const cards = [...numberedCards].sort((a, b) => {
    const nA = Number.parseInt(a[0], 10);
    const nB = Number.parseInt(b[0], 10);
    return Number.isFinite(nA) && Number.isFinite(nB)
      ? nA - nB
      : String(a[0]).localeCompare(String(b[0]), undefined, {
          numeric: true,
        });
  });
  const n = market.length;
  const m = cards.length;
  if (!n || !m || Math.abs(n - m) > Math.max(8, m * 0.2))
    return { accepted: false, coverage: 0, matches: [] };
  const score = Array.from({ length: n + 1 }, () =>
    new Float64Array(m + 1),
  );
  const path = Array.from({ length: n + 1 }, () =>
    new Uint8Array(m + 1),
  );
  const skip = -4;
  for (let i = 1; i <= n; i++) score[i][0] = i * skip;
  for (let j = 1; j <= m; j++) score[0][j] = j * skip;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const equal =
        canonicalProductName(market[i - 1].name) ===
        canonicalProductName(cards[j - 1][1]);
      const diagonal = score[i - 1][j - 1] + (equal ? 12 : -12);
      const up = score[i - 1][j] + skip;
      const left = score[i][j - 1] + skip;
      if (diagonal >= up && diagonal >= left) {
        score[i][j] = diagonal;
        path[i][j] = equal ? 1 : 4;
      } else if (up >= left) {
        score[i][j] = up;
        path[i][j] = 2;
      } else {
        score[i][j] = left;
        path[i][j] = 3;
      }
    }
  }
  let i = n;
  let j = m;
  const matches = [];
  while (i > 0 || j > 0) {
    const move = path[i][j];
    if (i > 0 && j > 0 && (move === 1 || move === 4)) {
      if (move === 1)
        matches.push({
          productId: market[i - 1].idProduct,
          productName: market[i - 1].name,
          expansionId: market[i - 1].idExpansion,
          number: String(cards[j - 1][0]),
          cardName: String(cards[j - 1][1]),
          cardIndex: j - 1,
          productIndex: i - 1,
          independentlyMappedId: cards[j - 1][3] ?? null,
        });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || move === 2)) {
      i--;
    } else {
      j--;
    }
  }
  matches.reverse();
  const coverage = matches.length / m;
  // Even a single mistaken shift can corrupt a whole pricing portfolio.
  // Require the majority of independently numbered prints to line up.
  const accepted = matches.length >= 10 && coverage >= 0.75;
  if (!accepted) return { accepted: false, coverage, matches: [] };
  const trusted = matches.filter((item, index) => {
    if (
      item.independentlyMappedId != null &&
      Number(item.independentlyMappedId) !== item.productId
    )
      return false;
    const previous = matches[index - 1];
    const next = matches[index + 1];
    const anchoredBefore =
      previous && item.cardIndex - previous.cardIndex <= 4;
    const anchoredAfter = next && next.cardIndex - item.cardIndex <= 4;
    return Boolean(
      (anchoredBefore && anchoredAfter) ||
        (item.cardIndex <= 3 && anchoredAfter) ||
        (item.cardIndex >= m - 4 && anchoredBefore) ||
        Number(item.independentlyMappedId) === item.productId,
    );
  });
  return { accepted: true, coverage, matches: trusted };
}
