import { test, expect } from './fixtures';
import { openVault } from './navigation';

test('Zenith spelling finds the real Zenit der Könige set, even in card search', async ({
  page,
}) => {
  await page.route('https://api.tcgdex.net/v2/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/v2/')[1]!.replace(/^(de|en)\//, '');
    const set = {
      id: 'swsh12.5',
      name: 'Zenit der Könige',
      cardCount: { official: 159, total: 160 },
    };
    const english = { ...set, name: 'Crown Zenith' };
    let data: unknown = [];
    if (path === 'sets') {
      data = url.pathname.includes('/en/') ? [english] : [set];
    } else if (path === 'series/tcgp') {
      data = { id: 'tcgp', sets: [] };
    } else if (path === 'series') {
      data = [{ id: 'swsh', name: 'Schwert & Schild' }];
    } else if (path === 'cards') {
      data = [];
    } else if (path === 'sets/swsh12.5') {
      data = { ...set, cards: [] };
    }
    return route.fulfill({ json: data });
  });
  await page.goto('./#entdecken');
  const main = page.getByRole('main');
  const setSearch = main.getByLabel('Set suchen', { exact: true });
  await expect(main.locator('.w-set-choice')).toHaveCount(1);
  await setSearch.fill('Zenith der Könige');
  await expect(main.locator('.w-set-choice')).toHaveCount(1);
  await expect(
    main.getByRole('button', { name: /Zenit der Könige/ }),
  ).toBeVisible();
  await setSearch.fill('Zenith der Koenige');
  await expect(main.locator('.w-set-choice')).toHaveCount(1);
  await main
    .getByRole('group', { name: 'Katalog erkunden' })
    .getByRole('button', { name: 'Karten suchen' })
    .click();
  await main
    .getByLabel('Karte suchen', { exact: true })
    .fill('Zenith der Könige');
  await expect(
    main.locator('.w-catalog-set-suggestions').getByRole('button', {
      name: /Zenit der Könige/,
    }),
  ).toBeVisible();
});

test('portfolio shows the demo collection without inventing values when the price API fails', async ({
  page,
}) => {
  // Deliberate failure-path regression: valid prints still have no value
  // when their actual pricing source is unavailable.
  await page.route('https://api.tcgdex.net/v2/de/cards/**', (route) =>
    route.fulfill({ status: 503, body: 'Price source unavailable' }),
  );
  await page.goto('./#sammlung');
  await page.getByRole('button', { name: 'Mit Demo ausprobieren' }).click();
  await openVault(page, 'portfolio');
  await expect(
    page.getByRole('heading', { name: 'Deine Sets im Überblick' }),
  ).toBeVisible();
  await expect(page.locator('.w-portfolio-set-row').first()).toBeVisible();
  await expect(page.locator('.w-portfolio-missing-card').first()).toBeVisible();
  await expect(page.locator('.w-portfolio-balance')).toHaveText('—');
  await page.locator('.w-portfolio-missing-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('binder-page scanning opens a real 3x3 camera with safe photo fallback', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException('Camera denied', 'NotAllowedError');
        },
      },
    });
  });
  await page.goto('./#home');
  await page
    .getByRole('main')
    .getByRole('button', { name: /Binderseite scannen/ })
    .click();
  const parent = page.getByRole('dialog', {
    name: 'Binderseiten scannen',
    exact: true,
  });
  await parent
    .getByRole('button', { name: 'Binderseite live scannen' })
    .click();
  const camera = page.getByRole('dialog', {
    name: 'Binderseite live scannen',
    exact: true,
  });
  await expect(camera.locator('.w-live-page-cell')).toHaveCount(9);
  await expect(camera.locator('.w-live-status')).toContainText(
    'Kamera nicht verfügbar',
  );
  const chooser = page.waitForEvent('filechooser');
  await camera
    .getByRole('button', { name: 'Stattdessen Foto auswählen' })
    .click();
  const picker = await chooser;
  await picker.setFiles('public/assets/cards/svi-211.webp');
  await expect(parent).toBeVisible();
  await expect(parent.locator('.w-page-scan-pocket')).toHaveCount(9, {
    timeout: 15_000,
  });
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('an exact confirmed German card receives a real EUR trend and a valued set bar', async ({
  page,
}) => {
  await page.route('https://api.tcgdex.net/v2/de/cards/sv01-211', (route) =>
    route.fulfill({
      json: {
        id: 'sv01-211',
        localId: '211',
        name: 'Trasla',
        set: {
          id: 'sv01',
          name: 'Karmesin & Purpur',
          cardCount: { official: 198 },
        },
        variants: { normal: true },
        pricing: {
          cardmarket: {
            unit: 'EUR',
            updated: '2026-11-09T12:00:00.000Z',
            trend: 9.5,
            idProduct: 123,
          },
        },
      },
    }),
  );
  await page.goto('./#portfolio');
  await page.evaluate(async () => {
    const request = indexedDB.open('e-binder-personal', 2);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = '2026-11-09T12:00:00.000Z';
    const card = {
      key: 'tcgdex:de:sv01-211',
      name: 'Trasla',
      setName: 'Karmesin & Purpur',
      setId: 'sv01',
      number: '211/198',
      language: 'de',
      image: '',
      source: 'tcgdex',
      sourceId: 'sv01-211',
      artist: '',
      artistSource: 'unknown',
      evolvesFrom: '',
      stage: '',
      finishes: ['normal', 'holo', 'reverse'],
    };
    const state = {
      schemaVersion: 1,
      revision: 0,
      mode: 'personal',
      holdings: [
        {
          id: 'real-test-holding',
          card,
          finish: 'normal',
          variantNote: '',
          quantity: 2,
          tradeQuantity: 0,
          favorite: false,
          notes: '',
          confirmed: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      binders: [],
      wishes: [],
      captures: [],
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('states', 'readwrite');
      transaction.objectStore('states').put(state, 'personal');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator('.w-portfolio-balance')).toContainText('19,00');
  await expect(page.locator('.w-portfolio-set-row')).toContainText(
    '2 Exemplare',
  );
  await expect(page.locator('.w-portfolio-leader')).toHaveCount(1);
  await expect(page.locator('.w-portfolio-missing-card')).toHaveCount(0);
});
