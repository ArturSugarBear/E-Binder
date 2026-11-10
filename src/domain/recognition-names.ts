/**
 * Pull a *search hint* from the title line recognized near the card's top edge.
 * This is never an exact printing match or evidence of ownership.
 *
 * The worker emits the top line last. Earlier rows contain collector numbers
 * and set codes; only the trailing title rows are considered.
 */
export function recognizedNameHints(text: string): string[] {
  const hints: string[] = [];
  const lines = text.split(/\r?\n/).slice(-3).reverse();
  for (const raw of lines) {
    const cleaned = raw
      .replace(/[\u200b-\u200f]/g, '')
      .replace(/\b(?:KP|HP)\s*\d{1,4}\b/gi, '')
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      .trim();
    if (
      cleaned.length < 3 ||
      cleaned.length > 42 ||
      /\d{1,3}\s*[/|]\s*\d{1,3}/.test(cleaned) ||
      !/\p{L}{3}/u.test(cleaned)
    )
      continue;
    if (/\b(?:BASIS|BASIC|GRUND|ENERGY|ENERGIE)\b/i.test(cleaned)) {
      if (/ENERGIE|ENERGY/i.test(cleaned)) {
        hints.push('Energie');
        break;
      }
      continue;
    }
    if (/\b(?:POKEMON|POKÉMON|GAMEFREAK|SAMMLERNUMMER)\b/i.test(cleaned))
      continue;
    hints.push(cleaned);
    break;
  }
  return [...new Set(hints)];
}
