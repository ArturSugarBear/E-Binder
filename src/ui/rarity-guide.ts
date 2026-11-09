import { catalogResumeCard, type catalogSetFacets } from '../data/card-catalog';
import type { WorkspaceContext } from './workspace-context';
import { action, el, message } from './workspace-dom';
import type { PersonalCard } from '../domain/personal';

type Facets = Awaited<ReturnType<typeof catalogSetFacets>>;
const descriptions: Record<string, string> = {
  common:
    'Häufige Grundstufe. Bei westlichen Karten meist am Kreissymbol zu erkennen.',
  uncommon:
    'Nicht so häufig. Bei westlichen Karten meist mit einer Raute gekennzeichnet.',
  rare: 'Seltene Karte; bei vielen westlichen Ausgaben am Sternsymbol erkennbar. Die Druckvariante wird zusätzlich erfasst.',
  'double rare':
    'Bei neueren westlichen Sets häufig Pokémon-ex. Zwei Sterne kennzeichnen diese Kategorie.',
  'illustration rare':
    'Eine großflächige Illustration zeigt das Pokémon oft in einer Szene.',
  'special illustration rare':
    'Eine besondere, großflächige Illustration, häufig bei Pokémon-ex und Unterstützern.',
  'ultra rare':
    'Eine besondere Ausgabe. Gestaltung und Kennzeichen hängen vom Set und der Ära ab.',
  'mega hyper rare': 'Eine besondere Seltenheitskategorie für Mega-Pokémon.',
  'shiny rare':
    'Das Pokémon erscheint in seiner schillernden Farbvariante. Diese Kategorie gibt es nur in bestimmten Sets.',
  'shiny ultra rare':
    'Eine besondere Ausgabe eines Pokémon in seiner schillernden Farbvariante.',
  'holo rare':
    'Eine holografische Seltenheitskategorie im Katalog. Den Glanzeffekt kann ein statisches Kartenbild nur begrenzt zeigen.',
  'rare holo':
    'Eine holografische Seltenheitskategorie im Katalog. Den Glanzeffekt kann ein statisches Kartenbild nur begrenzt zeigen.',
};
export function rarityDescription(value: string): string {
  const aliases: Record<string, string> = {
    häufig: 'common',
    ungewöhnlich: 'uncommon',
    selten: 'rare',
    doppelselten: 'double rare',
    'selten, illustration': 'illustration rare',
    'selten, besondere illustration': 'special illustration rare',
    'ultra selten': 'ultra rare',
    'mega hyper selten': 'mega hyper rare',
  };
  const key = value.toLowerCase();
  return (
    descriptions[aliases[key] ?? key] ??
    'So ist diese Karte im Katalog eingestuft.'
  );
}
export function createRarityGuide(
  ctx: WorkspaceContext,
  choose: (card: PersonalCard) => void,
) {
  const selected = el('div', 'w-rarity-selected');
  const list = el('div', 'w-rarity-examples');
  const guide = el(
    'details',
    'w-rarity-guide',
    el('summary', '', 'Seltenheiten verstehen – mit Beispielkarten'),
    list,
  );
  const element = el('div', 'w-rarity-help', selected, guide);
  element.hidden = true;
  let data: Facets | undefined;
  function example(rarity: string) {
    const matches = data!.cards.filter((card) => card.rarity === rarity);
    const result = matches.find((card) => card.image) ?? matches[0]!;
    const card = catalogResumeCard(result);
    const button = card.image
      ? action(
          `Beispiel für ${rarity}: ${card.name}`,
          () => choose(card),
          'card',
        )
      : undefined;
    button?.classList.add('w-rarity-example-card');
    button?.replaceChildren(ctx.images.artwork(card));
    return el(
      'div',
      `w-rarity-example${card.image ? '' : ' w-rarity-without-image'}`,
      button,
      el(
        'div',
        '',
        el('h3', '', rarity),
        el('p', '', rarityDescription(rarity)),
        !card.image
          ? el(
              'p',
              'w-help',
              'Für diese Seltenheit ist im Katalog noch kein Beispielbild verfügbar.',
            )
          : undefined,
        el(
          'small',
          'w-muted',
          `${matches.length} ${matches.length === 1 ? 'Karte' : 'Karten'} im Set · ${card.image ? 'Beispiel' : 'Kartendaten'}: ${card.name} ${card.number}`,
        ),
        action(
          card.image ? 'Beispielkarte ansehen' : 'Kartendaten ansehen',
          () => choose(card),
          'text',
        ),
      ),
    );
  }
  function update(facets: Facets | undefined, rarity: string) {
    const changed = data !== facets;
    data = facets;
    selected.replaceChildren();
    if (changed) {
      list.replaceChildren();
      guide.open = false;
    }
    element.hidden = !data?.cards.some((card) => card.rarity);
    if (!data || element.hidden) return;
    guide.querySelector('summary')!.textContent = data.cards.some(
      (card) => card.image,
    )
      ? 'Seltenheiten verstehen – mit Beispielkarten'
      : 'Seltenheiten verstehen';
    if (rarity && data.cards.some((card) => card.rarity === rarity))
      selected.append(example(rarity));
  }
  guide.addEventListener('toggle', () => {
    if (!guide.open || !data || list.childElementCount) return;
    const names = [
      ...new Set(data.cards.map((card) => card.rarity).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    list.append(
      message(
        'Kartendaten und verfügbare Beispielbilder stammen aus diesem Set. Seltenheit und Druckvariante (z. B. Reverse-Holo) werden getrennt erfasst. Eine Seltenheit garantiert keinen bestimmten Wert.',
      ),
    );
    for (const rarity of names) list.append(example(rarity));
  });
  return { element, update };
}
