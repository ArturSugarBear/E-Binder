import { test, expect } from './fixtures';

test('the scanner opens via the central add action without persisting a photo', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  await page.getByRole('button', { name: 'Ganze Binderseite scannen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Binderseiten scannen' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator('.w-dialog-footer .w-button-primary'),
  ).toBeDisabled();
  await dialog
    .locator('input[type=file][multiple]')
    .setInputFiles('public/assets/cards/svi-211.webp');
  await expect(dialog.locator('.w-page-scan-grid')).toHaveAttribute(
    'data-scan-state',
    'needs-adjustment',
    { timeout: 30_000 },
  );
  await expect(dialog.locator('.w-page-scan-pocket')).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: 'Binderseite jetzt ausrichten' }),
  ).toBeEnabled();
  await expect(
    dialog.locator('.w-dialog-footer .w-button-primary'),
  ).toBeDisabled();
  await expect(
    page.getByRole('dialog', { name: 'Binderseite ausrichten' }),
  ).toHaveCount(0);
  await dialog
    .getByRole('button', { name: 'Binderseiten scannen schließen' })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('proposes editable binder corners only for a clear page outline', async ({
  page,
}) => {
  await page.goto('./#binder');
  await page.getByRole('button', { name: 'Binderseite scannen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Binderseiten scannen' });
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 960;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e7e7e7';
    ctx.fillRect(0, 0, 720, 960);
    ctx.fillStyle = '#172c37';
    ctx.fillRect(78, 96, 564, 764);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        ctx.fillStyle = (row + col) % 2 ? '#a1c4d4' : '#c9d5db';
        ctx.fillRect(98 + col * 180, 116 + row * 245, 160, 220);
      }
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await dialog.locator('input[type=file][multiple]').setInputFiles({
    name: 'clear-binder-outline.png',
    mimeType: 'image/png',
    buffer: Buffer.from(image, 'base64'),
  });
  await expect
    .poll(
      async () =>
        (await dialog.locator('.w-page-scan-pocket').count()) === 9 ||
        (await dialog
          .locator('.w-page-scan-grid')
          .getAttribute('data-scan-state')) === 'needs-adjustment',
      { timeout: 30_000 },
    )
    .toBe(true);
  const stop = dialog.getByRole('button', { name: 'Erkennung stoppen' });
  if (await stop.isVisible()) await stop.click();
  const correct = dialog.getByRole('button', { name: 'Zuschnitt korrigieren' });
  await expect(correct).toBeEnabled({ timeout: 15_000 });
  await correct.click();
  const crop = page.getByRole('dialog', { name: 'Binderseite ausrichten' });
  await expect(
    crop.getByText('Ecken automatisch vorgeschlagen.', {
      exact: false,
    }),
  ).toBeVisible();
  const x = crop.getByLabel('Position waagerecht');
  expect(Number(await x.inputValue())).toBeGreaterThan(50);
  expect(Number(await x.inputValue())).toBeLessThan(200);
  await crop.getByRole('button', { name: 'Ausschnitt prüfen' }).click();
  await expect(crop.locator('.w-page-crop-guides span')).toHaveCount(9);
  await crop.getByRole('button', { name: 'Ecken nachbessern' }).click();
  await x.evaluate((element: HTMLInputElement) => {
    element.value = '220';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(
    crop.getByText('Ecken manuell angepasst.', {
      exact: false,
    }),
  ).toBeVisible();
  await crop.getByRole('button', { name: 'Zurück zum Foto' }).click();
  await dialog
    .getByRole('button', { name: 'Binderseiten scannen schließen' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Deine erste Seite wartet.' }),
  ).toBeVisible();
});

test('a distorted photo is split into nine reviewable positions without changing ownership', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('./#binder');
  await page.getByRole('button', { name: 'Binderseite scannen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Binderseiten scannen' });
  const image = await page.evaluate(async () => {
    const res = await fetch('./assets/cards/svi-211.webp');
    const bitmap = await createImageBitmap(await res.blob());
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1020;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const x = 25 + col * 225;
        const y = 25 + row * 323;
        ctx.save();
        ctx.translate(x + 100, y + 140);
        ctx.rotate((col - row) * 0.017);
        ctx.filter = row === 1 ? 'blur(1.5px)' : 'none';
        ctx.drawImage(bitmap, -100, -140, 200, 280);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x + 30, y + 20, 10, 248);
      }
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.75).split(',')[1]!;
  });
  await dialog.locator('input[type=file][multiple]').setInputFiles({
    name: 'binder-verschlechtert.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(image, 'base64'),
  });
  await expect
    .poll(
      async () =>
        (await dialog.locator('.w-page-scan-pocket').count()) === 9 ||
        (await dialog
          .locator('.w-page-scan-grid')
          .getAttribute('data-scan-state')) === 'needs-adjustment',
      { timeout: 30_000 },
    )
    .toBe(true);
  if (
    (await dialog
      .locator('.w-page-scan-grid')
      .getAttribute('data-scan-state')) === 'needs-adjustment'
  ) {
    await expect(dialog.locator('.w-page-scan-pocket')).toHaveCount(0);
    await expect(
      dialog.getByRole('button', { name: 'Binderseite jetzt ausrichten' }),
    ).toBeEnabled();
    await expect(
      dialog.locator('.w-dialog-footer .w-button-primary'),
    ).toBeDisabled();
    await dialog
      .getByRole('button', { name: 'Binderseiten scannen schließen' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Deine erste Seite wartet.' }),
    ).toBeVisible();
    return;
  }
  await expect(dialog.locator('.w-page-scan-editor')).toHaveCount(9);
  await expect(dialog.locator('.w-page-scan-editor[open]')).toHaveCount(0);
  await expect(dialog.locator('.w-page-scan-review-panel')).toBeHidden();
  await expect(
    dialog.getByRole('button', { name: /Fach 1 prüfen/ }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: /Fach 1 prüfen/ }).click();
  await expect(dialog.locator('.w-page-scan-review-panel')).toBeVisible();
  await expect(dialog.locator('.w-page-scan-editor[open]')).toHaveCount(1);
  await expect(
    dialog.getByRole('heading', { name: 'Fach 1 von 9 prüfen' }),
  ).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Fach als leer bestätigen' })
    .click();
  await expect(dialog.locator('.w-page-scan-pocket').first()).toHaveAttribute(
    'data-decision',
    'empty',
  );
  await expect(
    dialog.getByRole('heading', { name: 'Fach 2 von 9 prüfen' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Fach ungeklärt lassen' }).click();
  await expect(dialog.locator('.w-page-scan-pocket').nth(1)).toHaveAttribute(
    'data-decision',
    'skip',
  );
  await expect(dialog.locator('.w-page-scan-pocket img')).toHaveCount(9);
  await expect(dialog.locator('.w-page-scan-photo-frame')).toHaveCount(9);
  await expect(dialog.locator('.w-page-scan-quality')).toHaveCount(9);
  await expect(
    page.getByRole('dialog', { name: 'Binderseite ausrichten' }),
  ).toHaveCount(0);
  await expect(
    dialog.locator('.w-dialog-footer .w-button-primary'),
  ).toBeDisabled();
  const stop = dialog.getByRole('button', { name: 'Erkennung stoppen' });
  if (await stop.isVisible()) await stop.click();
  const active = dialog.locator('.w-page-scan-pocket.is-scanning');
  await expect(active).toHaveCount(0, { timeout: 20_000 });
  await dialog
    .getByRole('button', { name: 'Binderseiten scannen schließen' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Deine erste Seite wartet.' }),
  ).toBeVisible();
});
