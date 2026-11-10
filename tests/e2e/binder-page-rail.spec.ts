import { test, expect } from './fixtures';

test('mobile binder opens on the physical 3x3 page and adds a page from the rail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Mit Demo ausprobieren', exact: true })
    .click();
  await page
    .locator('.w-vault-tabs')
    .getByRole('link', { name: 'Binder', exact: true })
    .click();
  const paper = page.locator('.w-binder-paper');
  const rail = page.getByRole('navigation', {
    name: 'Binderseiten durchblättern',
  });
  await expect(paper.locator('button.w-pocket')).toHaveCount(9);
  await expect(paper.locator('img')).toHaveCount(9);
  await expect(rail.locator('.w-binder-page-thumb')).toHaveCount(2);
  const first = await paper.locator('.w-pocket').first().boundingBox();
  const dock = await page.locator('.w-mobile-nav').boundingBox();
  expect(first).not.toBeNull();
  expect(dock).not.toBeNull();
  expect(first!.y + 40).toBeLessThan(dock!.y);
  await rail.getByRole('button', { name: 'Neue Seite', exact: true }).click();
  await expect(rail.locator('.w-binder-page-thumb')).toHaveCount(3);
  await expect(paper.locator('img')).toHaveCount(0);
  await rail.getByRole('button', { name: /^Seite 2:/ }).click();
  await expect(paper.locator('img')).toHaveCount(9);
  await rail.getByRole('button', { name: /^Seite 1:/ }).click();
  await expect(paper.locator('img')).toHaveCount(9);
  await expect(rail.locator('[aria-current="page"]')).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
