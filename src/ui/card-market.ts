import type { CatalogEntry } from '../data/card-catalog';
import { el, icon } from './workspace-dom';

/** Public catalogue observations, never a valuation of the collector's copy. */
export function cardMarket(entry: CatalogEntry): HTMLElement {
  const section = el('section', 'w-card-market');
  section.setAttribute('aria-label', 'Preis und Bezugsquelle');
  const basis = entry.price?.basis;
  const priceKind = {
    trend: 'Katalogtrend',
    avg7: '7-Tage-Verkaufsdurchschnitt',
    avg30: '30-Tage-Verkaufsdurchschnitt',
    avg: 'Verkaufsdurchschnitt',
  };
  const heading = el(
    'p',
    'w-label',
    `Cardmarket · ${basis ? priceKind[basis] : 'Katalogtrend'}`,
  );
  section.append(heading);
  if (entry.price) {
    const date = new Date(entry.price.updated);
    const time = el(
      'time',
      'w-muted',
      `Stand ${date.toLocaleDateString('de-DE')}`,
    );
    time.dateTime = date.toISOString();
    section.append(
      el(
        'div',
        'w-market-quote',
        el(
          'strong',
          '',
          new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
          }).format(entry.price.amount),
        ),
        time,
      ),
    );
  } else
    section.append(
      el(
        'p',
        'w-muted',
        'Für diese Ausgabe ist kein datierter EUR-Preis verfügbar.',
      ),
    );
  section.append(
    el(
      'p',
      'w-help',
      entry.price?.provenance === 'official-export'
        ? 'Aus Cardmarkets Tagespreisführer für die verifizierte Druckausgabe. Kein Echtzeit- oder deutschsprachiger Near-Mint-Angebotspreis.'
        : entry.price?.provenance === 'verified-snapshot'
          ? 'Direkt geprüfter Cardmarket-Trend vom angegebenen Tag, kein Livepreis und nicht auf deutsche Near-Mint-Angebote gefiltert.'
        : 'Orientierung aus dem Katalog. Sprache, Zustand und Druckvariante deines Exemplars können den Preis verändern.',
    ),
  );
  if (entry.cardmarketUrl) {
    const link = el(
      'a',
      'w-button w-button-secondary',
      el('span', '', 'Auf Cardmarket ansehen'),
      icon('external'),
    );
    link.href = entry.cardmarketUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    section.append(link);
  } else
    section.append(
      el(
        'p',
        'w-help',
        'Für diese Ausgabe ist kein eindeutiger Cardmarket-Link hinterlegt.',
      ),
    );
  return section;
}
