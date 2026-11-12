import { test, expect } from './fixtures';
import { openVault } from './navigation';

for (const source of ['cardmarket', 'tcgplayer', 'fx-unavailable'] as const) {
  test(`collection, details and portfolio share one EUR value: ${source}`, async ({
    page,
  }) => {
    let exactRequests = 0;
    let fxRequests = 0;
    await page.route('https://api.frankfurter.dev/**', (route) => {
      fxRequests++;
      return source === 'fx-unavailable'
        ? route.fulfill({ status: 503, body: 'Rate unavailable' })
        : route.fulfill({
            json: {
              base: 'USD',
              quote: 'EUR',
              date: new Date().toISOString().slice(0, 10),
              rate: 0.9,
            },
          });
    });
    await page.route('https://api.tcgdex.net/**', async (route) => {
      if (!route.request().url().endsWith('/de/cards/sv01-211'))
        return route.fulfill({ status: 503, body: 'Unavailable in test' });
      exactRequests++;
      return route.fulfill({
        json: {
          id: 'sv01-211',
          localId: '211',
          name: 'Trasla',
          set: {
            id: 'sv01',
            name: 'Karmesin & Purpur',
            cardCount: { official: 198 },
          },
          variants: { normal: false, holo: true, reverse: false },
          pricing: {
            ...(source === 'cardmarket'
              ? {
                  cardmarket: {
                    unit: 'EUR',
                    updated: '2026-11-09T12:00:00Z',
                    trend: 32.36,
                  },
                }
              : {}),
            tcgplayer: {
              unit: 'USD',
              updated: '2026-11-09T12:00:00Z',
              holofoil: { marketPrice: 45.25, productId: 9876 },
            },
          },
        },
      });
    });
    await page.goto('./#sammlung');
    await page
      .getByRole('button', { name: 'Mit Demo ausprobieren', exact: true })
      .click();
    await expect(page.locator('.w-owned-grid button')).toHaveCount(18);
    const unknown = page
      .locator('.w-owned-grid button')
      .filter({ hasText: 'Floink' });
    await expect(unknown.locator('.w-price-value')).toHaveText('—');
    await expect(unknown.locator('.w-price-note')).toHaveText(
      'Keine sichere Preisreferenz',
    );
    const priced = page
      .locator('.w-owned-grid button')
      .filter({ hasText: 'Trasla' });
    const amount =
      source === 'cardmarket'
        ? /32,36\s*€/
        : source === 'tcgplayer'
          ? /40,73\s*€/
          : '—';
    await expect(priced.locator('.w-price-value')).toHaveText(amount);
    await expect(priced.locator('.w-price-note')).toContainText(
      source === 'fx-unavailable'
        ? 'momentan nicht erreichbar'
        : source === 'cardmarket'
          ? 'Trendpreis'
          : 'EZB-Kurs',
    );
    await priced.click();
    const detail = page.getByRole('dialog', { name: 'Trasla' });
    await expect(
      detail.locator('.w-holding-price > .w-price-value'),
    ).toHaveText(amount);
    const comparison = detail.getByRole('region', {
      name: 'TCGplayer · EUR-Referenz',
    });
    if (source === 'cardmarket') {
      await expect(comparison).toContainText(/40,73\s*€/);
      await expect(comparison).toContainText('EZB-Referenzkurs');
      await expect(detail.locator('.w-holding-price > .w-label')).toContainText(
        'Cardmarket',
      );
    } else if (source === 'tcgplayer') {
      await expect(comparison).toHaveCount(0); // do not repeat the primary fallback quote
      await expect(detail.locator('.w-holding-price > .w-label')).toContainText(
        'TCGplayer',
      );
      await expect(
        detail.getByRole('link', { name: 'Auf TCGplayer ansehen' }),
      ).toHaveAttribute('href', 'https://www.tcgplayer.com/product/9876');
    } else
      await expect(comparison).toContainText(
        'Umrechnung ist momentan nicht verfügbar',
      );
    await expect(detail).not.toContainText(/45,25\s*\$/);
    await detail.getByRole('button', { name: /schließen$/ }).click();
    await openVault(page, 'portfolio');
    await expect(page.locator('.w-portfolio-load-progress')).toHaveCount(0);
    await expect(page.locator('.w-portfolio-balance')).toHaveText(amount);
    expect(exactRequests).toBe(1);
    expect(fxRequests).toBe(1);
  });
}
