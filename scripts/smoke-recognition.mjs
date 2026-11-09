/** Optional real OCR check. Start `npm run preview` first; external models need network. */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
const framed = process.argv.includes('--framed');
const files = process.argv.slice(2).filter((value) => value !== '--framed');
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
    const original = await readFile(resolve(file));
    const payload = framed
      ? {
          name: 'synthetic-camera.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            await page.evaluate(async (encoded) => {
              const image = new Image();
              image.src = `data:image/webp;base64,${encoded}`;
              await image.decode();
              const canvas = document.createElement('canvas');
              canvas.width = image.naturalHeight * 2;
              canvas.height = image.naturalWidth * 2;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#334455';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate(Math.PI / 2);
              ctx.drawImage(
                image,
                -image.naturalWidth / 2,
                -image.naturalHeight / 2,
              );
              return canvas.toDataURL('image/png').split(',')[1];
            }, original.toString('base64')),
            'base64',
          ),
        }
      : resolve(file);
    await page
      .getByRole('dialog')
      .locator('input[type=file][multiple]')
      .setInputFiles(payload);
    await page
      .getByRole('button', {
        name: 'Foto ausrichten und erkennen',
        exact: true,
      })
      .click();
    if (framed) {
      const editor = page.getByRole('dialog', {
        name: 'Karte ausrichten',
        exact: true,
      });
      await editor.getByLabel('Ausrichtung', { exact: true }).selectOption('3');
      for (const [i, [x, y]] of [
        [250, 250],
        [750, 250],
        [750, 750],
        [250, 750],
      ].entries()) {
        await editor.getByLabel('Ecke auswählen').selectOption(String(i));
        await editor.getByLabel('Position waagerecht').fill(String(x));
        await editor.getByLabel('Position senkrecht').fill(String(y));
      }
    }
    await page
      .getByRole('button', { name: 'Ausschnitt prüfen', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Karte ausrichten', exact: true })
      .getByRole('button', { name: 'Texterkennung starten', exact: true })
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
        input: framed
          ? 'synthetic table border and 90-degree rotation; not a real photo'
          : 'digital card image',
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
