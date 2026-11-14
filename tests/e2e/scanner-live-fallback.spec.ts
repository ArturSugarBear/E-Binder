import { test, expect } from './fixtures';

/**
 * Regression target for the home/dock single-card scanner fallback.
 *
 * Current bug: the hidden fallback file input created in
 * `openLiveScannerFlow` (`src/ui/add-cards.ts`) is clicked but never gets a
 * `change` handler. Closing the live sheet also removes the input before the
 * native picker returns. A chosen photo is therefore silently lost and no
 * review opens.
 *
 * Intended contract: choosing a photo keeps the live scanner open, queues the
 * photo as "1 offene Aufnahme", and "Ergebnisse prüfen (1)" opens the add
 * dialog with the photo. No ownership is created before confirmation.
 *
 * Remove `.fixme` first, watch this fail, then fix the lifecycle. Do not make
 * the test pass by asserting the current broken behavior.
 */
test.fixme('home live-scanner photo fallback queues the chosen photo for review', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException('Camera permission denied', 'NotAllowedError');
        },
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#home');

  await page.getByRole('button', { name: 'Karte live scannen' }).click();
  const live = page.getByRole('dialog', {
    name: 'Karte live scannen',
    exact: true,
  });
  await expect(live.locator('.w-live-status')).toContainText(
    'Live-Kamera nicht verfügbar',
  );

  const chooser = page.waitForEvent('filechooser');
  await live
    .getByRole('button', { name: 'Kamerafoto aufnehmen', exact: true })
    .click();
  await (await chooser).setFiles('public/assets/cards/svi-211.webp');

  await expect(live).toBeVisible();
  await expect(live.locator('.w-live-review-summary')).toContainText(
    '1 offene Aufnahme',
  );
  await live
    .getByRole('button', { name: 'Ergebnisse prüfen (1)', exact: true })
    .click();

  await expect(
    page.getByRole('dialog', { name: 'Karten hinzufügen', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.w-original-photo img')).toBeVisible();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
