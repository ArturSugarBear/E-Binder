import { test, expect } from './fixtures';
import { emptyState, type PersonalCard, type Holding } from '../../src/domain/personal';

// Regression from a real binder screenshot: the card was correctly placed
// in an existing binder, but the Japanese M1L artwork was missing. Checking
// the Discover catalog alone does not exercise this actual user surface.
test('existing binder page resolves Riolu M1L-068 artwork without re-adding the card', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const riolu = {
    id: 'M1L-068',
    localId: '068',
    name: 'リオル',
    set: {
      id: 'M1L',
      name: 'Mega Brave',
      cardCount: { official: 63 },
    },
    thirdParty: { tcgplayer: 647177 },
    variants_detailed: [],
  };
  await page.route('https://api.tcgdex.net/v2/ja/cards/M1L-068', (route) =>
    route.fulfill({ json: riolu }),
  );
  // Exercise the actual binder image renderer, not just metadata lookup.
  await page.route('https://tcgplayer-cdn.tcgplayer.com/**', (route) =>
    route.fulfill({ path: 'public/assets/cards/svi-211.webp' }),
  );
  const state = emptyState('personal');
  const date = new Date().toISOString();
  const card = {
    key: 'tcgdex:en:M1L-068',
    source: 'tcgdex',
    sourceId: 'M1L-068',
    name: 'Riolu',
    setId: 'M1L',
    setName: 'Mega Brave',
    number: '068/063',
    language: 'en',
    image: '',
    artist: '',
    artistSource: 'unknown',
    evolvesFrom: '',
    stage: '',
    finishes: ['holo'],
  } as PersonalCard;
  state.holdings = [
    {
      id: 'riolu-holding',
      card,
      finish: 'holo',
      variantNote: '',
      quantity: 1,
      tradeQuantity: 0,
      favorite: false,
      notes: '',
      confirmed: true,
      createdAt: date,
      updatedAt: date,
    } as Holding,
  ];
  state.binders = [
    {
      id: 'riolu-binder',
      name: 'AK',
      isPublic: false,
      pages: [
        {
          id: 'riolu-page',
          title: 'Seite 1',
          assembled: false,
          slots: Array.from({ length: 9 }, (_, index) =>
            index === 5
              ? {
                  kind: 'owned',
                  holdingId: 'riolu-holding',
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
      const request = indexedDB.open('e-binder-personal', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('states', 'readwrite');
      tx.objectStore('states').put(snapshot, 'personal');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, state);
  await page.goto('./#binder');
  await page.reload();

  const rioluSlot = page.locator('.w-binder-paper button.w-pocket').nth(5);
  await expect(rioluSlot).toHaveAttribute('aria-label', /Riolu/);
  const art = rioluSlot.locator('.card-art');
  await expect(art).toHaveAttribute('data-image-state', 'loaded', {
    timeout: 15000,
  });
  await expect(art.locator('img')).toHaveAttribute(
    'src',
    'https://tcgplayer-cdn.tcgplayer.com/product/647177_in_1000x1000.jpg',
  );
  await expect(art.locator('.w-art-language')).toHaveText('Bild: JA');
  await rioluSlot.click();
  const detail = page.getByRole('dialog', { name: /^Platz 6/ });
  await expect(detail.locator('.card-art')).toHaveAttribute(
    'data-image-state',
    'loaded',
  );
  await expect(detail.locator('.card-art img')).toHaveAttribute(
    'src',
    /647177_in_1000x1000\.jpg$/,
  );
  await expect(page.locator('.w-binder-paper button.w-pocket')).toHaveCount(9);
});
