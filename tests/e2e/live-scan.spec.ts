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
  await page.goto('./#sammlung');
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
  // The camera feedback must be painted above the sticky review controls.
  expect(
    await live.locator('.w-live-status').evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return node.contains(
        document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        ),
      );
    }),
  ).toBe(true);
  await expect(
    live.getByRole('button', {
      name: 'Stattdessen Kamerafoto verwenden',
    }),
  ).toBeVisible();
  // Camera denial should offer an immediately visible fallback, not a
  // secondary accordion that the collector has to discover.
  const fallback = live.getByRole('button', {
    name: 'Kamerafoto aufnehmen',
    exact: true,
  });
  await expect(fallback).toBeVisible();
  expect((await fallback.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(
    live.getByRole('button', { name: 'Zurück', exact: true }),
  ).toBeVisible();
  await live
    .getByRole('button', { name: 'Karte live scannen schließen' })
    .click();
  await expect(live).toHaveCount(0);
  await expect(capture).toBeVisible();
  await expect(capture.locator('.w-capture-queue')).toBeEmpty();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('pending scans remain reviewable while the camera is unavailable, including with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    exact: true,
  });
  await add
    .locator('input[type=file][multiple]')
    .setInputFiles([
      'public/assets/cards/svi-211.webp',
      'public/assets/cards/obf-207.webp',
    ]);
  await expect(add.locator('.w-capture-queue')).toContainText('2 offen');
  await add
    .getByRole('button', { name: 'Karte live scannen', exact: true })
    .click();
  const live = page.getByRole('dialog', {
    name: 'Karte live scannen',
    exact: true,
  });
  await expect(live.locator('.w-live-status')).toContainText(
    'Live-Kamera nicht verfügbar',
  );
  expect(
    await live.locator('.w-live-status').evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return node.contains(
        document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        ),
      );
    }),
  ).toBe(true);
  await expect(live.locator('.w-live-review-summary')).toHaveText(
    '2 offene Aufnahmen · erst nach deiner Bestätigung im Bestand.',
  );
  const review = live.getByRole('button', {
    name: 'Ergebnisse prüfen (2)',
    exact: true,
  });
  const target = await review.boundingBox();
  expect(target!.height).toBeGreaterThanOrEqual(44);
  expect(target!.width).toBeGreaterThanOrEqual(44);
  await review.click();
  await expect(live).toHaveCount(0);
  await expect(add).toBeVisible();
  await expect(add.locator('.w-capture-queue')).toContainText('2 offen');
  // An unreviewed upload opens its existing crop confirmation. Focus must
  // stay in that active modal, rather than the inert scanner opener beneath it.
  const alignment = page.getByRole('dialog', {
    name: 'Karte ausrichten',
    exact: true,
  });
  await expect(alignment).toBeVisible();
  expect(
    await alignment.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await alignment
    .getByRole('button', { name: 'Karte ausrichten schließen', exact: true })
    .click();
  await expect(add).toBeVisible();
  await add
    .getByRole('button', { name: 'Karten hinzufügen schließen', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('upload picker and manual entry allow returning to the scanner', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    exact: true,
  });
  const selecting = page.waitForEvent('filechooser');
  await add.getByRole('button', { name: 'Fotos auswählen' }).click();
  const chooser = await selecting;
  expect(chooser.isMultiple()).toBe(true);

  await add.getByRole('button', { name: 'Karte manuell eintragen' }).click();
  await expect(
    add.getByRole('heading', { name: 'Ausgabe manuell erfassen' }),
  ).toBeVisible();
  await add.getByRole('button', { name: 'Zurück zu den Scanoptionen' }).click();
  await expect(
    add.getByRole('button', { name: 'Karte live scannen' }),
  ).toBeVisible();
  await expect(
    add.getByRole('heading', { name: 'Ausgabe manuell erfassen' }),
  ).toHaveCount(0);
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('P09 pauses a full batch before requesting camera and keeps reviewable captures', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let permissions = 0;
    (
      window as typeof window & { __cameraRequests?: () => number }
    ).__cameraRequests = () => permissions;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          permissions++;
          throw new Error('Camera must not be requested for a full queue');
        },
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  const images = Array.from({ length: 24 }, (_, index) => ({
    name: `batch-${index + 1}.jpg`,
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, index + 1, 0xff, 0xd9]),
  }));
  await add.locator('input[type=file][multiple]').setInputFiles(images);
  await expect(add.locator('.w-capture-queue')).toContainText('24 offen', {
    timeout: 30_000,
  });
  await add.getByRole('button', { name: 'Karte live scannen' }).click();
  const live = page.getByRole('dialog', { name: 'Karte live scannen' });
  await expect(live.locator('.w-live-status')).toContainText(
    'Scan-Puffer ist voll',
  );
  await expect(live.locator('.w-live-stage')).toHaveAttribute(
    'data-scan-phase',
    'queue-full',
  );
  await expect(
    live.getByRole('button', { name: 'Manuell aufnehmen' }),
  ).toBeHidden();
  await expect(
    live.getByRole('button', { name: /Ergebnisse prüfen \(24\)/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { __cameraRequests: () => number }
      ).__cameraRequests(),
    ),
  ).toBe(0);
  await live.getByRole('button', { name: /Ergebnisse prüfen \(24\)/ }).click();
  await expect(live).toHaveCount(0);
  await expect(add.locator('.w-capture-queue')).toContainText('24 offen');
  await add.locator('input[type=file][multiple]').setInputFiles({
    name: 'batch-overflow.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 99, 0xff, 0xd9]),
  });
  await expect(add.locator('.w-form-notices')).toContainText(
    'Scan-Puffer ist voll',
  );
  await expect(add.locator('.w-capture-queue')).toContainText('24 offen');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
