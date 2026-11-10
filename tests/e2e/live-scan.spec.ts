import { test, expect } from './fixtures';

test('live scanner offers a clear camera-permission fallback without collecting inventory', async ({
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
  await page.goto('./');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const capture = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    exact: true,
  });
  await capture.getByRole('button', { name: 'Karte live scannen' }).click();
  const live = page.getByRole('dialog', {
    name: 'Karte live scannen',
    exact: true,
  });
  await expect(live).toBeVisible();
  await expect(live.locator('video[autoplay][playsinline]')).toHaveCount(1);
  await expect(live.locator('.w-live-status')).toContainText(
    'Live-Kamera nicht verfügbar',
  );
  await expect(
    live.getByRole('button', {
      name: 'Stattdessen Kamerafoto verwenden',
    }),
  ).toBeVisible();
  await live
    .getByRole('button', { name: 'Karte live scannen schließen' })
    .click();
  await expect(live).toHaveCount(0);
  await expect(capture).toBeVisible();
  await expect(capture.locator('.w-capture-queue')).toBeEmpty();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
