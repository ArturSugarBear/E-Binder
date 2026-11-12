import { test, expect } from './fixtures';

test('local-only collector sees optional photo donation without creating an E-Binder account', async ({
  page,
}) => {
  await page.goto('./#profil');
  await expect(page.getByRole('heading', { name: 'Beta · Bilderkennung verbessern' }))
    .toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Als Gast freiwillig Fotos spenden' }),
  ).toBeVisible();
  await expect(page.getByText(/anonyme Testidentität in diesem Browser/))
    .toBeVisible();
  await expect(page.getByRole('button', { name: 'Alle meine Beta-Testbilder löschen' }))
    .toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Konto anlegen' }),
  ).toHaveCount(0);
  // Consent is not activated merely by visiting Profile.
  await expect(page.getByText(/Teilnahme ausgeschaltet/)).toBeVisible();
});
