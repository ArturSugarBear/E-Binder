import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function catalogue(page: Page, englishImages: boolean) {
  const details: string[] = [];
  const assets: string[] = [];
  const set = {
    id: 'me06',
    name: 'Delta-Herrschaft',
    cardCount: { official: 103, total: 141 },
  };
  const cards = Array.from({ length: 141 }, (_, index) => ({
    id: `me06-${String(index + 1).padStart(3, '0')}`,
    localId: String(index + 1).padStart(3, '0'),
    name: index === 0 ? 'Skaraborn' : `Testkarte ${index + 1}`,
    rarity: 'Häufig',
    illustrator: 'Artist',
    set: { id: 'me06' },
  }));
  await page.route('https://assets.tcgdex.net/**', (route) => {
    assets.push(route.request().url());
    return route.fulfill({ path: 'public/assets/cards/svi-211.webp' });
  });
  await page.route('https://api.tcgdex.net/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/v2/graphql')
      return route.fulfill({
        json: {
          data: {
            set: { ...set, cards: cards.map(({ id }) => ({ id })) },
            cards,
          },
        },
      });
    const lang = url.pathname.split('/')[2];
    const path = url.pathname.split('/').slice(3).join('/');
    let json: unknown;
    if (path === 'sets') json = [set];
    else if (path === 'sets/me06')
      json = {
        ...set,
        cards: cards.map((card) => ({
          ...card,
          image: englishImages
            ? `https://assets.tcgdex.net/en/me/me06/${card.localId}`
            : undefined,
        })),
      };
    else if (path === 'series/tcgp') json = { id: 'tcgp', sets: [] };
    else if (path === 'series') json = [];
    else if (path === 'illustrators') json = ['Artist'];
    else if (path === 'rarities') json = ['Häufig'];
    else if (path === 'cards')
      json =
        englishImages && lang === 'en'
          ? cards.map((card) => ({
              ...card,
              image: `https://assets.tcgdex.net/en/me/me06/${card.localId}`,
            }))
          : [];
    else if (path.startsWith('cards/')) {
      details.push(url.toString());
      json = { ...cards[0], set, variants: { normal: true } };
    } else json = [];
    return route.fulfill({ json });
  });
  return { details, assets };
}

test('missing provider artwork is a compact catalogue list and an honest rarity explanation, not a wall of empty pictures', async ({
  page,
}) => {
  const api = await catalogue(page, false);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('./#entdecken?setId=me06');
  const main = page.getByRole('main');
  await expect(main.locator('.w-search-results button')).toHaveCount(24, {
    timeout: 15000,
  });
  await expect(main.locator('.w-set-filter-status')).toContainText(
    'TCGdex liefert für diese Ausgaben derzeit keine Kartenbilder',
  );
  await expect(main.locator('.w-search-results')).toHaveClass(/w-text-results/);
  await expect(main.locator('.w-search-results .card-art')).toHaveCount(0);
  await expect(main.locator('.w-search-results')).toContainText('Skaraborn');
  await expect(main.locator('.w-search-results')).toContainText('001/103');
  const box = await main
    .locator('.w-search-results button')
    .first()
    .boundingBox();
  expect(box!.height).toBeLessThan(130);
  await main.getByLabel('Seltenheit', { exact: true }).selectOption('Häufig');
  await expect(main.locator('.w-rarity-selected')).toContainText(
    'noch kein Beispielbild',
  );
  await expect(main.locator('.w-rarity-selected img')).toHaveCount(0);
  await expect(
    main
      .locator('.w-rarity-selected')
      .getByRole('button', { name: 'Kartendaten ansehen', exact: true }),
  ).toBeVisible();
  expect(api.details).toEqual([]);
  expect(api.assets).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await main
    .getByRole('button', { name: 'Weitere Karten', exact: true })
    .click();
  await expect(main.locator('.w-search-results')).toContainText('025/103');
  await page.getByRole('link', { name: 'Sammlung', exact: true }).click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('paired English set artwork appears in both results and rarity examples with a visible language badge', async ({
  page,
}) => {
  const api = await catalogue(page, true);
  await page.goto('./#entdecken?setId=me06&rarity=Häufig');
  const main = page.getByRole('main');
  await expect(main.locator('.w-search-results button')).toHaveCount(24, {
    timeout: 15000,
  });
  await expect(main.locator('.w-search-results img').first()).toHaveAttribute(
    'src',
    'https://assets.tcgdex.net/en/me/me06/001/high.webp',
  );
  await expect(
    main.locator('.w-search-results .w-art-language').first(),
  ).toHaveText('Bild: EN');
  await expect(main.locator('.w-rarity-selected img')).toHaveAttribute(
    'src',
    'https://assets.tcgdex.net/en/me/me06/001/high.webp',
  );
  await expect(main.locator('.w-rarity-selected .w-art-language')).toHaveText(
    'Bild: EN',
  );
  await expect(main.getByLabel('Katalogsprache')).toHaveValue('de');
  await expect(main.locator('.w-search-results')).not.toHaveClass(
    /w-text-results/,
  );
  expect(api.details).toEqual([]);
});
