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
    if (/\b(?:ENERGIE|ENERGY)\b/i.test(cleaned)) {
      // Generic "Energie" is not enough to select a card printing. Only
      // search the catalogue when OCR actually read a specific energy type.
      const typed = cleaned.match(
        /(?:^|[\s/-])(Pflanzen?|Feuer|Wasser|Elektro|Psycho|Kampf|Finsternis|Metall|Fee|Farblos|Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy|Colorless)[\s/-]*(Energie|Energy)\b/i,
      );
      if (typed)
        hints.push(
          `${typed[1]}${/^energy$/i.test(typed[2]!) ? ' ' : '-'}${typed[2]}`,
        );
      break;
    }
    if (/\b(?:BASIS|BASIC|GRUND)\b/i.test(cleaned)) continue;
    if (/\b(?:POKEMON|POKÉMON|GAMEFREAK|SAMMLERNUMMER)\b/i.test(cleaned))
      continue;
    hints.push(cleaned);
    break;
  }
  return [...new Set(hints)];
}
