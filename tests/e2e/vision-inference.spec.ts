import { test, expect } from './fixtures';

/**
 * Unlike the UI-only pilot tests, this test runs the shipped ONNX weights in
 * an actual browser Worker against its real int8 index. The single source
 * photo is bundled pilot artwork, NOT a photographed iPhone accuracy sample.
 * Run in Chromium and WebKit; a passing WebKit simulation is not a real iPhone.
 */
test('real local vision Worker retrieves a bundled reference twice', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('./#profil');
  await page
    .getByRole('button', { name: 'Visuelle KI Beta testen' })
    .click();

  const workerCreated = page.waitForEvent('worker', {
    predicate: (worker) => worker.url().includes('visual-worker'),
    timeout: 30_000,
  });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const visualWorkerURL = (await workerCreated).url();
  await page
    .getByRole('button', { name: 'Karten hinzufügen schließen' })
    .click();

  const result = await page.evaluate(async (url) => {
    const response = await fetch('./assets/cards/svi-211.webp');
    if (!response.ok) throw new Error('Pilot reference unavailable');
    const image = await response.blob();
    const manifestUrl = new URL(
      './assets/vision/manifest.json',
      location.href,
    ).href;
    const worker = new Worker(url, { type: 'module' });
    type Hit = {
      reference: { id: string };
      similarity: number;
      visualRank: number;
    };
    const match = (id: number): Promise<{ hits: Hit[]; ms: number }> =>
      new Promise((resolve, reject) => {
        const start = performance.now();
        const timeout = setTimeout(() => {
          worker.removeEventListener('message', onMessage);
          reject(new Error('Real visual ONNX inference timed out'));
        }, 100_000);
        const onMessage = (
          event: MessageEvent<{
            id?: number;
            type?: string;
            hits?: Hit[];
            message?: string;
          }>,
        ) => {
          if (event.data.id !== id) return;
          clearTimeout(timeout);
          worker.removeEventListener('message', onMessage);
          if (event.data.type === 'done')
            resolve({
              hits: event.data.hits ?? [],
              ms: performance.now() - start,
            });
          else {
            const reason = event.data.message ?? 'Model inference failed';
            reject(new Error(reason));
          }
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage({ id, photo: image, manifestUrl });
      });
    try {
      return [await match(41), await match(42)];
    } finally {
      worker.terminate();
    }
  }, visualWorkerURL);

  for (const scan of result) {
    expect(scan.hits.length).toBe(5);
    expect(scan.hits[0]?.reference.id).toBe('de:sv01-211');
    expect(scan.hits[0]?.visualRank).toBe(1);
    expect(scan.hits.every((hit) => Number.isFinite(hit.similarity))).toBe(
      true,
    );
    expect(scan.ms).toBeGreaterThan(0);
  }
  expect(result[0]?.hits.map((hit) => hit.reference.id)).toEqual(
    result[1]?.hits.map((hit) => hit.reference.id),
  );
  console.log(
    'Real ONNX clean-reference Worker smoke, not camera accuracy:',
    result.map((scan) => Math.round(scan.ms)),
  );
});
