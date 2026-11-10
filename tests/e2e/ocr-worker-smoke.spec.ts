import { test, expect } from './fixtures';

test('real local OCR reads a known card without creating ownership', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || !isMobile,
    'A single real ONNX OCR smoke run on mobile Chromium keeps CI lean.',
  );
  test.setTimeout(150_000);
  const errors: string[] = [];
  const workers: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('worker', (worker) => workers.push(worker.url()));
  // The OCR check is deliberately independent from external TCGdex uptime.
  await page.route('https://api.tcgdex.net/**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('./#sammlung');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page
    .getByRole('main')
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
  await crop.getByRole('button', { name: 'Ausschnitt prüfen' }).click();
  await crop.getByRole('button', { name: 'Texterkennung starten' }).click();
  await expect
    .poll(
      async () => {
        const text = await add.locator('.w-ocr-text').allTextContents();
        return text.join('\n');
      },
      { timeout: 120_000 },
    )
    .toMatch(/\p{L}{3}|\d{2,3}\s*[\x2f|]\s*\d{2,3}/u);
  const text = await add.locator('.w-ocr-text').innerText();
  console.log('Public test card OCR:', text.slice(0, 300));
  expect(workers.some((url) => url.includes('vision-worker'))).toBe(true);
  expect(errors).toEqual([]);
  await add
    .getByRole('button', { name: 'Karten hinzufügen schließen' })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
