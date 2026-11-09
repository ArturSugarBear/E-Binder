import { test, expect } from './fixtures';

test.use({ serviceWorkers: 'allow' });

test('manifest and icons are scoped to GitHub Pages', async ({ page }) => {
  const response = await page.request.get('manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toContain('E-Binder');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/E-Binder/');
  expect(manifest.scope).toBe('/E-Binder/');
  expect(manifest.background_color).toBe('#02070a');
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]),
  );
  for (const icon of manifest.icons as { src: string }[]) {
    expect(icon.src).toMatch(/^\/E-Binder\/icons\//);
    const image = await page.request.get(icon.src);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
  }
  await page.goto('./');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/E-Binder/icons/icon-180.png',
  );
});

test('installed shell and archive can open offline without replacing IndexedDB', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'webkit',
    'Desktop WebKit does not simulate installed iOS PWAs.',
  );
  await page.goto('./');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(async () => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.getByRole('link', { name: 'Meine Binder', exact: true }).click();
  await page.getByRole('button', { name: 'Ersten Binder anlegen' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Name deines Binders')
    .fill('Offline-Testbinder');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Speichern', exact: true })
    .click();
  await expect(page.locator('#workspace-save-status')).toHaveText(
    'Auf diesem Gerät gespeichert',
  );
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Offline-Testbinder' })).toBeVisible();
  await page.goto('archive.html');
  await expect(page.locator('.chapter .grid .pocket')).toHaveCount(9);
});

test('service worker does not target Supabase credentials', async ({
  page,
}) => {
  const response = await page.request.get('sw.js');
  expect(response.ok()).toBe(true);
  const script = await response.text();
  expect(script).toContain('e-binder-public-catalog');
  expect(script).toContain('e-binder-tcgdex-images');
  expect(script).not.toMatch(/auth\/v1|user_workspaces|save_workspace/);
});

test('iPhone browser viewport is contained and install guidance is dismissible', async ({
  page,
}, info) => {
  await page.goto('./');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  const width = await page.evaluate(() => ({
    screen: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.screen + 1);
  if (info.project.name !== 'webkit') return;
  const install = page.locator('[data-pwa-banner="install"]');
  await expect(install).toBeVisible();
  await expect(install).toContainText('Zum Home-Bildschirm');
  await install.getByRole('button', { name: 'Hinweis schließen' }).click();
  await expect(install).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-pwa-banner="install"]')).toHaveCount(0);
});
