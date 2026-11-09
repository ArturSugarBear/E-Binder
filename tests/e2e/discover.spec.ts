import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function catalogue(page: Page) {
  const requests: string[] = [];
  await page.route('https://api.tcgdex.net/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.toString());
    const lang = url.pathname.split('/')[2];
    const path = url.pathname.split('/').slice(3).join('/');
    const chosen = {
      id: 'sv10',
      name:
        lang === 'ja'
          ? 'ロケット団の栄光'
          : lang === 'en'
            ? 'Destined Rivals'
            : 'Ewige Rivalen',
      cardCount: { official: 182, total: 25 },
    };
    const old = { id: 'base1', name: 'Grundset', cardCount: { official: 102 } };
    const sets = [
      chosen,
      old,
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `test${index}`,
        name: `Testset ${index}`,
        cardCount: { official: 1 },
      })),
    ];
    const cards = Array.from({ length: 25 }, (_, index) => ({
      id: `sv10-${String(index + 1).padStart(3, '0')}`,
      localId: String(index + 1).padStart(3, '0'),
      name: `Karte ${index + 1}`,
      image: `https://assets.tcgdex.net/${lang}/sv/sv10/${index + 1}`,
    }));
    let json: unknown;
    if (path === 'sets') json = sets;
    else if (path === 'series')
      json = [
        { id: 'base', name: 'Grund' },
        { id: 'sv', name: 'Karmesin & Purpur' },
        { id: 'tcgp', name: 'Pocket' },
      ];
    else if (path === 'series/sv') json = { id: 'sv', sets: [chosen] };
    else if (path === 'series/base') json = { id: 'base', sets: [old] };
    else if (path === 'series/tcgp') json = { id: 'tcgp', sets: [] };
    else if (path === 'illustrators') json = ['GIDORA'];
    else if (path === 'rarities') json = ['Häufig', 'Selten'];
    else if (path === 'sets/sv10') json = { ...chosen, cards };
    else if (path.startsWith('cards/'))
      json = {
        ...cards.find((card) => card.id === path.slice(6)),
        set: chosen,
        illustrator: 'GIDORA',
        variants: { normal: true },
        rarity: 'Häufig',
      };
    else if (path === 'cards') {
      const number = url.searchParams.get('localId')?.replace('eq:', '');
      const start =
        (Number(url.searchParams.get('pagination:page') || 1) - 1) * 24;
      json = number
        ? cards.filter((card) => card.localId === number)
        : cards.slice(start, start + 24);
    } else return route.fulfill({ status: 404, body: 'Not found' });
    await route.fulfill({ json });
  });
  await page.route('https://assets.tcgdex.net/**', (route) =>
    route.fulfill({ path: 'public/assets/cards/svi-211.webp' }),
  );
  return requests;
}

test('discovery exposes every physical set and actual series membership without searching arbitrary cards', async ({
  page,
}) => {
  const requests = await catalogue(page);
  await page.goto('./#entdecken');
  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { name: 'Karten entdecken' }),
  ).toBeVisible();
  await expect(main.locator('.w-set-choice')).toHaveCount(24);
  await expect(main.getByLabel('Reihe / Ära').locator('option')).toHaveCount(3);
  expect(requests.some((url) => new URL(url).pathname.endsWith('/cards'))).toBe(
    false,
  );
  await main
    .getByRole('button', { name: 'Weitere Sets anzeigen (8)', exact: true })
    .click();
  await expect(main.locator('.w-set-choice')).toHaveCount(32);
  await main.getByLabel('Reihe / Ära').selectOption('sv');
  await expect(main.locator('.w-set-choice')).toHaveCount(1);
  await main.getByLabel('Set suchen', { exact: true }).fill('Destined Rivals');
  await main.getByRole('button', { name: /Ewige Rivalen/ }).click();
  await expect(main.locator('.w-search-results button')).toHaveCount(24);
  await expect(page).toHaveURL(/setId=sv10/);
  await page.goBack();
  await expect(main.locator('.w-set-choice')).toHaveCount(1);
  await expect(main.locator('.w-search-results button')).toHaveCount(0);
});

test('deep links restore filters and paging; wish actions retain the catalogue without creating ownership', async ({
  page,
}) => {
  await catalogue(page);
  await page.goto('./#entdecken?setId=sv10&page=2&artist=GIDORA&rarity=Häufig');
  const main = page.getByRole('main');
  await expect(main.locator('.w-search-results button')).toHaveCount(1);
  await expect(main.locator('.w-search-results')).toContainText('025/182');
  await main.locator('.w-search-results button').click();
  const preview = page.getByRole('dialog');
  await expect(preview).toContainText('Noch nicht im Bestand');
  await preview
    .getByRole('button', { name: 'Auf die Wunschliste', exact: true })
    .click();
  await expect(
    preview.getByRole('button', {
      name: 'Auf deiner Wunschliste',
      exact: true,
    }),
  ).toBeDisabled();
  await preview
    .getByRole('button', { name: 'Karte 25 schließen', exact: true })
    .click();
  await expect(main.locator('.w-catalog-owned')).toHaveText('Gemerkt');
  await expect(main.getByLabel('Illustrator im Katalog')).toHaveValue('GIDORA');
  await page.reload();
  await expect(main.locator('.w-search-results button')).toHaveCount(1);
  await expect(main.locator('.w-catalog-owned')).toHaveText('Gemerkt');
  await page.getByRole('link', { name: 'Sammlung', exact: true }).click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page.goBack();
  await expect(main.locator('.w-search-results button')).toHaveCount(1);
  await main.locator('.w-search-results button').click();
  await preview
    .getByRole('button', { name: 'Zum Bestand hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    exact: true,
  });
  await add.getByLabel('Druckvariante', { exact: true }).selectOption('normal');
  await add
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await add
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await expect(main.locator('.w-catalog-owned')).toContainText('1× im Bestand');
  await expect(main.getByLabel('Set', { exact: true })).toHaveValue('sv10');
  await expect(main.getByLabel('Illustrator im Katalog')).toHaveValue('GIDORA');
});

test('changing catalogue language clears incompatible filters and keeps Japanese discovery usable at 320px', async ({
  page,
}) => {
  const requests = await catalogue(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('./#entdecken?setId=sv10&query=1&rarity=Häufig');
  const main = page.getByRole('main');
  await expect(main.locator('.w-search-results button')).toHaveCount(1);
  await main.getByLabel('Katalogsprache').selectOption('ja');
  await expect(main.getByLabel('Set', { exact: true })).toHaveValue('');
  await expect(main.getByLabel('Seltenheit', { exact: true })).toHaveValue('');
  await expect
    .poll(() => requests.some((url) => url.includes('/ja/cards?')))
    .toBe(true);
  await main.getByLabel('Karte suchen', { exact: true }).fill('');
  await expect(main.locator('.w-set-choice')).toHaveCount(24);
  await main.getByLabel('Reihe / Ära').selectOption('sv');
  await expect(main.locator('.w-set-choice')).toHaveCount(1);
  await main.getByRole('button', { name: /ロケット団/ }).click();
  await expect(main.locator('.w-search-results button')).toHaveCount(24);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('catalogue failures can be retried without losing the chosen set or creating cards', async ({
  page,
}) => {
  await catalogue(page);
  let fail = true;
  await page.route('https://api.tcgdex.net/v2/de/cards?*', async (route) => {
    if (fail) return route.fulfill({ status: 503, body: 'Unavailable' });
    await route.fallback();
  });
  await page.goto('./#entdecken?setId=sv10');
  const main = page.getByRole('main');
  await expect(main).toContainText(
    'Der Kartenkatalog ist gerade nicht erreichbar.',
  );
  await expect(main.getByLabel('Set', { exact: true })).toHaveValue('sv10');
  fail = false;
  await main
    .getByRole('button', { name: 'Suche wiederholen', exact: true })
    .click();
  await expect(main.locator('.w-search-results button')).toHaveCount(24);
});
