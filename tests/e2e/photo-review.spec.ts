import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test('camera photo offers alignment, rotation and recoverable cancellation without adding ownership', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    exact: true,
  });
  await add
    .locator('input[capture]')
    .setInputFiles('public/assets/cards/svi-211.webp');
  const crop = page.getByRole('dialog', {
    name: 'Karte ausrichten',
    exact: true,
  });
  await expect(crop).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await crop.getByLabel('Ausrichtung', { exact: true }).selectOption('1');
  const canvas = crop.locator('canvas');
  expect(
    await canvas.evaluate(
      (node) =>
        (node as HTMLCanvasElement).width > (node as HTMLCanvasElement).height,
    ),
  ).toBe(true);
  await crop.getByLabel('Ecke auswählen').selectOption('0');
  await crop.getByLabel('Position waagerecht').fill('100');
  await crop
    .getByRole('button', { name: 'Zurück zum Foto', exact: true })
    .click();
  await expect(add.locator('.w-capture-queue')).toContainText('1 offen');
  await expect(add.locator('.w-photo-review img')).toHaveAttribute(
    'src',
    /^blob:/,
  );
  await add
    .getByRole('button', { name: 'Foto ausrichten und erkennen', exact: true })
    .click();
  await expect(crop).toBeVisible();
  await crop
    .getByRole('button', { name: 'Zurück zum Foto', exact: true })
    .click();
  await add
    .getByRole('button', { name: 'Karte manuell eintragen', exact: true })
    .click();
  const fonts = await add
    .locator('.w-manual-form input:not([type=checkbox])')
    .evaluateAll((nodes) =>
      nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)),
    );
  expect(fonts.every((size) => size >= 16)).toBe(true);
  await add.getByLabel('Kartenname', { exact: true }).fill('Mein Test');
  await add.getByLabel('Set', { exact: true }).fill('Ungeklärt');
  await add.getByLabel('Sammlernummer', { exact: true }).fill('1/1');
  await add.getByRole('button', { name: 'Angaben und Menge prüfen' }).click();
  await expect(
    add.getByRole('button', { name: 'Bestand bestätigen', exact: true }),
  ).toBeVisible();
  await add
    .getByRole('button', { name: 'Karten hinzufügen schließen', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('button', { name: 'Erfassung fortsetzen', exact: true })
    .click();
  await expect(page.locator('.w-capture-queue')).toContainText('1 offen');
});

test('confirming a photo selects the next pending original without counting it as owned', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('.w-welcome-art img')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog');
  await add
    .locator('input[type=file][multiple]')
    .setInputFiles([
      'public/assets/cards/svi-211.webp',
      'public/assets/cards/obf-207.webp',
    ]);
  await expect(add.locator('.w-capture-queue')).toContainText('2 offen');
  await add.getByLabel('Karte suchen', { exact: true }).fill('Trasla');
  await add.locator('.w-search-results button').first().click();
  await add.getByLabel('Druckvariante', { exact: true }).selectOption('holo');
  await add
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await add
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await expect(add.locator('.w-capture-queue')).toContainText(
    '1 offen · 1 übernommen',
  );
  await expect(add.locator('.w-photo-review h3')).toHaveText('obf-207.webp');
  await expect(add.locator('.w-form-notices')).toContainText(
    'nächste offene Foto',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
});
