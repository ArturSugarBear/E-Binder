/** Optional real OCR check. Start `npm run preview` first; external models need network. */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
const files = process.argv.slice(2);
const samples = files.length
  ? files
  : [
      'public/assets/cards/svi-211.webp',
      'public/assets/cards/obf-207.webp',
      'public/assets/cards/pal-210.webp',
    ];
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
        args: ['--no-sandbox'],
      }
    : {},
);
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173/E-Binder/',
  );
  await page.waitForFunction(
    () => document.querySelectorAll('.w-welcome-art img').length === 3,
  );
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  for (const file of samples) {
    const started = Date.now();
    await page
      .getByRole('dialog')
      .locator('input[type=file][multiple]')
      .setInputFiles(resolve(file));
    await page
      .getByRole('button', { name: 'Text auf dem Foto erkennen', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.w-form-notices')
          ?.textContent.includes('Erkennung abbrechen'),
      {},
      { timeout: 110000 },
    );
    console.log(
      JSON.stringify({
        file,
        seconds: (Date.now() - started) / 1000,
        text: await page.locator('.w-ocr-text').allTextContents(),
        candidates: await page.locator('.w-search-results').innerText(),
        status: await page.locator('.w-form-notices').innerText(),
        errors,
      }),
    );
  }
  if (await page.locator('.w-owned-grid button').count())
    throw new Error('OCR darf keinen Besitz erzeugen.');
} finally {
  await browser.close();
}
