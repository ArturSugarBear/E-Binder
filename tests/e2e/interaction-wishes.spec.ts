import { test, expect } from './fixtures';
import { readFile } from 'node:fs/promises';

test('manual wishes use the selected language, expose duplicates and export the actual saved editions', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    exact: true,
  });
  await add
    .getByRole('button', { name: 'Karte manuell eintragen', exact: true })
    .click();
  await add
    .getByLabel('Kartenname', { exact: true })
    .fill('Internationale Testkarte');
  await add.getByRole('textbox', { name: 'Set', exact: true }).fill('Testset');
  await add.getByLabel('Sammlernummer', { exact: true }).fill('1/9');
  await add
    .getByRole('button', { name: 'Angaben und Menge prüfen', exact: true })
    .click();
  await add.getByLabel('Sprache der Karte', { exact: true }).selectOption('fr');
  await add
    .getByRole('button', { name: 'Auf die Wunschliste', exact: true })
    .click();
  await expect(
    add.getByRole('button', { name: 'Auf deiner Wunschliste', exact: true }),
  ).toBeDisabled();
  await add.getByLabel('Sprache der Karte', { exact: true }).selectOption('en');
  await add
    .getByRole('button', { name: 'Auf die Wunschliste', exact: true })
    .click();
  await add.getByLabel('Sprache der Karte', { exact: true }).selectOption('fr');
  await expect(
    add.getByRole('button', { name: 'Auf deiner Wunschliste', exact: true }),
  ).toBeDisabled();
  await add
    .getByRole('button', { name: 'Karten hinzufügen schließen', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page.getByRole('link', { name: 'Wunschliste', exact: true }).click();
  await expect(page.locator('.w-wish-card')).toHaveCount(2);
  await expect(
    page.locator('.w-wish-card').filter({ hasText: '· FR' }),
  ).toHaveCount(1);
  await expect(
    page.locator('.w-wish-card').filter({ hasText: '· EN' }),
  ).toHaveCount(1);
  const french = page.locator('.w-wish-card').filter({ hasText: '· FR' });
  await french.getByLabel('Gewünschte Menge', { exact: true }).fill('3');
  await french.getByLabel('Priorität', { exact: true }).selectOption('high');
  await french
    .getByRole('button', { name: 'Wunsch speichern', exact: true })
    .click();
  await page.reload();
  await expect(
    french.getByLabel('Gewünschte Menge', { exact: true }),
  ).toHaveValue('3');
  await expect(french.getByLabel('Priorität', { exact: true })).toHaveValue(
    'high',
  );
  await page.getByRole('button', { name: 'Sichern', exact: true }).click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Sicherung herunterladen', exact: true })
    .click();
  const file = await (await download).path();
  expect(file).toBeTruthy();
  const records = (await readFile(file!, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const wishes = records
    .filter((row) => row.record === 'wish')
    .map((row) => row.data);
  expect(wishes.map((row) => row.card.language).sort()).toEqual(['en', 'fr']);
  expect(wishes.find((row) => row.card.language === 'fr')).toMatchObject({
    quantity: 3,
    priority: 'high',
    card: { key: 'manual:testset:19:fr' },
  });
  expect(records.filter((row) => row.record === 'holding')).toHaveLength(0);
});
