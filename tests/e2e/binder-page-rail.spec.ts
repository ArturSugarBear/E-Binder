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
  await expect(rail.locator('.w-binder-page-thumb')).toHaveCount(1);
  const first = await paper.locator('.w-pocket').first().boundingBox();
  const pager = page.locator('.w-page-pager');
  const pagerBox = await pager.boundingBox();
  const paperBox = await paper.boundingBox();
  // Product change R03: the 3×3 page leads; tools follow below it.
  expect(pagerBox!.y).toBeGreaterThanOrEqual(paperBox!.y + paperBox!.height);
  await expect(
    pager.getByRole('button', { name: 'Nächste Seite' }),
  ).toBeVisible();
  const dock = await page.locator('.w-mobile-nav').boundingBox();
  expect(first).not.toBeNull();
  expect(dock).not.toBeNull();
  expect(first!.y + 40).toBeLessThan(dock!.y);
  await rail.getByRole('button', { name: 'Neue Seite', exact: true }).click();
  await expect(rail.locator('.w-binder-page-thumb')).toHaveCount(2);
  await expect(paper.locator('img')).toHaveCount(0);
  await rail.getByRole('button', { name: /^Seite 1:/ }).click();
  await expect(paper.locator('img')).toHaveCount(9);
  await expect(rail.locator('[aria-current="page"]')).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test('binder page follows the finger and an aborted gesture keeps the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#sammlung');
  await page
    .getByRole('button', { name: 'Mit Demo ausprobieren', exact: true })
    .click();
  await page
    .locator('.w-vault-tabs')
    .getByRole('link', { name: 'Binder', exact: true })
    .click();
  const rail = page.getByRole('navigation', {
    name: 'Binderseiten durchblättern',
  });
  await rail.getByRole('button', { name: 'Neue Seite', exact: true }).click();
  await expect(rail.locator('.w-binder-page-thumb')).toHaveCount(2);
  const paper = page.locator('.w-binder-paper');
  const box = (await paper.boundingBox())!;
  const startX = box.x + box.width * 0.7;
  const y = box.y + Math.min(120, box.height / 3);

  await paper.dispatchEvent('pointerdown', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    clientX: startX,
    clientY: y,
  });
  await paper.dispatchEvent('pointermove', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    clientX: startX - 90,
    clientY: y + 2,
  });
  await expect(paper).toHaveClass(/is-swiping/);
  const offset = await paper.evaluate((node) =>
    Number(node.style.transform.match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0),
  );
  expect(offset).toBeLessThan(0);
  await paper.dispatchEvent('pointerup', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    clientX: startX - 90,
    clientY: y + 2,
  });
  await expect(rail.locator('[aria-current="page"]')).toHaveAttribute(
    'aria-label',
    /^Seite 2/,
  );

  // A short drag below the direction threshold must not change the page.
  const second = (await paper.boundingBox())!;
  await paper.dispatchEvent('pointerdown', {
    pointerId: 8,
    pointerType: 'touch',
    isPrimary: true,
    clientX: second.x + second.width * 0.6,
    clientY: second.y + 100,
  });
  await paper.dispatchEvent('pointermove', {
    pointerId: 8,
    pointerType: 'touch',
    isPrimary: true,
    clientX: second.x + second.width * 0.6 - 30,
    clientY: second.y + 104,
  });
  await paper.dispatchEvent('pointerup', {
    pointerId: 8,
    pointerType: 'touch',
    isPrimary: true,
    clientX: second.x + second.width * 0.6 - 30,
    clientY: second.y + 104,
  });
  await expect(rail.locator('[aria-current="page"]')).toHaveAttribute(
    'aria-label',
    /^Seite 2/,
  );
});
