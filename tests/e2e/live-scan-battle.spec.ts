import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Playwright exercises a real in-browser <video> pipeline backed by a locally
 * generated MediaStream. The OCR worker is deliberately stubbed so these
 * tests measure camera/edge/queue lifecycle, NOT recognition accuracy.
 */
async function installCameraRig(page: Page, warmupDelayMs = 0): Promise<void> {
  await page.addInitScript((warmupDelayMs: number) => {
    type Rig = {
      setMode: (mode: string) => void;
      trackStates: () => string[];
      streams: MediaStream[];
      ocrRequests: () => number;
    };
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 512;
    const context = canvas.getContext('2d')!;
    let mode = 'blank';
    let ocrCalls = 0;
    const streams: MediaStream[] = [];
    const draw = () => {
      context.fillStyle = '#dedede';
      context.fillRect(0, 0, 384, 512);
      if (mode.startsWith('card')) {
        // Portrait 2.5:3.5 card; clean dark border on light tabletop.
        context.fillStyle = '#141414';
        context.fillRect(62, 61, 260, 390);
        context.fillStyle = mode === 'card2' ? '#6487a1' : '#384756';
        context.fillRect(76, 77, 232, 354);
        context.fillStyle = mode === 'card2' ? '#bd68c0' : '#8da9ad';
        context.fillRect(91, 109, 197, 170);
        // Each physical-card stand-in has distinct pixels; reusing card 1
        // would correctly hit the existing duplicate-photo guard.
        const cardIndex = Number(mode.slice(4)) || 1;
        context.fillStyle = `hsl(${cardIndex * 53} 55% 45%)`;
        context.fillRect(100, 310, 90, 45);
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
      ocrRequests: () => ocrCalls,
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
            event: MessageEvent<{ type: string; id?: number; text?: string }>,
          ) => void)
        | null = null;
      onerror: ((event: Event) => void) | null = null;
      postMessage(data: { id?: number; warmup?: boolean }) {
        // A model warmup is not a recognized photo and must not inflate
        // measured live OCR calls or simulate a result.
        if (data.warmup) {
          setTimeout(
            () =>
              this.onmessage?.(
                new MessageEvent('message', { data: { type: 'ready' } }),
              ),
            warmupDelayMs,
          );
          return;
        }
        if (typeof data.id !== 'number') return;
        const id = data.id;
        ocrCalls++;
        setTimeout(() => {
          this.onmessage?.(
            new MessageEvent('message', {
              data: {
                type: 'done',
                id,
                text: '',
              },
            }),
          );
        }, 800);
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
  }, warmupDelayMs);
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
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    includeHidden: true,
  });
  await add.getByRole('button', { name: 'Karte live scannen' }).click();
  const live = page.getByRole('dialog', { name: 'Karte live scannen' });
  await expect(live.locator('.w-live-status')).toContainText(
    'Ecken werden gesucht',
    { timeout: 15_000 },
  );
  await mode(page, 'square');
  await page.waitForTimeout(1300);
  await expect(
    live.getByRole('button', { name: 'Manuell aufnehmen' }),
  ).toBeVisible({ timeout: 10000 });
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

for (const width of [320, 375, 390, 430]) {
  test(`five consecutive scans keep a stable reviewable UI at ${width}px without ownership`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('webkit'),
      'Deterministic canvas MediaStream simulator is Chromium-specific; native iPhone capture needs a device.',
    );
    await installCameraRig(page);
    await page.setViewportSize({ width, height: width === 320 ? 667 : 844 });
    await page.goto('./#sammlung');
    await page
      .getByRole('button', { name: 'Karten hinzufügen', exact: true })
      .click();
    const add = page.getByRole('dialog', {
      name: 'Karten hinzufügen',
      includeHidden: true,
    });
    await add.getByRole('button', { name: 'Karte live scannen' }).click();
    const live = page.getByRole('dialog', { name: 'Karte live scannen' });
    await expect(live.locator('.w-live-status')).toContainText(
      'Ecken werden gesucht',
      { timeout: 15_000 },
    );
    // Measure the settled sheet, not its existing entry animation.
    await live.evaluate(async (node) => {
      await Promise.all(
        node.getAnimations().map((animation) => animation.finished),
      );
    });
    const originalFrame = await live
      .locator('.w-live-frame-guide')
      .boundingBox();
    expect(originalFrame).not.toBeNull();
    expect(originalFrame!.width / originalFrame!.height).toBeCloseTo(
      63 / 88,
      2,
    );
    await expect(live.locator('.w-live-options')).not.toHaveAttribute('open');
    const initialStage = await live.locator('.w-live-stage').boundingBox();
    const initialFooter = await live.locator('.w-dialog-footer').boundingBox();
    await expect(live.locator('.w-live-analysis')).toBeHidden();
    await mode(page, 'card');
    await expect(live.locator('.w-live-status')).toContainText(
      /Aufnahme vorgemerkt|Scan fehlgeschlagen/,
      { timeout: 35_000 },
    );
    await expect(live.locator('.w-live-status')).toContainText(
      'Aufnahme vorgemerkt',
    );
    await expect(live.locator('.w-live-review-summary')).toContainText(
      '1 offene Aufnahme',
    );
    await expect(live.locator('.w-live-review-summary')).toContainText(
      'erst nach deiner Bestätigung',
    );
    await expect(add.locator('.w-capture-queue')).toContainText('1 offen');
    await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
    // The scanner displays an animation only during genuine background work;
    // OCR starts before the user clicks Results and can use two hot-zone
    // retries with a common bounded deadline.
    await expect(live.locator('.w-live-analysis')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __scanRig: { ocrRequests: () => number };
            }
          ).__scanRig.ocrRequests(),
        ),
      )
      .toBe(3);
    await expect(live.locator('.w-live-analysis')).toBeHidden();
    // P07: removing the card automatically re-arms the same camera stream.
    // No manual Next tap, repeated camera permission request or OCR stall.
    await mode(page, 'blank');
    await expect(
      live.getByRole('button', { name: 'Ergebnisse prüfen (1)', exact: true }),
    ).toBeVisible();
    await expect(live.locator('.w-live-status')).toContainText(
      'Ecken werden gesucht',
      { timeout: 10_000 },
    );
    expect(
      await page.evaluate(
        () =>
          (
            window as typeof window & {
              __scanRig: { streams: MediaStream[] };
            }
          ).__scanRig.streams.length,
      ),
    ).toBe(1);
    const nextFrame = await live.locator('.w-live-frame-guide').boundingBox();
    expect(nextFrame).not.toBeNull();
    expect(nextFrame!.width).toBeCloseTo(originalFrame!.width, 0);
    expect(nextFrame!.height).toBeCloseTo(originalFrame!.height, 0);
    expect(nextFrame!.width / nextFrame!.height).toBeCloseTo(63 / 88, 2);
    await mode(page, 'card2');
    await expect(live.locator('.w-live-status')).toContainText(
      'Aufnahme vorgemerkt',
      {
        timeout: 35_000,
      },
    );
    await expect(add.locator('.w-capture-queue')).toContainText('2 offen');
    await expect(live.locator('.w-live-review-summary')).toContainText(
      '2 offene Aufnahmen',
    );
    // P07 background OCR starts while the live camera is still open.
    // Crucially, two consecutive captures use one camera stream even when OCR
    // is underway; no additional click or model/network wait is required.
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __scanRig: { ocrRequests: () => number };
            }
          ).__scanRig.ocrRequests(),
        ),
      )
      .toBe(6);
    expect(
      await page.evaluate(
        () =>
          (
            window as typeof window & {
              __scanRig: { streams: MediaStream[] };
            }
          ).__scanRig.streams.length,
      ),
    ).toBe(1);
    // Continue without Next taps: the real removal latch re-arms the stream.
    for (let count = 3; count <= 5; count++) {
      await mode(page, 'blank');
      await expect(live.locator('.w-live-stage')).toHaveAttribute(
        'data-scan-phase',
        'ready',
      );
      await mode(page, `card${count}`);
      await expect(live.locator('.w-live-review-summary')).toContainText(
        `${count} offene Aufnahmen`,
      );
      const stage = await live.locator('.w-live-stage').boundingBox();
      const footer = await live.locator('.w-dialog-footer').boundingBox();
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(stage![key]).toBeCloseTo(initialStage![key], 0);
        expect(footer![key]).toBeCloseTo(initialFooter![key], 0);
      }
      const status = await live.locator('.w-live-status').boundingBox();
      expect(status!.y + status!.height).toBeLessThanOrEqual(footer!.y);
      const review = live.getByRole('button', {
        name: `Ergebnisse prüfen (${count})`,
        exact: true,
      });
      await expect(review).toBeInViewport({ ratio: 1 });
      expect(
        await live.evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
    }
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { __scanRig: { streams: MediaStream[] } })
            .__scanRig.streams.length,
      ),
    ).toBe(1);
    await expect(live.locator('.w-live-analysis')).toBeHidden({
      timeout: 15_000,
    });
    await expect(live.locator('.w-live-stage')).not.toHaveClass(/is-analyzing/);
    await testInfo.attach(`queued-${width}px`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(live.locator('.w-live-analysis-line')).toHaveCSS(
      'animation-name',
      'none',
    );
    await live.getByRole('button', { name: 'Ergebnisse prüfen' }).click();
    // The native close event owns cleanup; wait for it before reading tracks.
    await expect(live).toHaveCount(0);
    await expect
      .poll(async () => {
        const states = await page.evaluate(() =>
          (
            window as typeof window & {
              __scanRig: { trackStates: () => string[] };
            }
          ).__scanRig.trackStates(),
        );
        return states.length > 0 && states.every((state) => state === 'ended');
      })
      .toBe(true);
    await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
    // Only live photos from this session are reviewable. No filenames or
    // historical capture-management wall appears after the camera closes.
    await expect(add).toHaveClass(/w-quick-review/);
    await expect(add.locator('.w-original-photo img')).toHaveCount(1);
    await expect(add.locator('.w-original-photo')).not.toContainText(
      'Kein Foto gespeichert',
    );
    await expect(add.locator('.w-capture-queue')).not.toContainText(
      'Live-Scan-',
    );
    await add
      .getByRole('button', { name: 'Karten hinzufügen schließen' })
      .click();
    // Closed live sessions discard abandoned preview metadata automatically.
    // A restart must never expose dead image placeholders or demand cleanup.
    await page.reload();
    await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Erfassung fortsetzen' }),
    ).toHaveCount(0);
  });
}

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
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    includeHidden: true,
  });
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

for (const width of [320, 375, 390, 430]) {
  test(`camera-denied recovery stays accessible at ${width}px with reduced motion`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 667 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException('Camera denied', 'NotAllowedError');
          },
        },
      });
    });
    await page.goto('./#sammlung');
    await page
      .getByRole('button', { name: 'Karten hinzufügen', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Karte live scannen', exact: true })
      .click();
    const live = page.getByRole('dialog', { name: 'Karte live scannen' });
    await expect(live.locator('.w-live-status')).toContainText(
      'Live-Kamera nicht verfügbar',
    );
    const fallback = live.getByRole('button', {
      name: 'Kamerafoto aufnehmen',
      exact: true,
    });
    await expect(fallback).toBeInViewport({ ratio: 1 });
    await expect(live.locator('.w-live-analysis')).toBeHidden();
    expect(
      await live.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    const status = await live.locator('.w-live-status').boundingBox();
    const button = await fallback.boundingBox();
    expect(status!.y + status!.height).toBeLessThanOrEqual(button!.y);
    await testInfo.attach(`denied-${width}px`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
}

test('cold model loading and queued photos do not consume their inference windows or cover the preview', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'webkit',
    'Canvas MediaStream simulator is Chromium-specific.',
  );
  await installCameraRig(page, 8000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    includeHidden: true,
  });
  await add
    .getByRole('button', { name: 'Karte live scannen', exact: true })
    .click();
  const live = page.getByRole('dialog', {
    name: 'Karte live scannen',
    exact: true,
  });
  await mode(page, 'card');
  await expect(live.locator('.w-live-review-summary')).toContainText(
    '1 offene Aufnahme',
    { timeout: 15000 },
  );
  await expect(live.locator('.w-live-analysis')).toBeVisible();
  await expect(live.locator('.w-live-manual-capture')).toBeHidden();
  const camera = await live.locator('.w-live-stage').boundingBox(),
    caption = await live.locator('.w-live-analysis-caption').boundingBox();
  expect(caption!.y).toBeGreaterThanOrEqual(camera!.y + camera!.height);
  await mode(page, 'blank');
  await expect(live.locator('.w-live-stage')).toHaveAttribute(
    'data-scan-phase',
    'ready',
  );
  await mode(page, 'card2');
  await expect(live.locator('.w-live-review-summary')).toContainText(
    '2 offene Aufnahmen',
  );
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __scanRig: { ocrRequests: () => number };
            }
          ).__scanRig.ocrRequests(),
        ),
      { timeout: 20000 },
    )
    .toBe(6);
  await expect(live.locator('.w-live-analysis')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await live
    .getByRole('button', { name: 'Karte live scannen schließen' })
    .click();
});
