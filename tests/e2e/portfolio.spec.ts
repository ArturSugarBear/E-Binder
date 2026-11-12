import { openVault } from './navigation';
import { test, expect } from './fixtures';
import { emptyState } from '../../src/domain/personal';

test('all catalogue prices load in a bounded queue even when only the FX service fails, preserving in-flight artwork', async ({
  page,
}) => {
  let releaseFirst!: () => void;
  let releaseRest!: () => void;
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const rest = new Promise<void>((resolve) => {
    releaseRest = resolve;
  });
  let requested = 0;
  let active = 0;
  let peak = 0;
  let fxRequests = 0;
  await page.route('https://api.frankfurter.dev/**', (route) => {
    fxRequests++;
    return route.fulfill({ status: 503, body: 'FX service unavailable' });
  });
  await page.route('https://api.tcgdex.net/v2/de/cards/**', async (route) => {
    requested++;
    active++;
    peak = Math.max(peak, active);
    await (requested <= 4 ? first : rest);
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const localId = id.slice('sv01-'.length);
    await route.fulfill({
      json: {
        id,
        localId,
        name: `Testkarte ${localId}`,
        set: {
          id: 'sv01',
          name: 'Karmesin & Purpur',
          cardCount: { official: 198 },
        },
        variants: { normal: true, holo: false },
        pricing: {
          ...(Number(localId) <= 4
            ? {
                tcgplayer: {
                  unit: 'USD',
                  updated: '2026-11-10T12:00:00Z',
                  normal: { marketPrice: 3, productId: 1000 + Number(localId) },
                },
              }
            : {
                cardmarket: {
                  unit: 'EUR',
                  updated: '2026-11-10T12:00:00Z',
                  trend: 2,
                },
              }),
        },
      },
    });
    active--;
  });
  const state = emptyState();
  state.holdings = Array.from({ length: 42 }, (_, index) => {
    const localId = String(index + 1).padStart(3, '0');
    return {
      id: `own-${localId}`,
      card: {
        key: `tcgdex:de:sv01-${localId}`,
        source: 'tcgdex' as const,
        sourceId: `sv01-${localId}`,
        name: `Testkarte ${localId}`,
        setName: 'Karmesin & Purpur',
        setId: 'sv01',
        number: `${localId}/198`,
        language: 'de',
        image: 'assets/cards/svi-211.webp',
        artist: '',
        artistSource: 'unknown' as const,
        evolvesFrom: '',
        stage: '',
        finishes: ['normal' as const],
      },
      finish: 'normal' as const,
      variantNote: '',
      quantity: 1,
      tradeQuantity: 0,
      favorite: false,
      notes: '',
      confirmed: true as const,
      createdAt: '2026-11-10T12:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z',
    };
  });
  await page.goto('./#home');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page.evaluate(async (snapshot) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('e-binder-personal', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('states', 'readwrite');
      transaction.objectStore('states').put(snapshot, 'personal');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, state);
  await page.goto('./#portfolio');
  await page.reload();
  const progress = page.locator('.w-portfolio-load-progress');
  await expect(progress).toBeVisible();
  await expect.poll(() => requested).toBe(4);
  await expect(page.locator('.w-portfolio-caption')).toContainText(
    'noch zu prüfen',
  );
  await page
    .locator('.w-portfolio-missing-card .card-art')
    .first()
    .evaluate((node) => {
      node.setAttribute('data-retained-art', 'true');
    });
  releaseFirst();
  await expect(progress).toHaveJSProperty('value', 4);
  await expect.poll(() => requested).toBe(8);
  await expect(page.locator('[data-retained-art="true"]')).toHaveCount(1);
  releaseRest();
  await expect.poll(() => requested, { timeout: 30_000 }).toBe(42);
  await expect(progress).toHaveCount(0);
  await expect(page.locator('.w-portfolio-balance')).toHaveText(/76,00\s*€/);
  await expect(page.locator('.w-portfolio-caption')).toContainText('38 von 42');
  expect(fxRequests).toBe(1);
  expect(peak).toBeLessThanOrEqual(4);
  await expect(
    page.getByRole('button', { name: 'Weitere 40 Karten prüfen' }),
  ).toHaveCount(0);
});

test('portfolio opens directly without inventing a zero market price', async ({
  page,
}) => {
  await page.goto('./#portfolio');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(
    page.getByRole('heading', { name: 'Dein Portfolio', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.w-portfolio-balance')).toHaveText('—');
  await expect(
    page.getByRole('heading', { name: 'Wert deiner Binder' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Portfolio' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test('portfolio reports partial coverage in demo and links to binder pages', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  await page.getByRole('button', { name: 'Mit Demo ausprobieren' }).click();
  await openVault(page, 'portfolio');
  await expect(page.locator('.w-portfolio-balance')).toBeVisible();
  await expect(page.locator('.w-portfolio-binder')).toHaveCount(1);
  await page.locator('.w-portfolio-binder summary').click();
  await expect(
    page.locator('.w-portfolio-pages > button').first(),
  ).toBeVisible();
  await page.locator('.w-portfolio-pages > button').first().click();
  await expect(page).toHaveURL(/#binder$/);
  await expect(
    page.getByRole('heading', { name: 'Deine Binder', exact: true }),
  ).toBeVisible();
});

test('late price responses preserve an opened binder', async ({ page }) => {
  let release!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://api.tcgdex.net/**', async (route) => {
    await responseGate;
    await route.fulfill({
      status: 503,
      body: 'Unavailable for regression test',
    });
  });
  await page.goto('./#sammlung');
  await page.getByRole('button', { name: 'Mit Demo ausprobieren' }).click();
  await openVault(page, 'portfolio');
  await expect(page.locator('.w-portfolio-load-progress')).toBeVisible();
  await page.locator('.w-portfolio-binder summary').click();
  await expect(page.locator('.w-portfolio-binder')).toHaveAttribute('open', '');
  release();
  await expect(page.locator('.w-portfolio-load-progress')).toHaveCount(0);
  await expect(page.locator('.w-portfolio-binder')).toHaveAttribute('open', '');
  await page.locator('.w-portfolio-pages > button').first().click();
  await expect(page).toHaveURL(/#binder$/);
});
