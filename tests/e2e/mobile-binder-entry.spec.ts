import { test, expect } from './fixtures';

for (const width of [320, 390]) {
  test(`binder entry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./#sammlung');
    await page
      .getByRole('button', { name: 'Mit Demo ausprobieren', exact: true })
      .click();
    await expect(page.locator('.w-owned-grid button')).toHaveCount(18);
    await page
      .locator('.w-vault-tabs')
      .getByRole('link', { name: 'Binder', exact: true })
      .click();
    await expect(page.locator('.w-binder-paper img')).toHaveCount(9);

    const pockets = page.locator('.w-binder-paper .w-pocket');
    const first = await pockets.first().boundingBox();
    const dock = await page.locator('.w-mobile-nav').boundingBox();
    expect(first).not.toBeNull();
    expect(dock).not.toBeNull();
    // A meaningful portion of the card, not just its top border, is visible.
    expect(first!.y + Math.min(60, first!.height / 2)).toBeLessThan(dock!.y);
    const rootWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(rootWidth).toBeLessThanOrEqual(width);

    await pockets.first().click();
    const detail = page.getByRole('dialog', { name: /^Platz 1/ });
    await expect(detail).toBeVisible();
    await detail.getByRole('button', { name: /schließen/i }).click();
    await expect(detail).toHaveCount(0);
    await expect(page.locator('.w-binder-paper img')).toHaveCount(9);

    // Page actions must remain available after moving the mobile sidebar.
    const management = page.locator('.w-page-controls');
    await management.locator('summary').click();
    const addPage = management.getByRole('button', {
      name: 'Leere Seite hinzufügen',
    });
    await expect(addPage).toBeVisible();
  });
}
