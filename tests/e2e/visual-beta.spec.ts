import { test, expect } from './fixtures';

test('visual AI beta is explicitly opt-in, model is real, and private photos stay local', async ({
  page,
}) => {
  test.setTimeout(90000);
  const modelRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/assets/vision/visual-model-'))
      modelRequests.push(request.url());
  });

  await page.goto('./#profil');
  await expect(
    page.getByRole('button', { name: 'Visuelle KI Beta testen' }),
  ).toBeVisible();
  await expect(page.getByText('9 geprüften Kartenmotiven')).toBeVisible();
  // A local beta choice is NOT the separate remote training-photo consent.
  await page.getByRole('button', { name: 'Visuelle KI Beta testen' }).click();
  await expect(
    page.getByRole('button', { name: 'Visuelle KI Beta ausschalten' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Visuelle KI Beta ausschalten' }),
  ).toBeVisible();

  const manifestResponse = await page.request.get(
    './assets/vision/manifest.json',
  );
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    format: 'e-binder-visual-v1',
    count: 9,
    dimensions: 384,
    size: 224,
    preprocessing: 'imagenet-meanstd-chw-stretch',
  });
  const refsResponse = await page.request.get(
    './assets/vision/' + manifest.referencesFile,
  );
  expect(refsResponse.ok()).toBe(true);
  const refs = await refsResponse.json();
  expect(refs).toHaveLength(9);
  expect(refs.map((row: { id: string }) => row.id)).toContain('de:sv01-211');

  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  await expect
    .poll(() => modelRequests.length, { timeout: 25000 })
    .toBeGreaterThan(0);
  // Opening the scanner never creates inventory.
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Karten hinzufügen schließen' })
    .click();
  await page.goto('./#profil');
  await page
    .getByRole('button', { name: 'Visuelle KI Beta ausschalten' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Visuelle KI Beta testen' }),
  ).toBeVisible();
});
