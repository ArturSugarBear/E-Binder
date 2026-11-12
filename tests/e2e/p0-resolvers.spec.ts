import observations from '../../src/data/cardmarket-observations.json' with { type: 'json' };
import { test, expect } from './fixtures';
import {
  emptyState,
  type PersonalCard,
  type Holding,
} from '../../src/domain/personal';
import ja from '../fixtures/provider/ja-M1L-088.json' with { type: 'json' };
import product from '../fixtures/provider/tcgp-647197.json' with { type: 'json' };
import de from '../fixtures/provider/de-me01-077.json' with { type: 'json' };
import inkay from '../fixtures/provider/de-me06-113.json' with { type: 'json' };
import talonflame from '../fixtures/provider/de-me06-124.json' with { type: 'json' };
import growlithe from '../fixtures/provider/de-me06-106.json' with { type: 'json' };

for (const width of [320, 390, 430]) {
  test(`P0 exact printing prices, Japanese title/art, modal and dock clearance at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    const cards = [inkay, talonflame, growlithe, ja];
    await page.route('https://api.tcgdex.net/**', (route) => {
      const url = route.request().url();
      const raw = url.includes('/en/cards?')
        ? [{ id: de.id, name: 'Mega Lucario ex' }]
        : url.includes('/de/cards/' + de.id)
          ? de
          : cards.find((c) => url.endsWith('/cards/' + c.id));
      return raw
        ? route.fulfill({ json: raw })
        : route.fulfill({ status: 404 });
    });
    await page.route('**/catalog-products/tcgplayer/**', (route) =>
      route.fulfill({ json: product }),
    );
    await page.route('https://tcgplayer-cdn.tcgplayer.com/**', (route) =>
      route.fulfill({ path: 'public/assets/cards/svi-211.webp' }),
    );
    await page.route('**/catalog-art/**', (route) =>
      route.fulfill({ json: { version: 1, sets: {} } }),
    );
    const state = emptyState();
    const stamp = new Date().toISOString();
    state.holdings = cards.map((raw, index): Holding => ({
      id: `p0-${index}`,
      card: {
        key: `tcgdex:${index === 3 ? 'ja' : 'de'}:${raw.id}`,
        source: 'tcgdex',
        sourceId: raw.id,
        name: raw.name,
        setId: raw.set.id,
        setName: raw.set.name,
        number: `${raw.localId}/${raw.set.cardCount.official}`,
        language: index === 3 ? 'ja' : 'de',
        image: '',
        artist: '',
        artistSource: 'unknown',
        evolvesFrom: '',
        stage: '',
        finishes: [index === 3 ? 'holo' : 'normal'],
      } as PersonalCard,
      finish: index === 3 ? 'holo' : 'normal',
      variantNote: '',
      quantity: 1,
      tradeQuantity: 0,
      favorite: false,
      notes: '',
      confirmed: true,
      createdAt: stamp,
      updatedAt: stamp,
    }));
    state.binders = [
      {
        id: 'p0-binder',
        name: 'P0 Binder',
        isPublic: false,
        pages: [
          {
            id: 'p0-page',
            title: 'Seite 1',
            assembled: false,
            slots: Array.from({ length: 9 }, (_, i) =>
              i < 4
                ? {
                    kind: 'owned',
                    holdingId: `p0-${i}`,
                    copy: 1,
                    locked: false,
                  }
                : null,
            ),
          },
        ],
      },
    ];
    await page.goto('./#home');
    await expect(page.locator('#workspace-main')).toHaveAttribute(
      'data-ready',
      'true',
    );
    await page.evaluate(async (snapshot) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open('e-binder-personal', 2);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('states', 'readwrite');
        tx.objectStore('states').put(snapshot, 'personal');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, state);
    await page.goto('./#portfolio');
    await page.reload();
    await expect(page.locator('.w-portfolio-balance')).toHaveText(
      new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(
        42.45 +
          observations.prices['918952'].trend +
          observations.prices['918963'].trend +
          observations.prices['918943'].trend,
      ),
    );
    await expect(page.locator('.w-portfolio-missing-card')).toHaveCount(0);
    const binder = page.locator('.w-portfolio-binder');
    await binder.scrollIntoViewIfNeeded();
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const bounds = await page.evaluate(() => ({
      binder: document
        .querySelector('.w-portfolio-binder')!
        .getBoundingClientRect().bottom,
      nav: document.querySelector('.w-mobile-nav')!.getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(bounds.binder).toBeLessThan(bounds.nav);
    expect(bounds.overflow).toBeLessThanOrEqual(1);
    await page.goto('./#sammlung');
    const card = page
      .locator('.w-owned-grid button')
      .filter({ hasText: 'メガルカリオex' });
    await expect(card).toContainText('メガルカリオex (Mega-Lucario-ex)');
    await expect(card.locator('.card-art')).toHaveAttribute(
      'data-image-state',
      'loaded',
    );
    await expect(card.locator('.w-art-language')).toBeHidden();
    await expect(card.locator('img')).toHaveAttribute(
      'src',
      /647197_in_1000x1000.jpg$/,
    );
    await card.click();
    const dialog = page.getByRole('dialog', {
      name: 'メガルカリオex (Mega-Lucario-ex)',
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('.w-holding-price > .w-price-value'),
    ).toHaveText(/42,45\s*€/);
    await dialog
      .getByRole('button', { name: 'メガルカリオex schließen', exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  });
}
