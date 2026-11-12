import { openVault } from './navigation';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function catalogue(page: Page) {
  let fail = false;
  const searches: URL[] = [];
  const mega = {
    id: 'me01',
    name: 'Mega-Entwicklung',
    cardCount: { official: 132, total: 25 },
  };
  const shiny = {
    id: 'sv04.5',
    name: 'Paldeas Schicksale',
    cardCount: { official: 91, total: 1 },
  };
  const cards = Array.from({ length: 25 }, (_, index) => ({
    id: `me01-${String(index + 1).padStart(3, '0')}`,
    localId: String(index + 1).padStart(3, '0'),
    name: index === 1 ? 'Porygon2' : `Testkarte ${index + 1}`,
    image: `https://assets.tcgdex.net/de/me/me01/${index + 1}`,
    rarity: index === 24 ? 'Selten' : 'Häufig',
    illustrator: index === 24 ? 'Artist B' : 'Artist A',
    set: mega,
  }));
  const special = {
    id: 'sv04.5-001',
    localId: '001',
    name: 'Schillerndes Beispiel',
    image: 'https://assets.tcgdex.net/de/sv/sv04.5/001',
    rarity: 'Shiny Rare',
    illustrator: 'Artist B',
    set: shiny,
  };
  await page.route('https://assets.tcgdex.net/**', (route) =>
    route.fulfill({ path: 'public/assets/cards/svi-211.webp' }),
  );
  await page.route('https://api.tcgdex.net/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/v2/graphql') {
      if (fail) return route.fulfill({ status: 503, body: 'Unavailable' });
      const id = route.request().postDataJSON().variables.set;
      const chosen = id === mega.id ? mega : shiny;
      const entries = id === mega.id ? cards : [special];
      return route.fulfill({
        json: {
          data: {
            set: { ...chosen, cards: entries.map(({ id }) => ({ id })) },
            cards: [
              ...entries,
              {
                ...special,
                id: 'me01-classic-001',
                set: { id: 'me01-classic' },
              },
            ],
          },
        },
      });
    }
    const path = url.pathname.split('/').slice(3).join('/');
    let json: unknown;
    if (path === 'sets') json = [mega, shiny];
    else if (path === 'series') json = [{ id: 'me', name: 'Mega-Entwicklung' }];
    else if (path === 'series/tcgp') json = { id: 'tcgp', sets: [] };
    else if (path === 'rarities') json = ['Häufig', 'Selten', 'Shiny Rare'];
    else if (path === 'illustrators')
      json = ['Artist A', 'Artist B', 'Falscher Artist'];
    else if (path.startsWith('cards/')) {
      const card = [...cards, special].find(
        (card) => card.id === path.slice(6),
      );
      json = { ...card, variants: { normal: true } };
    } else if (path === 'cards') {
      searches.push(url);
      const chosen = url.searchParams.get('set.id')?.slice(3);
      let found = chosen === mega.id ? cards : [special];
      const rarity = url.searchParams.get('rarity')?.slice(3);
      const artist = url.searchParams.get('illustrator')?.slice(3);
      if (rarity) found = found.filter((card) => card.rarity === rarity);
      if (artist) found = found.filter((card) => card.illustrator === artist);
      const start =
        (Number(url.searchParams.get('pagination:page') ?? 1) - 1) * 24;
      json = found.slice(start, start + 24);
    } else json = [];
    await route.fulfill({ json });
  });
  return {
    searches,
    fail: (value: boolean) => {
      fail = value;
    },
  };
}

test('set filters exclude impossible rarities and show a genuine example beyond the first result page', async ({
  page,
}) => {
  const api = await catalogue(page);
  await page.goto(
    './#entdecken?setId=me01&rarity=Shiny+Rare&artist=Falscher+Artist',
  );
  const main = page.getByRole('main');
  await main.locator('.w-catalog-filter-panel > summary').click();
  const rarity = main.getByLabel('Seltenheit', { exact: true });
  await expect(rarity).toBeEnabled();
  await expect(rarity.locator('option')).toHaveText([
    'Alle Seltenheiten',
    'Häufig',
    'Selten',
  ]);
  await expect(main.getByLabel('Illustrator im Katalog')).toHaveValue('');
  await expect(main.locator('datalist option')).toHaveCount(2);
  await expect(main.locator('.w-set-filter-status')).toContainText(
    'wurden zurückgesetzt',
  );
  await expect(main.locator('.w-search-results button')).toHaveCount(24);
  expect(
    api.searches.every(
      (url) =>
        !url.searchParams.has('rarity') && !url.searchParams.has('illustrator'),
    ),
  ).toBe(true);
  await expect(page).not.toHaveURL(/rarity=|artist=/);
  await main.getByLabel('Karte suchen', { exact: true }).fill('Porygon2');
  await expect(main.locator('.w-search-results button')).toHaveCount(1);
  await expect(main.locator('.w-search-results')).toContainText('Porygon2');
  await main.getByLabel('Karte suchen', { exact: true }).fill('');
  await rarity.selectOption('Selten');
  await expect(main.locator('.w-search-results button')).toHaveCount(1);
  await expect(main.locator('.w-rarity-selected')).toContainText(
    'Testkarte 25 025/132',
  );
  await expect(main.locator('.w-rarity-selected')).toContainText('Sternsymbol');
  await main
    .locator('.w-rarity-selected')
    .getByRole('button', { name: 'Beispielkarte ansehen', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', {
      name: 'Testkarte 25',
      level: 2,
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog).toContainText('025/132 · DE');
  await expect(dialog).toContainText('Artist B');
  await dialog
    .getByRole('button', { name: 'Testkarte 25 schließen', exact: true })
    .click();
  await main
    .getByText('Seltenheiten verstehen – mit Beispielkarten', { exact: true })
    .click();
  await expect(
    main.locator('.w-rarity-examples .w-rarity-example'),
  ).toHaveCount(2);
  await expect(main.locator('.w-rarity-examples')).toContainText(
    '24 Karten im Set',
  );
  await openVault(page, 'sammlung');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('changing sets replaces rarity and illustrator choices; clearing the set restores catalogue-wide choices', async ({
  page,
}) => {
  await catalogue(page);
  await page.goto('./#entdecken?setId=me01&rarity=Selten&artist=Artist+A');
  const main = page.getByRole('main');
  await main.locator('.w-catalog-filter-panel > summary').click();
  const rarity = main.getByLabel('Seltenheit', { exact: true });
  await expect(rarity.locator('option')).toHaveCount(3);
  await main.getByLabel('Set', { exact: true }).selectOption('sv04.5');
  await expect(rarity.locator('option')).toHaveText([
    'Alle Seltenheiten',
    'Shiny Rare',
  ]);
  await expect(rarity).toHaveValue('');
  await expect(main.getByLabel('Illustrator im Katalog')).toHaveValue('');
  await expect(main.locator('datalist option')).toHaveCount(1);
  await rarity.selectOption('Shiny Rare');
  await expect(main.locator('.w-rarity-selected')).toContainText(
    'schillernden Farbvariante',
  );
  await main
    .getByRole('button', { name: 'Setfilter entfernen', exact: true })
    .click();
  await expect(rarity.locator('option')).toHaveCount(4);
  await expect(main.locator('.w-rarity-help')).toBeHidden();
});

test('failed facet requests preserve a selected filter until retry can verify and correct it', async ({
  page,
}) => {
  const api = await catalogue(page);
  api.fail(true);
  await page.goto('./#entdecken?setId=me01&rarity=Shiny+Rare');
  const main = page.getByRole('main');
  await main.locator('.w-catalog-filter-panel > summary').click();
  const rarity = main.getByLabel('Seltenheit', { exact: true });
  await expect(
    main.getByRole('button', { name: 'Setfilter erneut laden', exact: true }),
  ).toBeVisible();
  await expect(rarity).toBeDisabled();
  await expect(rarity).toHaveValue('Shiny Rare');
  expect(api.searches).toHaveLength(0);
  api.fail(false);
  await main
    .getByRole('button', { name: 'Setfilter erneut laden', exact: true })
    .click();
  await expect(rarity.locator('option')).toHaveText([
    'Alle Seltenheiten',
    'Häufig',
    'Selten',
  ]);
  await expect(rarity).toBeEnabled();
  await expect(rarity).toHaveValue('');
  await expect(main.locator('.w-search-results button')).toHaveCount(24);
});

test('iPhone Discover gives set logos and card imagery enough visual space', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await catalogue(page);
  await page.goto('./#entdecken');
  const setTile = page.locator('.w-discover .w-set-choice').first();
  await expect(setTile).toBeVisible();
  const tileSize = await setTile.boundingBox();
  expect(tileSize).not.toBeNull();
  expect(tileSize!.width).toBeGreaterThan(150);
  expect(tileSize!.height).toBeGreaterThan(130);
  await setTile.click();
  const art = page.locator('.w-discover .w-search-results .card-art').first();
  await expect(art).toBeVisible();
  expect((await art.boundingBox())!.width).toBeGreaterThan(125);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(391);
});
