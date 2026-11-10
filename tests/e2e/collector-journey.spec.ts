import { test, expect } from './fixtures';

test('home starts collector tasks and Discover switches between sets and cards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#home');
  const main = page.getByRole('main');
  await expect(main.locator('.w-home-quick-tile')).toHaveCount(3);
  await expect(
    main.getByRole('button', { name: /Binderseite scannen/ }),
  ).toBeVisible();
  await main.getByRole('button', { name: /Sets entdecken/ }).click();
  await expect(page).toHaveURL(/#entdecken/);
  const modes = main.getByRole('group', { name: 'Katalog erkunden' });
  await expect(modes.getByRole('button')).toHaveCount(2);
  const sets = modes.getByRole('button', { name: 'Sets entdecken' });
  const cards = modes.getByRole('button', { name: 'Karten suchen' });
  await cards.click();
  await expect(cards).toHaveAttribute('aria-pressed', 'true');
  await expect(main.locator('.w-catalog-discovery')).not.toHaveAttribute(
    'open',
    '',
  );
  await sets.click();
  await expect(sets).toHaveAttribute('aria-pressed', 'true');
  await expect(main.locator('.w-catalog-discovery')).toHaveAttribute(
    'open',
    '',
  );
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth),
  ).resolves.toBeLessThanOrEqual(390);
});

test('capture has explicit review stages and never auto-confirms ownership', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  const main = page.getByRole('main');
  await main
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await expect(dialog.locator('.w-scan-flow li')).toHaveCount(3);
  await expect(dialog.locator('.w-scan-flow [aria-current="step"]')).toHaveText(
    '1 · Erfassen',
  );
  await expect(main.locator('.w-owned-grid button')).toHaveCount(0);
  await dialog
    .getByRole('button', { name: 'Karte manuell eintragen', exact: true })
    .click();
  await expect(dialog.locator('.w-scan-flow [aria-current="step"]')).toHaveText(
    '2 · Ausgabe prüfen',
  );
  await expect(main.locator('.w-owned-grid button')).toHaveCount(0);
});
