import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test('stale captures can be removed individually or together without changing owned cards', async ({
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
    .locator('input[type=file][multiple]')
    .setInputFiles([
      'public/assets/cards/svi-211.webp',
      'public/assets/cards/obf-207.webp',
    ]);
  await expect(add.locator('.w-capture-queue')).toContainText('2 offen');
  await add
    .getByRole('button', { name: 'Aufnahme svi-211.webp entfernen' })
    .click();
  await expect(add.locator('.w-capture-queue')).toContainText('1 offen');
  await expect(add.locator('.w-capture-queue')).not.toContainText(
    'svi-211.webp',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await add
    .getByRole('button', { name: /Alle offenen Aufnahmen entfernen/ })
    .click();
  await expect(add.locator('.w-capture-queue')).not.toContainText('1 offen');
  await expect(add.locator('.w-photo-review')).toBeEmpty();
  await add
    .getByRole('button', { name: 'Karten hinzufügen schließen' })
    .click();
  await page.reload();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('camera photo offers alignment, rotation and recoverable cancellation without adding ownership', async ({
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
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await crop.getByLabel('Ausrichtung', { exact: true }).selectOption('1');
  const canvas = crop.locator('canvas');
  expect(
    await canvas.evaluate(
      (node) =>
        (node as HTMLCanvasElement).width > (node as HTMLCanvasElement).height,
    ),
  ).toBe(true);
  await crop.getByLabel('Ecke auswählen').selectOption('0');
  await crop.getByLabel('Position waagerecht').fill('100');
  await crop
    .getByRole('button', { name: 'Zurück zum Foto', exact: true })
    .click();
  await expect(add.locator('.w-capture-queue')).toContainText('1 offen');
  await expect(add.locator('.w-photo-review img')).toHaveAttribute(
    'src',
    /^blob:/,
  );
  await add
    .getByRole('button', { name: 'Foto ausrichten und erkennen', exact: true })
    .click();
  await expect(crop).toBeVisible();
  await crop
    .getByRole('button', { name: 'Zurück zum Foto', exact: true })
    .click();
  await add
    .getByRole('button', { name: 'Karte manuell eintragen', exact: true })
    .click();
  const fonts = await add
    .locator('.w-manual-form input:not([type=checkbox])')
    .evaluateAll((nodes) =>
      nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)),
    );
  expect(fonts.every((size) => size >= 16)).toBe(true);
  await add.getByLabel('Kartenname', { exact: true }).fill('Mein Test');
  await add
    .getByRole('textbox', { name: 'Set', exact: true })
    .fill('Ungeklärt');
  await add.getByLabel('Sammlernummer', { exact: true }).fill('1/1');
  await add.getByRole('button', { name: 'Angaben und Menge prüfen' }).click();
  await expect(
    add.getByRole('button', { name: 'Bestand bestätigen', exact: true }),
  ).toBeVisible();
  await add
    .getByRole('button', { name: 'Karten hinzufügen schließen', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('button', { name: 'Erfassung fortsetzen', exact: true })
    .click();
  await expect(page.locator('.w-capture-queue')).toContainText('1 offen');
  await expect(page.locator('.w-photo-review img')).toHaveCount(0);
});

test('confirming a photo selects the next temporary capture without counting it as owned', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  await expect(page.locator('.w-welcome-art img')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog');
  await add
    .locator('input[type=file][multiple]')
    .setInputFiles([
      'public/assets/cards/svi-211.webp',
      'public/assets/cards/obf-207.webp',
    ]);
  await expect(add.locator('.w-capture-queue')).toContainText('2 offen');
  await add.getByLabel('Karte suchen', { exact: true }).fill('Trasla');
  await add.locator('.w-search-results button').first().click();
  await add.getByLabel('Druckvariante', { exact: true }).selectOption('holo');
  await add
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await add
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await expect(add.locator('.w-capture-queue')).toContainText(
    '1 offen · 1 übernommen',
  );
  await expect(add.locator('.w-photo-review h3')).toHaveText('obf-207.webp');
  await expect(add.locator('.w-form-notices')).toContainText(
    'nächste Karte prüfen',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
});

test('crop review magnifies the actual card footer before OCR and allows correction or cancellation without ownership', async ({
  page,
}) => {
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('./#sammlung');
  await page
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
  await crop
    .getByRole('button', { name: 'Ausschnitt prüfen', exact: true })
    .click();
  await expect(crop.locator('.w-crop-review')).toBeVisible();
  await expect(crop.locator('.w-crop-review canvas')).toHaveCount(3);
  expect(workers.filter((url) => url.includes('vision-worker'))).toEqual([]);
  expect(
    await crop
      .locator('.w-crop-footer-preview')
      .first()
      .evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        return canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((value) => value > 0);
      }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await crop
    .getByRole('button', { name: 'Ecken nachbessern', exact: true })
    .click();
  await expect(
    crop.getByRole('button', { name: 'Texterkennung starten', exact: true }),
  ).toBeHidden();
  await crop.getByLabel('Position waagerecht').fill('50');
  await crop
    .getByRole('button', { name: 'Ausschnitt prüfen', exact: true })
    .click();
  await expect(crop.locator('.w-crop-review')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(add).toBeVisible();
  expect(workers.filter((url) => url.includes('vision-worker'))).toEqual([]);
  await add
    .getByRole('button', { name: 'Karten hinzufügen schließen', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('multiple uploaded photos remain switchable after a guided scan review', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    class FakeOCR {
      onmessage:
        | ((
            event: MessageEvent<{ type: string; id: number; text: string }>,
          ) => void)
        | null = null;
      onerror: ((event: Event) => void) | null = null;
      postMessage(data: { id: number }) {
        setTimeout(() => {
          this.onmessage?.(
            new MessageEvent('message', {
              data: { type: 'done', id: data.id, text: '088/063' },
            }),
          );
        }, 25);
      }
      terminate() {}
    }
    class InterceptWorker extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (String(url).includes('vision-worker'))
          return new FakeOCR() as unknown as InterceptWorker;
        super(url, options);
      }
    }
    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: InterceptWorker,
    });
  });
  await page.route('https://api.tcgdex.net/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const set = {
      id: 'M1L',
      name: 'メガブレイブ',
      cardCount: { official: 63 },
    };
    const card = {
      id: 'M1L-088',
      localId: '088',
      name: 'メガルカリオex',
    };
    if (path.endsWith('/ja/sets')) return route.fulfill({ json: [set] });
    if (path.endsWith('/ja/cards') && url.searchParams.has('localId'))
      return route.fulfill({ json: [card] });
    if (path.endsWith('/ja/sets/M1L'))
      return route.fulfill({ json: { ...set, cards: [card] } });
    if (path.endsWith('/ja/cards/M1L-088'))
      return route.fulfill({
        json: { ...card, set, variants: { holo: true } },
      });
    return route.fulfill({ json: [] });
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
    .getByRole('button', { name: 'Foto ausrichten und erkennen' })
    .click();
  const crop = page.getByRole('dialog', { name: 'Karte ausrichten' });
  await crop.getByRole('button', { name: 'Ausschnitt prüfen' }).click();
  await crop.getByRole('button', { name: 'Texterkennung starten' }).click();
  await expect(add.locator('.w-scan-match-card')).toBeVisible({
    timeout: 30_000,
  });
  const previewWidth = await add
    .locator('.w-original-photo')
    .evaluate((node) => node.getBoundingClientRect().width);
  expect(previewWidth).toBeGreaterThan(95);
  const switcher = add.getByRole('button', { name: /Aufnahmen wechseln/ });
  await expect(switcher).toBeVisible();
  await switcher.click();
  await expect(add.locator('.w-capture-queue')).toBeVisible();
  await add
    .getByRole('button', { name: 'obf-207.webp · offen', exact: true })
    .click();
  await expect(add.locator('.w-photo-review h3')).toHaveText('obf-207.webp');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
