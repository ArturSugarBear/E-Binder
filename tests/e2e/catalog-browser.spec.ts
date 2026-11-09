import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const set = {
  id: 'sv10',
  name: 'Ewige Rivalen',
  logo: 'https://assets.tcgdex.net/de/sv/sv10/logo',
  cardCount: { official: 182, total: 3 },
};
const resumes = [
  {
    id: 'sv10-001',
    localId: '001',
    name: 'Pinsir',
    image: 'https://assets.tcgdex.net/de/sv/sv10/001',
  },
  {
    id: 'sv10-002',
    localId: '002',
    name: 'Yanma',
    image: 'https://assets.tcgdex.net/de/sv/sv10/002',
  },
  {
    id: 'sv10-003',
    localId: '003',
    name: 'Yanmega-ex',
    image: 'https://assets.tcgdex.net/de/sv/sv10/003',
  },
];
async function catalogue(page: Page): Promise<string[]> {
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
    let json: unknown;
    if (graphql)
      json = {
        data: {
          set: { ...set, cards: resumes.map(({ id }) => ({ id })) },
          cards: resumes.map((card) => ({
            ...card,
            rarity: 'Häufig',
            illustrator: 'GIDORA',
            set: { id: set.id },
          })),
        },
      };
    else if (path === 'sets')
      json = [
        { ...set, name: lang === 'en' ? 'Destined Rivals' : set.name },
        {
          id: 'base1',
          name: 'Grundset',
          cardCount: { official: 102, total: 102 },
        },
      ];
    else if (path === 'series')
      json = [{ id: 'sv', name: 'Karmesin & Purpur' }];
    else if (path === 'series/sv') json = { id: 'sv', sets: [set] };
    else if (path === 'series/tcgp') json = { id: 'tcgp', sets: [] };
    else if (path === 'illustrators') json = ['GIDORA', 'Tomokazu Komiya'];
    else if (path === 'rarities') json = ['Häufig', 'Selten'];
    else if (path === 'sets/sv10') json = { ...set, cards: resumes };
    else if (path === 'cards/base1-4')
      json = {
        id: 'base1-4',
        localId: '4',
        name: 'Glurak',
        set: {
          ...set,
          id: 'base1',
          name: 'Grundset',
          cardCount: { official: 102 },
        },
        illustrator: 'Mitsuhiro Arita',
        variants: { holo: true },
      };
    else if (path.startsWith('cards/')) {
      const id = path.slice(6);
      const card = resumes.find((item) => item.id === id)!;
      json = {
        ...card,
        set,
        illustrator: 'GIDORA',
        rarity: 'Häufig',
        variants: { normal: true },
        pricing: {
          cardmarket: {
            unit: 'EUR',
            updated: '2026-11-09T00:00:00Z',
            trend: id.endsWith('001') ? 2 : id.endsWith('002') ? 0.1 : 0,
          },
        },
      };
    } else if (path === 'cards') {
      if (url.searchParams.has('id'))
        json = [
          {
            id: 'base1-4',
            localId: '4',
            name: 'Charizard',
            image: 'https://assets.tcgdex.net/en/base/base1/4',
          },
        ];
      else if (url.searchParams.get('name')?.includes('Glurak'))
        json = [{ id: 'base1-4', localId: '4', name: 'Glurak' }];
      else {
        const num = url.searchParams.get('localId')?.replace('eq:', '');
        json = num ? resumes.filter((item) => item.localId === num) : resumes;
      }
    } else json = [];
    await route.fulfill({ json });
  });
  await page.route('https://assets.tcgdex.net/**', (route) =>
    route.fulfill({ path: 'public/assets/cards/svi-211.webp' }),
  );
  return requests;
}
async function open(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('.w-welcome-art img')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
}

test('German search shows matching English artwork with language label and a separate missing-confirmation message', async ({
  page,
}) => {
  await catalogue(page);
  await open(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Karte suchen', { exact: true }).fill('Glurak');
  await expect(dialog.locator('.w-search-results')).toContainText(
    'Grundset · 4/102',
  );
  await expect(dialog.locator('.w-search-results .w-art-language')).toHaveText(
    'Bild: EN',
  );
  await expect(dialog.locator('.w-search-results img')).toHaveAttribute(
    'src',
    'https://assets.tcgdex.net/en/base/base1/4/high.webp',
  );
  await dialog.locator('.w-search-results button').click();
  await expect(
    dialog.getByRole('heading', { name: 'Glurak', exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel('Druckvariante', { exact: true })
    .selectOption('holo');
  await dialog
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Die Druckvariante ist ausgewählt.',
  );
  await dialog
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await dialog
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
});

test('set discovery accepts English aliases, resolves printed leading zeros, and combines catalogue filters', async ({
  page,
}) => {
  const requests = await catalogue(page);
  await open(page);
  const dialog = page.getByRole('dialog');
  await dialog
    .getByText('Sets und Illustratoren entdecken', { exact: true })
    .click();
  await dialog
    .getByLabel('Set suchen', { exact: true })
    .fill('Destined Rivals');
  await dialog.getByRole('button', { name: /Ewige Rivalen/ }).click();
  await expect(dialog.locator('.w-selected-set')).toContainText(
    'Ewige Rivalen',
  );
  await expect(dialog.locator('.w-search-results button')).toHaveCount(3);
  await dialog.getByLabel('Karte suchen', { exact: true }).fill('1/182');
  await expect(dialog.locator('.w-search-results button')).toHaveCount(1);
  await expect(dialog.locator('.w-search-results')).toContainText('001/182');
  await dialog.getByLabel('Illustrator im Katalog').fill('GIDORA');
  await dialog.getByLabel('Seltenheit', { exact: true }).selectOption('Häufig');
  await expect(dialog.locator('.w-search-results button')).toHaveCount(1);
  await expect(dialog.locator('.w-search-results')).toContainText('001/182');
  expect(
    requests.some(
      (url) =>
        new URL(url).pathname.endsWith('/cards') &&
        new URL(url).searchParams.has('illustrator'),
    ),
  ).toBe(false);
});

test('price sorting considers the complete selected set and places unavailable prices last', async ({
  page,
}) => {
  await catalogue(page);
  await open(page);
  const dialog = page.getByRole('dialog');
  await dialog
    .getByText('Sets und Illustratoren entdecken', { exact: true })
    .click();
  await expect(
    dialog.getByLabel('Set', { exact: true }).locator('option'),
  ).toHaveCount(3);
  await dialog.getByLabel('Set', { exact: true }).selectOption('sv10');
  await expect(dialog.locator('.w-search-results button')).toHaveCount(3);
  await dialog
    .getByRole('group', { name: 'Katalog sortieren' })
    .getByRole('radio', { name: 'Preis: niedrig zuerst' })
    .check();
  await expect(
    dialog.locator('.w-search-results .w-card-caption strong'),
  ).toHaveText(['Yanma', 'Pinsir', 'Yanmega-ex']);
  await expect(dialog.locator('.w-catalog-price').last()).toHaveText(
    'Preis unbekannt',
  );
  await expect(dialog.locator('.w-catalog-browser')).toContainText(
    'Cardmarket-Katalogtrends',
  );
  await expect(dialog.locator('.w-catalog-price').first()).toContainText(
    '0,10',
  );
});

test('empty artist recommendations explain missing inventory and open the global illustrator catalogue', async ({
  page,
}) => {
  await catalogue(page);
  await page.goto('./');
  await expect(page.locator('.w-welcome-art img')).toHaveCount(3);
  await page.getByRole('link', { name: 'Meine Binder', exact: true }).click();
  await page
    .getByRole('button', { name: 'Ersten Binder anlegen', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Name deines Binders')
    .fill('Artistseite');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Speichern', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Seiten vorschlagen', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('group', { name: '1. Was soll diese Seite verbinden?' })
    .getByRole('radio', { name: 'Ein bestimmter Illustrator' })
    .check();
  await expect(
    dialog.getByLabel('Illustrator aus deinem Bestand'),
  ).toBeDisabled();
  await expect(dialog.locator('.w-artist-empty')).toContainText(
    'bestätigter Bestand ist noch leer',
  );
  await expect(
    dialog.getByRole('button', { name: 'Vorschläge ansehen', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole('button', {
      name: 'Illustratoren im Katalog entdecken',
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole('dialog', { name: 'Karten hinzufügen', exact: true })
      .getByLabel('Illustrator im Katalog'),
  ).toBeVisible();
  await expect(
    page.getByRole('dialog').locator('.w-catalog-discovery'),
  ).toHaveAttribute('open', '');
});

test('discovery price links keep their requested sorting after metadata loads', async ({
  page,
}) => {
  await catalogue(page);
  await page.goto('./#entdecken?setId=sv10&order=price-desc');
  const main = page.getByRole('main');
  await expect(
    main.locator('.w-search-results .w-card-caption strong'),
  ).toHaveText(['Pinsir', 'Yanma', 'Yanmega-ex']);
  await expect(
    main
      .getByRole('group', { name: 'Katalog sortieren' })
      .getByRole('radio', { name: 'Preis: hoch zuerst' }),
  ).toBeChecked();
  await page.reload();
  await expect(
    main.locator('.w-search-results .w-card-caption strong'),
  ).toHaveText(['Pinsir', 'Yanma', 'Yanmega-ex']);
});
