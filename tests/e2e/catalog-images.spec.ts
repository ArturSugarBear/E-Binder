import { openVault } from './navigation';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function catalogue(page: Page, englishImages: boolean) {
  await page.route('**/catalog-art/**', (route) =>
    route.fulfill({ json: { version: 1, sets: {} } }),
  );
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
  await main.locator('.w-catalog-filter-panel > summary').click();
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
  await openVault(page, 'sammlung');
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
  await expect(
    main
      .getByRole('group', { name: 'Katalogsprache' })
      .getByRole('radio', { name: 'Deutsch' }),
  ).toBeChecked();
  await expect(main.locator('.w-search-results')).not.toHaveClass(
    /w-text-results/,
  );
  expect(api.details).toEqual([]);
});

async function secondaryArtwork(page: Page) {
  await page.route('**/catalog-art/index.json', (route) =>
    route.fulfill({
      json: {
        version: 1,
        sets: {
          me06: {
            cards: 'me06.json',
            logo: ['https://images.pokemontcg.io/me6/logo.png'],
            symbol: [],
          },
        },
      },
    }),
  );
  await page.route('**/catalog-art/me06.json', (route) =>
    route.fulfill({
      json: {
        setId: 'me06',
        cards: {
          '001': {
            url: 'https://images.pokemontcg.io/me6/1_hires.png',
            language: 'en',
            providerId: 'me6-1',
          },
        },
      },
    }),
  );
  await page.route('https://images.pokemontcg.io/**', (route) =>
    route.fulfill({ path: 'public/assets/cards/svi-211.webp' }),
  );
}

test('missing primary metadata uses an exact secondary printing and labels English art', async ({
  page,
}) => {
  await catalogue(page, false);
  await secondaryArtwork(page);
  await page.goto('./#entdecken?setId=me06');
  const art = page.locator('.w-search-results .card-art').first();
  await art.scrollIntoViewIfNeeded();
  await expect(art.locator('img')).toHaveAttribute(
    'src',
    'https://images.pokemontcg.io/me6/1_hires.png',
  );
  await expect(art).toHaveAttribute('data-image-state', 'loaded');
  await expect(art.locator('.w-art-language')).toHaveText('Bild: EN');
  await expect(
    page.getByRole('radio', { name: 'Deutsch', exact: true }),
  ).toBeChecked();
});

test('HTTP-failed primary artwork falls back without changing the requested card', async ({
  page,
}) => {
  await catalogue(page, true);
  await secondaryArtwork(page);
  await page.route('https://assets.tcgdex.net/**', (route) =>
    route.fulfill({ status: 404, body: 'missing image' }),
  );
  await page.goto('./#entdecken?setId=me06');
  const art = page.locator('.w-search-results .card-art').first();
  await art.scrollIntoViewIfNeeded();
  await expect(art).toHaveAttribute('data-image-source', 'secondary');
  await expect(art).toHaveAttribute('data-image-state', 'loaded');
  await expect(art.locator('img')).toHaveAttribute(
    'src',
    'https://images.pokemontcg.io/me6/1_hires.png',
  );
  await expect(page.locator('.w-search-results button').first()).toContainText(
    'Skaraborn',
  );
});

test('set galleries resolve a secondary logo when the primary has none', async ({
  page,
}) => {
  await catalogue(page, false);
  await secondaryArtwork(page);
  await page.goto('./#entdecken');
  await expect(page.locator('.w-set-symbol img').first()).toHaveAttribute(
    'src',
    'https://images.pokemontcg.io/me6/logo.png',
  );
});

test('MEP promos use the verified product image in discovery and details without creating ownership', async ({
  page,
}) => {
  const set = {
    id: 'mep',
    name: 'MEP Black Star Promos',
    cardCount: { official: 0, total: 112 },
  };
  const cards = [
    {
      id: 'mep-029',
      localId: '029',
      name: 'Mega-Glurak X-ex',
      set,
      variants: { normal: false, holo: true },
    },
    {
      id: 'mep-080',
      localId: '080',
      name: 'Fynx',
      set,
      variants: { normal: false, holo: true },
    },
  ];
  let providerApiCalls = 0;
  await page.route('https://tcgcsv.com/**', (route) => {
    providerApiCalls++;
    return route.abort();
  });
  await page.route('https://tcgplayer-cdn.tcgplayer.com/**', (route) =>
    route.fulfill({ path: 'public/assets/cards/svi-211.webp' }),
  );
  await page.route('https://api.tcgdex.net/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const matched = cards.find((card) => path.endsWith(`/cards/${card.id}`));
    const value = path.endsWith('/graphql')
      ? {
          data: {
            set: { ...set, cards: cards.map(({ id }) => ({ id })) },
            cards,
          },
        }
      : (matched ??
        (path.endsWith('/sets/mep')
          ? { ...set, cards }
          : path.endsWith('/sets')
            ? [set]
            : path.endsWith('/series/tcgp')
              ? { id: 'tcgp', sets: [] }
              : []));
    return route.fulfill({ json: value });
  });
  await page.goto('./#entdecken?lang=de&setId=mep');
  const results = page.locator('.w-search-results');
  await expect(results.locator('button')).toHaveCount(2);
  const fynx = results.locator('button').filter({ hasText: 'Fynx' });
  await expect(fynx.locator('img')).toHaveAttribute(
    'src',
    'https://tcgplayer-cdn.tcgplayer.com/product/694694_200w.jpg',
  );
  await expect(fynx.locator('.w-art-language')).toHaveText('Bild: EN');
  const charizard = results
    .locator('button')
    .filter({ hasText: 'Mega-Glurak' });
  await expect(charizard.locator('img')).toHaveAttribute(
    'src',
    'https://tcgplayer-cdn.tcgplayer.com/product/680639_200w.jpg',
  );
  await fynx.click();
  const detail = page.getByRole('dialog');
  await expect(detail.locator('.card-art img').first()).toHaveAttribute(
    'src',
    'https://tcgplayer-cdn.tcgplayer.com/product/694694_200w.jpg',
  );
  await detail.getByRole('button', { name: /schließen$/ }).click();
  await openVault(page, 'sammlung');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  expect(providerApiCalls).toBe(0);
});
