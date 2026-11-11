import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Playwright exercises a real in-browser <video> pipeline backed by a locally
 * generated MediaStream. The OCR worker is deliberately stubbed so these
 * tests measure camera/edge/queue lifecycle, NOT recognition accuracy.
 */
async function installCameraRig(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Rig = {
      setMode: (mode: string) => void;
      trackStates: () => string[];
      streams: MediaStream[];
    };
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 512;
    const context = canvas.getContext('2d')!;
    let mode = 'blank';
    const streams: MediaStream[] = [];
    const draw = () => {
      context.fillStyle = '#dedede';
      context.fillRect(0, 0, 384, 512);
      if (mode === 'card' || mode === 'card2') {
        // Portrait 2.5:3.5 card; clean dark border on light tabletop.
        context.fillStyle = '#141414';
        context.fillRect(62, 61, 260, 390);
        context.fillStyle = mode === 'card2' ? '#6487a1' : '#384756';
        context.fillRect(76, 77, 232, 354);
        context.fillStyle = mode === 'card2' ? '#bd68c0' : '#8da9ad';
        context.fillRect(91, 109, 197, 170);
      } else if (mode === 'square') {
        context.fillStyle = '#111';
        context.fillRect(39, 105, 306, 306);
      } else if (mode === 'landscape') {
        context.fillStyle = '#111';
        context.fillRect(30, 150, 324, 212);
      }
    };
    draw();
    window.setInterval(draw, 90);
    const rig: Rig = {
      setMode(nextMode: string) {
        mode = nextMode;
        draw();
      },
      streams,
      trackStates: () =>
        streams.flatMap((stream) =>
          stream.getTracks().map((track) => track.readyState),
        ),
    };
    (window as typeof window & { __scanRig?: Rig }).__scanRig = rig;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const stream = canvas.captureStream(24);
          streams.push(stream);
          return stream;
        },
      },
    });
    const NativeWorker = window.Worker;
    class StubOCR {
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
              data: {
                type: 'done',
                id: data.id,
                text: '',
              },
            }),
          );
        }, 30);
      }
      terminate() {}
    }
    class InterceptWorker extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (String(url).includes('vision-worker'))
          return new StubOCR() as unknown as InterceptWorker;
        super(url, options);
      }
    }
    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: InterceptWorker,
    });
  });
  // Catalogue lookups are optional, but must not make the lifecycle
  // benchmark dependent on a live external HTTP service.
  await page.route('https://api.tcgdex.net/**', (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
}

async function mode(page: Page, chosen: string): Promise<void> {
  await page.evaluate((value) => {
    const rig = (
      window as typeof window & {
        __scanRig?: { setMode: (next: string) => void };
      }
    ).__scanRig;
    if (!rig) throw new Error('Camera test rig not registered');
    rig.setMode(value);
  }, chosen);
}

test('fake live video never auto-captures a blank scene or a square', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes('webkit'),
    'Deterministic canvas MediaStream simulator is Chromium-specific; native iPhone capture needs a device.',
  );
  await installCameraRig(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await add.getByRole('button', { name: 'Karte live scannen' }).click();
  const live = page.getByRole('dialog', { name: 'Karte live scannen' });
  await expect(live.locator('.w-live-status')).toContainText(
    'Ecken werden gesucht',
    { timeout: 15_000 },
  );
  await mode(page, 'square');
  await page.waitForTimeout(1300);
  await expect(
    live.getByRole('button', { name: 'Jetzt aufnehmen' }),
  ).toBeVisible();
  await expect(live.locator('.w-live-progress')).toHaveJSProperty('value', 0);
  await expect(add.locator('.w-capture-queue')).toBeEmpty();
  await mode(page, 'landscape');
  await page.waitForTimeout(1200);
  await expect(add.locator('.w-capture-queue')).toBeEmpty();
  await live
    .getByRole('button', { name: 'Karte live scannen schließen' })
    .click();
  // Wait until the native close event runs the cleanup callback.
  await expect(live).toHaveCount(0);
  // A closed scanner must release *every* acquired camera track, including
  // streams from a late permission or play response. Poll the browser's own
  // readyState rather than treating a removed dialog as proof of cleanup.
  await expect
    .poll(async () => {
      const states = await page.evaluate(() => {
        const rig = (
          window as typeof window & {
            __scanRig: { trackStates: () => string[] };
          }
        ).__scanRig;
        return rig.trackStates();
      });
      return states.length > 0 && states.every((state) => state === 'ended');
    })
    .toBe(true);
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('three stable video observations create a reviewable scan but never ownership', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes('webkit'),
    'Deterministic canvas MediaStream simulator is Chromium-specific; native iPhone capture needs a device.',
  );
  await installCameraRig(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await add.getByRole('button', { name: 'Karte live scannen' }).click();
  const live = page.getByRole('dialog', { name: 'Karte live scannen' });
  await expect(live.locator('.w-live-status')).toContainText(
    'Ecken werden gesucht',
    { timeout: 15_000 },
  );
  const originalFrame = await live.locator('.w-live-frame-guide').boundingBox();
  expect(originalFrame).not.toBeNull();
  expect(originalFrame!.width / originalFrame!.height).toBeCloseTo(63 / 88, 2);
  await expect(live.locator('.w-live-options')).not.toHaveAttribute('open');
  await mode(page, 'card');
  await expect(live.locator('.w-live-status')).toContainText(
    /Aufnahme verarbeitet|Scan fehlgeschlagen/,
    { timeout: 35_000 },
  );
  await expect(live.locator('.w-live-status')).toContainText(
    'Aufnahme verarbeitet',
  );
  await expect(live.locator('.w-live-review-summary')).toContainText(
    '1 offene Aufnahme',
  );
  await expect(live.locator('.w-live-review-summary')).toContainText(
    'erst nach deiner Bestätigung',
  );
  await expect(add.locator('.w-capture-queue')).toContainText('1 offen');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await mode(page, 'blank');
  await live.getByRole('button', { name: 'Nächste Karte scannen' }).click();
  await expect(
    live.getByRole('button', { name: 'Ergebnisse prüfen (1)', exact: true }),
  ).toBeVisible();
  await expect(live.locator('.w-live-status')).toContainText(
    'Ecken werden gesucht',
    { timeout: 10_000 },
  );
  const nextFrame = await live.locator('.w-live-frame-guide').boundingBox();
  expect(nextFrame).not.toBeNull();
  expect(nextFrame!.width).toBeCloseTo(originalFrame!.width, 0);
  expect(nextFrame!.height).toBeCloseTo(originalFrame!.height, 0);
  expect(nextFrame!.width / nextFrame!.height).toBeCloseTo(63 / 88, 2);
  await mode(page, 'card2');
  await expect(live.locator('.w-live-status')).toContainText(
    'Aufnahme verarbeitet',
    {
      timeout: 35_000,
    },
  );
  await expect(add.locator('.w-capture-queue')).toContainText('2 offen');
  await expect(live.locator('.w-live-review-summary')).toContainText(
    '2 offene Aufnahmen',
  );
  await live.getByRole('button', { name: 'Ergebnisse prüfen' }).click();
  const states = await page.evaluate(() =>
    (
      window as typeof window & { __scanRig: { trackStates: () => string[] } }
    ).__scanRig.trackStates(),
  );
  expect(states.every((state) => state === 'ended')).toBe(true);
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await add
    .getByRole('button', { name: 'Karten hinzufügen schließen' })
    .click();
  await page.reload();
  await page.getByRole('button', { name: 'Erfassung fortsetzen' }).click();
  await expect(page.locator('.w-photo-review img')).toHaveCount(0);
  await expect(page.locator('.w-capture-queue')).toContainText('2 offen');
});

test('closing the scanner while camera permission is pending releases late tracks', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes('webkit'),
    'Pending-permission simulator requires canvas MediaStream in Chromium.',
  );
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 512;
    let release: (() => void) | undefined;
    let created: MediaStream | undefined;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () =>
          new Promise<MediaStream>((resolve) => {
            release = () => {
              created = canvas.captureStream(15);
              resolve(created);
            };
          }),
      },
    });
    (
      window as typeof window & {
        __lateCamera?: {
          release: () => void;
          state: () => string;
        };
      }
    ).__lateCamera = {
      release: () => release?.(),
      state: () => created?.getTracks()[0]?.readyState ?? 'missing',
    };
  });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await add.getByRole('button', { name: 'Karte live scannen' }).click();
  const live = page.getByRole('dialog', { name: 'Karte live scannen' });
  await expect(live.locator('.w-live-status')).toContainText(
    'Kamera wird gestartet',
  );
  await live
    .getByRole('button', { name: 'Karte live scannen schließen' })
    .click();
  await page.evaluate(() =>
    (
      window as typeof window & { __lateCamera: { release: () => void } }
    ).__lateCamera.release(),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & { __lateCamera: { state: () => string } }
        ).__lateCamera.state(),
      ),
    )
    .toBe('ended');
  await expect(add.locator('.w-capture-queue')).toBeEmpty();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
