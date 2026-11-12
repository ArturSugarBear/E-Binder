import type { CatalogEntry, TcgplayerReference } from '../data/card-catalog';
import { el, icon } from './workspace-dom';
import { convertedMarketReference, usdEurRate } from '../data/exchange-rates';

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
      entry.price?.provenance === 'verified-snapshot'
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
  section.append(tcgplayerMarket(Object.values(entry.tcgplayer ?? {})));
  return section;
}

/** Keep the market, currency, variant and observation date together. */
export function tcgplayerMarket(
  references: readonly TcgplayerReference[],
): HTMLElement {
  const section = el('section', 'w-tcgplayer-market');
  section.setAttribute('aria-label', 'TCGplayer · EUR-Referenz');
  section.append(el('p', 'w-label', 'TCGplayer · EUR-Referenz'));
  const values = el('div', 'w-tcgplayer-values');
  section.append(values);
  if (!references.length)
    values.append(
      el(
        'p',
        'w-muted',
        'Für diese Ausgabe ist derzeit keine verlässliche TCGplayer-Referenz verfügbar.',
      ),
    );
  if (references.length) {
    values.append(el('p', 'w-muted', 'EUR-Referenz wird geladen …'));
    void usdEurRate().then((rate) => {
      if (!section.isConnected) return;
      values.replaceChildren();
      if (!rate) {
        values.append(
          el(
            'p',
            'w-muted',
            'Die EUR-Umrechnung ist momentan nicht verfügbar.',
          ),
        );
        return;
      }
      for (const reference of references) {
        const converted = convertedMarketReference(reference, rate);
        if (!converted) continue;
        const time = el(
          'time',
          'w-muted',
          `Stand ${new Date(reference.updated).toLocaleDateString('de-DE')}`,
        );
        time.dateTime = reference.updated;
        values.append(
          el(
            'div',
            'w-market-quote',
            el(
              'strong',
              '',
              new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
              }).format(converted.amount),
            ),
            el(
              'span',
              '',
              reference.variant === 'holo'
                ? 'Holo · Marktpreis'
                : 'Normal · Marktpreis',
            ),
            time,
          ),
        );
        if (reference.productUrl) {
          const link = el(
            'a',
            'w-button w-button-secondary',
            'Auf TCGplayer ansehen',
            icon('external'),
          );
          link.href = reference.productUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          values.append(link);
        }
      }
      values.append(
        el(
          'p',
          'w-help',
          `Aus USD mit EZB-Referenzkurs vom ${new Date(rate.date).toLocaleDateString('de-DE')} umgerechnet. Sprache und Zustand deines Exemplars können abweichen.`,
        ),
      );
    });
  }
  return section;
}
