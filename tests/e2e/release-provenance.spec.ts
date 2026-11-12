import { test, expect } from './fixtures';

test('release version is generated from the built app and is visible on every iPhone screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const response = await page.request.get('./version.json');
  expect(response.ok()).toBe(true);
  const release = (await response.json()) as {
    schema: number;
    version: string;
    commit: string;
    builtAt: string;
  };
  expect(release.schema).toBe(1);
  expect(release.version).toMatch(/^\d+\.\d+\.\d+/);
  expect(release.commit).toMatch(/^(?:[0-9a-f]{7,12}|local)$/);
  expect(Date.parse(release.builtAt)).not.toBeNaN();

  await page.goto('./#entdecken');
  const label = page.locator('#workspace-version');
  await expect(label).toContainText('v' + release.version);
  await expect(label).toContainText(release.commit.slice(0, 8));
  // The accessible name also includes the visible text (WCAG Label in Name).
  await expect(label).toHaveAttribute(
    'aria-label',
    new RegExp(release.commit.slice(0, 8)),
  );
  await expect(label).toHaveAttribute('data-build-commit', release.commit);
  const box = await label.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);

  await label.click();
  await expect(
    page.getByRole('heading', { name: 'App-Version & Updates' }),
  ).toBeVisible();
  await expect(
    page.getByText('Lokal ausgeführt:', { exact: false }),
  ).toContainText(release.commit.slice(0, 8));
  await page
    .getByRole('button', { name: 'Veröffentlichte Version prüfen' })
    .click();
  await expect(page.locator('#workspace-notice')).toContainText(
    'bereits den veröffentlichten Stand',
  );
});

test('an older installed PWA can distinguish its build from current Pages without changing holdings', async ({
  page,
}) => {
  await page.route(/\/version\.json\?check=/, (route) =>
    route.fulfill({
      json: {
        schema: 1,
        version: '9.9.9',
        commit: 'abcdef123456',
        builtAt: '2026-11-12T20:00:00.000Z',
      },
    }),
  );
  await page.goto('./#profil');
  await page
    .getByRole('button', { name: 'Veröffentlichte Version prüfen' })
    .click();
  const banner = page.locator('[data-pwa-banner="update"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('v9.9.9');
  await expect(
    banner.getByRole('button', { name: 'Update anwenden' }),
  ).toBeVisible();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
