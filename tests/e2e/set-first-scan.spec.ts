import { test, expect } from './fixtures';

test('scan resolves Japanese M1L 088/063 automatically without asking for a set code', async ({
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
  await page.route('https://api.tcgdex.net/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const set = {
      id: 'M1L',
      name: 'メガブレイブ',
      cardCount: { official: 63 },
    };
    const resume = {
      id: 'M1L-088',
      localId: '088',
      name: 'メガルカリオex',
    };
    if (path.endsWith('/ja/sets')) return route.fulfill({ json: [set] });
    if (path.endsWith('/ja/cards') && url.searchParams.has('localId'))
      return route.fulfill({ json: [resume] });
    if (path.endsWith('/ja/sets/M1L'))
      return route.fulfill({
        json: { ...set, cards: [resume] },
      });
    if (path.endsWith('/ja/cards/M1L-088'))
      return route.fulfill({
        json: { ...resume, set, variants: { holo: true } },
      });
    if (path.endsWith('/series/tcgp'))
      return route.fulfill({ json: { id: 'tcgp', sets: [] } });
    if (path.endsWith('/sets') || path.endsWith('/series'))
      return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await add
    .locator('input[capture]')
    .setInputFiles('public/assets/cards/svi-211.webp');
  const crop = page.getByRole('dialog', { name: 'Karte ausrichten' });
  await crop.getByRole('button', { name: 'Ausschnitt prüfen' }).click();
  await crop.getByRole('button', { name: 'Texterkennung starten' }).click();
  await expect(add.locator('.w-scan-match-card')).toBeVisible({
    timeout: 30_000,
  });
  await expect(add.locator('.w-scan-set-panel')).toHaveCount(0);
  const scanResult = await add.locator('.w-search-results').evaluate((node) => ({
    version: node.dataset.scanResultContract,
    ranked: JSON.parse(node.dataset.scanRankedKeys ?? 'null') as string[] | null,
  }));
  expect(scanResult.version).toBe('1');
  expect(scanResult.ranked?.[0]).toBe('tcgdex:ja:M1L-088');
  await expect(add.locator('.w-scan-match-card')).toContainText(
    'メガルカリオex',
  );
  await expect(add.locator('.w-scan-match-card')).toContainText('088/63');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await add
    .getByRole('button', { name: 'Karte hinzufügen', exact: true })
    .click();
  await expect(add.locator('.w-capture-queue')).toContainText(
    '0 offen · 1 übernommen',
  );
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
});
