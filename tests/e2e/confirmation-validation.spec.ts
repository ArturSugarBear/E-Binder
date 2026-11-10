import { expect, test } from './fixtures';

test('confirming the review checkbox clears stale errors before saving', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await dialog.getByRole('button', { name: 'Karte manuell eintragen' }).click();
  await dialog.getByLabel('Kartenname', { exact: true }).fill('Iscalar');
  await dialog.getByRole('textbox', { name: 'Set' }).fill('Delta-Herrschaft');
  await dialog.getByLabel('Sammlernummer').fill('113/103');
  await dialog
    .getByRole('button', { name: 'Angaben und Menge prüfen' })
    .click();
  await dialog
    .getByLabel('Druckvariante', { exact: true })
    .selectOption('holo');
  await dialog
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  const warning = dialog.locator('.w-confirm-form .w-message-error');
  await expect(warning).toBeVisible();
  await dialog
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await expect(warning).toBeHidden();
  await expect(dialog.locator('.w-confirm-form')).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('main')).toContainText('Iscalar');
});
