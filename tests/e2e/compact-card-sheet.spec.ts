import { test, expect } from './fixtures';

test('owned card opens compact demo-style hero; advanced inventory controls start collapsed at 375px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Mit Demo ausprobieren', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(18);
  await page.locator('.w-owned-grid button').first().click();
  const dialog = page.getByRole('dialog');
  const hero = dialog.locator('.w-collector-card-overview');
  await expect(hero).toBeVisible();
  await expect(hero.locator('.card-art')).toHaveCount(1);
  await expect(hero.locator('.w-collector-card-set')).toBeVisible();
  const advanced = dialog.locator('.w-collector-card-extras');
  await expect(advanced).not.toHaveAttribute('open');
  await expect(
    dialog.getByRole('button', { name: 'Änderungen speichern' }),
  ).toBeHidden();
  const box = await hero.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await advanced.locator('summary').click();
  await expect(
    dialog.getByRole('button', { name: 'Änderungen speichern' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: /schließen$/ }).click();
  await expect(dialog).toHaveCount(0);
});
