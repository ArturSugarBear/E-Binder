import { test, expect } from './fixtures';

// Preserve the explicit catalogue fixture's line layout for this regression.
// prettier-ignore
test('collection prices match exact cards', async ({ page }) => {
  let exactRequests = 0;
  await page.route('https://api.tcgdex.net/**', async (route) => {
    if (route.request().url().endsWith('/de/cards/sv01-211')) {
      exactRequests++;
      await route.fulfill({
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
            cardmarket: {
              unit: 'EUR',
              updated: '2026-11-09T12:00:00Z',
              trend: 32.36,
            },
            tcgplayer: {
              unit: 'USD',
              updated: '2026-11-09T12:00:00Z',
              holofoil: { marketPrice: 45.25, productId: 9876 },
            },
          },
        },
      });
      return;
    }
    await route.fulfill({ status: 503, body: 'Unavailable in test' });
  });

  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Mit Demo ausprobieren', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(18);

  // The editorial placeholder "Floink" has no verified printing ID.
  const unpriced = page.locator('.w-owned-grid button').filter({
    hasText: 'Floink',
  });
  await expect(unpriced.locator('.w-price-value')).toHaveText('—');
  await expect(unpriced.locator('.w-price-note')).toHaveText(
    'Keine sichere Preisreferenz',
  );

  // The verified holo-only "Trasla" printing may use its exact EUR trend.
  const priced = page.locator('.w-owned-grid button').filter({
    hasText: 'Trasla',
  });
  await expect(priced.locator('.w-price-value')).toHaveText(/32,36\s*€/);
  await expect(priced.locator('.w-price-note')).toHaveText(
    'Trendpreis (nicht NM-gefiltert) · Stand 9.11.2026',
  );
  await priced.click();
  const detail = page.getByRole('dialog', { name: 'Trasla' });
  await expect(detail.locator('.w-holding-price .w-price-value')).toHaveText(
    /32,36\s*€/,
  );
  await expect(
    detail.locator('.w-holding-price .w-price-note'),
  ).toContainText('Trendpreis');
  const comparison = detail.getByRole('region', { name: 'TCGplayer · USD-Marktvergleich' });
  await expect(comparison).toContainText(/45,25\s*\$/);
  await expect(comparison).toContainText('Holo · Marktpreis');
  await expect(comparison).toContainText('kein Bestandteil');
  await expect(comparison.getByRole('link', { name: 'Auf TCGplayer ansehen' })).toHaveAttribute('href', 'https://www.tcgplayer.com/product/9876');
  await expect(detail.locator('.w-holding-price > .w-price-value')).toHaveText(/32,36\s*€/);
  expect(exactRequests).toBe(1);
});
