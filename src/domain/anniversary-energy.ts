import { personalCardSchema, type PersonalCard } from './personal';

// The printed MEE 009–016 codes are the 30th-anniversary holo printings.
// Ordinary Mega Evolution energy cards use MEE 001–008. The two runs must
// never be merged simply because the artwork or energy type looks similar.
// Printing reference: https://www.cardmarket.com/de/Pokemon/Products/Singles/Mega-Evolution-Energies
const energyNames = [
  ['Pflanzen', 'Grass'],
  ['Feuer', 'Fire'],
  ['Wasser', 'Water'],
  ['Elektro', 'Lightning'],
  ['Psycho', 'Psychic'],
  ['Kampf', 'Fighting'],
  ['Finsternis', 'Darkness'],
  ['Metall', 'Metal'],
] as const;

/**
 * Safe code-only suggestions for the eight 30th-anniversary energy prints.
 * No image or external catalogue ID is invented: a card remains a manual
 * edition requiring the collector's confirmation before it enters inventory.
 */
export function anniversaryEnergyFromText(
  text: string,
  language: string,
): PersonalCard[] {
  if (language !== 'de' && language !== 'en') return [];
  const numbers = new Set<number>();
  for (const match of text.matchAll(
    /\bMEE[\s:.-]*([0-9O]{2,3})\b(?!\s*[/|]\s*[0-9O])/gi,
  )) {
    const number = Number(match[1]!.replace(/O/gi, '0'));
    if (Number.isInteger(number) && number >= 9 && number <= 16)
      numbers.add(number);
  }
  return [...numbers]
    .sort((a, b) => a - b)
    .map((number) => {
      const [german, english] = energyNames[number - 9]!;
      const printed = String(number).padStart(3, '0');
      return personalCardSchema.parse({
        key: `manual:30th-energy:mee-${printed}:${language}`,
        name:
          language === 'de'
            ? `Basis-${german}-Energie`
            : `Basic ${english} Energy`,
        setName: language === 'de' ? '30 Jahre' : '30th Celebration',
        setId: '',
        number: `MEE ${printed}`,
        language,
        image: '',
        source: 'manual',
        sourceId: '',
        artist: '',
        artistSource: 'unknown',
        evolvesFrom: '',
        stage: '',
        finishes: ['holo'],
      });
    });
}
