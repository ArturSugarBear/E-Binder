import { test, expect } from './fixtures';

test('zero-match scanner keeps the photo and guides the collector to exact-print recovery', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Exercise the genuine app control flow with OCR returning no readable text.
  // This is a failure-path test, not a claim about model accuracy.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    class NoTextOCR {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      postMessage(data: { id: number }) {
        setTimeout(() => {
          this.onmessage?.(
            new MessageEvent('message', {
              data: { id: data.id, type: 'done', text: '' },
            }),
          );
        }, 10);
      }
      terminate() {}
    }
    class WorkerShim extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (String(url).includes('vision-worker'))
          return new NoTextOCR() as unknown as WorkerShim;
        super(url, options);
      }
    }
    Object.defineProperty(window, 'Worker', {
      value: WorkerShim,
      configurable: true,
    });
  });
  await page.route('https://api.tcgdex.net/**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await dialog.locator('input[capture]').setInputFiles(
    'public/assets/cards/svi-211.webp',
  );
  const crop = page.getByRole('dialog', { name: 'Karte ausrichten' });
  await crop.getByRole('button', { name: 'Ausschnitt prüfen' }).click();
  await crop.getByRole('button', { name: 'Texterkennung starten' }).click();
  await expect(dialog.getByRole('heading', { name: 'Wir suchen deine Karte weiter' }))
    .toBeVisible({ timeout: 65_000 });
  await expect(dialog.locator('.w-photo-review img')).toHaveAttribute(
    'src',
    /^blob:/,
  );
  await expect(dialog.getByRole('button', { name: 'Set und Nummer abgleichen' }))
    .toBeVisible();
  await dialog.getByRole('button', { name: 'Set und Nummer abgleichen' }).click();
  await expect(dialog.locator('input[placeholder*="088/063"]')).toBeVisible();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
