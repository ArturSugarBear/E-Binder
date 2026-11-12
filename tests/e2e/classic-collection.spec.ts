import { expect, test } from './fixtures';

/** TCGdex #2341: 30th-c image metadata is genuinely absent upstream. */
test('30th Classic Collection displays exact Scrydex images despite reused historical numbers', async ({
  page,
}) => {
  const set = {
    id: '30th-c',
    name: '30 Jahre: Klassische Sammlung',
    cardCount: { official: 30, total: 30 },
  };
  const records = [
    ['001', 'Charizard', 'me55c-4'],
    ['003', 'Metagross', 'me55c-11'],
    ['004', 'Genesect EX', 'me55c-11g'],
    ['022', 'Palkia LV.X', 'me55c-106p'],
    ['023', 'M Gardevoir EX', 'me55c-106m'],
    ['024', 'Shining Celebi', 'me55c-106'],
  ];
  const cards = records.map(([localId, name]) => ({
    id: `30th-c-${localId}`,
    localId,
    name,
    set,
    rarity: 'Rare',
    illustrator: 'Artist',
    variants: { holo: true },
  }));
  await page.route('https://images.scrydex.com/**', (route) =>
    route.fulfill({ path: 'public/assets/cards/svi-211.webp' }),
  );
  await page.route('https://api.tcgdex.net/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/v2/graphql')
      return route.fulfill({
        json: {
          data: {
            set: {
              ...set,
              cards: cards.map(({ id }) => ({ id })),
            },
            cards,
          },
        },
      });
    if (path.endsWith('/sets')) return route.fulfill({ json: [set] });
    if (path.endsWith('/series/tcgp'))
      return route.fulfill({ json: { id: 'tcgp', sets: [] } });
    if (path.endsWith('/series') || path.endsWith('/rarities'))
      return route.fulfill({ json: [] });
    if (path.endsWith('/illustrators'))
      return route.fulfill({ json: ['Artist'] });
    if (path.endsWith('/sets/30th-c'))
      return route.fulfill({ json: { ...set, cards } });
    const detail = cards.find((card) => path.endsWith('/cards/' + card.id));
    return route.fulfill({ json: detail ?? [] });
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./#entdecken?setId=30th-c');
  const results = page.locator('.w-search-results');
  await expect(results.locator('button')).toHaveCount(6, {
    timeout: 20000,
  });
  for (const [localId, name, providerId] of records) {
    const card = results.locator('button').filter({ hasText: name });
    await expect(card.locator('.card-art img')).toHaveAttribute(
      'src',
      `https://images.scrydex.com/pokemon/${providerId}/large`,
    );
    await expect(card.locator('.w-art-language')).toHaveText('Bild: EN');
    await expect(card).toContainText(`${localId}/30`);
  }
  await results.locator('button').filter({ hasText: 'Genesect EX' }).click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog.locator('.card-art img').first()).toHaveAttribute(
    'src',
    'https://images.scrydex.com/pokemon/me55c-11g/large',
  );
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
