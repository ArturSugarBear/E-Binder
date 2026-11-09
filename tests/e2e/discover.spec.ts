import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function catalogue(page: Page) {
  const requests: string[] = [];
  await page.route('https://api.tcgdex.net/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.toString());
    const graphql = url.pathname === '/v2/graphql';
    const lang = graphql
      ? route.request().postDataJSON().variables.lang
      : url.pathname.split('/')[2];
    const path = graphql
      ? 'graphql'
      : url.pathname.split('/').slice(3).join('/');
    const seriesId = lang === 'ja' ? 'SV' : 'sv';
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
    if (lang === 'ja')
      sets.push({
        id: 'SM1+',
        name: 'サン＆ムーン',
        cardCount: { official: 51 },
      });
    const cards = Array.from({ length: 25 }, (_, index) => ({
      id: `sv10-${String(index + 1).padStart(3, '0')}`,
      localId: String(index + 1).padStart(3, '0'),
      name: `Karte ${index + 1}`,
      image: `https://assets.tcgdex.net/${lang}/sv/sv10/${index + 1}`,
    }));
    let json: unknown;
    if (graphql)
      json = {
        data: {
          set: { ...chosen, cards: cards.map(({ id }) => ({ id })) },
          cards: cards.map((card) => ({
            ...card,
            rarity: 'Häufig',
            illustrator: 'GIDORA',
            set: { id: chosen.id },
          })),
        },
      };
    else if (path === 'sets') json = sets;
    else if (path === 'series')
      json = [
        { id: 'base', name: 'Grund' },
        {
          id: seriesId,
          name:
            lang === 'ja' ? 'スカーレット&バイオレット' : 'Karmesin & Purpur',
        },
        { id: 'tcgp', name: 'Pocket' },
      ];
    else if (path === 'series/sv' || path === 'series/SV')
      json = { id: seriesId, sets: [chosen] };
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
        pricing: {
          cardmarket: {
            unit: 'EUR',
            updated: '2026-11-08T23:49:36.795Z',
            trend: path.endsWith('001') ? 31.04 : 0,
            idProduct: path.endsWith('001') ? 907758 : undefined,
          },
        },
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
  const skip = page.getByRole('link', {
    name: 'Zum Inhalt springen',
    exact: true,
  });
  await skip.focus();
  await skip.press('Enter');
  await expect(main).toBeFocused();
  await expect(page).toHaveURL(/#entdecken$/);
  await expect(main.locator('.w-set-choice')).toHaveCount(24, {
    timeout: 15_000,
  });
  await expect(main.getByLabel('Reihe / Ära').locator('option')).toHaveCount(3);
  expect(requests.some((url) => new URL(url).pathname.endsWith('/cards'))).toBe(
    false,
  );
  await main
    .getByRole('button', { name: 'Weitere Sets anzeigen (8)', exact: true })
    .click();
  await expect(main.locator('.w-set-choice')).toHaveCount(32);
  await main.getByLabel('Reihe / Ära').selectOption('sv');
  await expect(main.locator('.w-set-choice')).toHaveCount(1, {
    timeout: 15_000,
  });
  await main.getByLabel('Set suchen', { exact: true }).fill('Destined Rivals');
  await main.getByRole('button', { name: /Ewige Rivalen/ }).click();
  await expect(main.locator('.w-search-results button')).toHaveCount(24, {
    timeout: 15_000,
  });
  await expect(page).toHaveURL(/setId=sv10/);
  await page.goBack();
  await expect(main.locator('.w-set-choice')).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(main.locator('.w-search-results button')).toHaveCount(0);
});

test('deep links restore filters and paging; wish actions retain the catalogue without creating ownership', async ({
  page,
}) => {
  await catalogue(page);
  await page.goto('./#entdecken?setId=sv10&page=2&artist=GIDORA&rarity=Häufig');
  const main = page.getByRole('main');
  await expect(main.locator('.w-search-results button')).toHaveCount(1, {
    timeout: 15_000,
  });
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
  await expect(main.locator('.w-search-results button')).toBeFocused();
  await expect(main.locator('.w-catalog-owned')).toHaveText('Gemerkt');
  await expect(main.getByLabel('Illustrator im Katalog')).toHaveValue('GIDORA');
  await page.reload();
  await expect(main.locator('.w-search-results button')).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(main.locator('.w-catalog-owned')).toHaveText('Gemerkt');
  await page.getByRole('link', { name: 'Sammlung', exact: true }).click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page.goBack();
  await expect(main.locator('.w-search-results button')).toHaveCount(1, {
    timeout: 15_000,
  });
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
  await expect(main.locator('.w-search-results button')).toHaveCount(1, {
    timeout: 15_000,
  });
  await main
    .getByRole('group', { name: 'Katalogsprache' })
    .getByRole('radio', { name: 'Japanisch' })
    .check();
  await expect(main.getByLabel('Set', { exact: true })).toHaveValue('');
  await expect(main.getByLabel('Seltenheit', { exact: true })).toHaveValue('');
  await expect
    .poll(() => requests.some((url) => url.includes('/ja/cards?')))
    .toBe(true);
  await main.getByLabel('Karte suchen', { exact: true }).fill('');
  await expect(main.locator('.w-set-choice')).toHaveCount(24, {
    timeout: 15_000,
  });
  await main.getByLabel('Reihe / Ära').selectOption('SV');
  await expect(main.locator('.w-set-choice')).toHaveCount(1, {
    timeout: 15_000,
  });
  await main.getByRole('button', { name: /ロケット団/ }).click();
  await expect(main.locator('.w-search-results button')).toHaveCount(24, {
    timeout: 15_000,
  });
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
  await page.route('https://api.tcgdex.net/v2/graphql', async (route) => {
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
  await expect(main.locator('.w-search-results button')).toHaveCount(24, {
    timeout: 15_000,
  });
});

test('card details expose a dated EUR trend and an exact external listing without creating ownership', async ({
  page,
}) => {
  await catalogue(page);
  await page.goto('./#entdecken?setId=sv10');
  const main = page.getByRole('main');
  const card = main.locator('.w-search-results button').first();
  await expect(card).toBeVisible();
  await card.click();
  const dialog = page.getByRole('dialog');
  const market = dialog.getByRole('region', { name: 'Preis und Bezugsquelle' });
  await expect(market).toContainText('31,04');
  await expect(market.locator('time')).toHaveAttribute(
    'datetime',
    '2026-11-08T23:49:36.795Z',
  );
  await expect(
    market.getByRole('link', { name: 'Auf Cardmarket ansehen' }),
  ).toHaveAttribute(
    'href',
    'https://www.cardmarket.com/en/Pokemon/Products?idProduct=907758',
  );
  await expect(market.getByRole('link')).toHaveAttribute('target', '_blank');
  await expect(dialog).toContainText('Noch nicht im Bestand');
  await expect(dialog).toContainText('Zustand und Druckvariante');
  expect(
    (await new AxeBuilder({ page }).include('.w-dialog').analyze()).violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
  await main.locator('.w-search-results button').nth(1).click();
  await expect(dialog).toContainText('kein datierter EUR-Preis');
  await expect(dialog.locator('a')).toHaveCount(0);
  await expect(dialog).not.toContainText('0,00');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Sammlung', exact: true }).click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('collection choices work directly and by keyboard while keeping cards near the top on mobile', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Mit Demo ausprobieren', exact: true })
    .click();
  const main = page.getByRole('main');
  await expect(main.locator('.w-owned-grid button')).toHaveCount(18);
  const view = main.getByRole('group', { name: 'Ansicht', exact: true });
  await view.getByRole('radio', { name: 'Lieblinge', exact: true }).check();
  await expect(
    view.getByRole('radio', { name: 'Lieblinge', exact: true }),
  ).toBeChecked();
  await view.getByRole('radio', { name: 'Alle Karten', exact: true }).check();
  await expect(main.locator('.w-owned-grid button')).toHaveCount(18);
  const all = view.getByRole('radio', { name: 'Alle Karten', exact: true });
  await all.focus();
  await all.press('ArrowRight');
  await expect(view.getByRole('radio', { name: 'Freie Karten' })).toBeChecked();
  await expect(view.getByRole('radio', { name: 'Freie Karten' })).toBeFocused();
  await view.getByRole('radio', { name: 'Alle Karten', exact: true }).check();
  await main
    .getByText('Sortieren: Zuletzt hinzugefügt', { exact: true })
    .click();
  await main.getByRole('radio', { name: 'Nach Name', exact: true }).check();
  await expect(main.locator('.w-sort-panel summary')).toHaveText(
    'Sortieren: Nach Name',
  );
  await main.locator('.w-sort-panel summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  const first = await main
    .locator('.w-owned-grid button')
    .first()
    .boundingBox();
  expect(first!.y).toBeLessThan(844);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include('#workspace-main').analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('link', { name: 'Meine Binder', exact: true }).click();
  await expect(
    main.getByRole('heading', { name: 'Mein Beispielbinder', exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole('combobox', { name: 'Binder auswählen' }),
  ).toHaveCount(0);
});
