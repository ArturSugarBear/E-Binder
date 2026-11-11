import { test, expect } from './fixtures';

test('missing provider set logos use readable identities on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.route('**/catalog-art/index.json', (route) =>
    route.fulfill({ json: { version: 1, sets: {} } }),
  );
  const entries = [
    {
      id: '30th-c',
      name: '30 Jahre: Klassische Sammlung',
      cardCount: { official: 30 },
    },
    {
      id: 'mep',
      name: 'MEP Black Star Promos',
      cardCount: { official: 80 },
    },
    {
      id: 'mee',
      name: 'Mega-Entwicklung Energie',
      cardCount: { official: 16 },
    },
  ];
  await page.route('https://api.tcgdex.net/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/sets')) return route.fulfill({ json: entries });
    if (path.endsWith('/series/tcgp'))
      return route.fulfill({ json: { id: 'tcgp', sets: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto('./#entdecken');
  for (const [name, mark] of [
    ['30 Jahre: Klassische Sammlung', '30'],
    ['MEP Black Star Promos', 'MEP'],
    ['Mega-Entwicklung Energie', 'MEE'],
  ]) {
    const tile = page.getByRole('button', { name });
    await expect(tile.locator('.w-set-fallback-mark')).toHaveText(mark);
    await expect(tile.locator('.w-set-symbol img')).toHaveCount(0);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
