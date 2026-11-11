import { test, expect } from './fixtures';

test('sets without verified artwork show intentional Rare Room identities, not generated SVG placeholders', async ({
  page,
}) => {
  const placeholders: string[] = [];
  await page.route('**/catalog-art/index.json', (route) =>
    route.fulfill({
      json: {
        version: 1,
        sets: {
          '30th-c': { logo: [], symbol: [], placeholder: 'set-30th-c.svg' },
          mep: { logo: [], symbol: [], placeholder: 'set-mep.svg' },
          mee: { logo: [], symbol: [], placeholder: 'set-mee.svg' },
        },
      },
    }),
  );
  await page.route('**/catalog-art/set-*.svg', (route) => {
    placeholders.push(route.request().url());
    return route.fulfill({ status: 404, body: 'Not an official logo' });
  });
  const entries = [
    { id: '30th-c', name: '30 Jahre: Klassische Sammlung' },
    { id: 'mep', name: 'MEP Black Star Promos' },
    { id: 'mee', name: 'Mega-Entwicklung Energie' },
    { id: 'me01', name: 'Mega-Entwicklung', logo: 'https://assets.tcgdex.net/de/me/me01/logo' },
  ].map((set) => ({ ...set, cardCount: { official: 30 } }));
  await page.route('https://assets.tcgdex.net/**', (route) =>
    route.fulfill({ path: 'public/assets/cards/svi-211.webp' }),
  );
  await page.route('https://api.tcgdex.net/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/sets'))
      return route.fulfill({ json: entries });
    if (path.endsWith('/series/tcgp'))
      return route.fulfill({ json: { id: 'tcgp', sets: [] } });
    if (path.endsWith('/series'))
      return route.fulfill({ json: [] });
    if (path.endsWith('/rarities') || path.endsWith('/illustrators'))
      return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, body: 'Not mocked' });
  });

  await page.goto('./#entdecken');
  const gallery = page.locator('.w-discover .w-set-grid');
  await expect(gallery.locator('button.w-set-choice')).toHaveCount(4);

  for (const [name, mark, caption] of [
    ['30 Jahre: Klassische Sammlung', '30', 'KLASSIK'],
    ['MEP Black Star Promos', 'MEP', 'PROMO'],
    ['Mega-Entwicklung Energie', 'MEE', 'ENERGIE'],
  ]) {
    const tile = gallery.getByRole('button', { name });
    await expect(tile.locator('.w-set-symbol')).toHaveAttribute(
      'data-image-state',
      'unavailable',
    );
    await expect(tile.locator('.w-set-fallback-mark')).toHaveText(mark);
    await expect(tile.locator('.w-set-fallback-caption')).toHaveText(caption);
    await expect(tile.locator('.w-set-symbol img')).toHaveCount(0);
  }
  expect(placeholders).toEqual([]);

  const withLogo = gallery.getByRole('button', {
    name: 'Mega-Entwicklung',
    exact: true,
  });
  await expect(withLogo.locator('.w-set-symbol')).toHaveAttribute(
    'data-image-state',
    'loaded',
  );
  await expect(withLogo.locator('.w-set-symbol img')).toHaveCount(1);
});

test('missing-logo identities fit narrow mobile set cards', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.route('**/catalog-art/index.json', (route) =>
    route.fulfill({
      json: { version: 1, sets: { mep: { logo: [], symbol: [], placeholder: 'set-mep.svg' } } },
    }),
  );
  await page.route('https://api.tcgdex.net/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/sets'))
      return route.fulfill({
        json: [{ id: 'mep', name: 'MEP Black Star Promos', cardCount: { official: 80 } }],
      });
    if (path.endsWith('/series/tcgp'))
      return route.fulfill({ json: { id: 'tcgp', sets: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto('./#entdecken');
  const tile = page.getByRole('button', { name: 'MEP Black Star Promos' });
  await expect(tile.locator('.w-set-fallback-mark')).toHaveText('MEP');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
