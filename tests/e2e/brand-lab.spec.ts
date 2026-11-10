import { test, expect } from './fixtures';

test('lovebrand lab previews three independent complete identities without changing live theme', async ({
  page,
}) => {
  await page.goto('./brand-lab.html');
  const board = page.locator('#preview');
  await expect(board).toHaveAttribute('data-theme', 'keepsake');
  await expect(
    page.getByRole('heading', { name: 'Deine Karten. Deine Geschichten.' }),
  ).toBeVisible();
  await expect(page.locator('.identity-mark svg:visible')).toHaveCount(1);
  await page.getByRole('button', { name: 'Rare Room' }).click();
  await expect(board).toHaveAttribute('data-theme', 'rare');
  await expect(
    page.getByRole('heading', { name: 'Dein Fund. Dein Moment.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rare Room' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Folio House' }).click();
  await expect(board).toHaveAttribute('data-theme', 'folio');
  await expect(
    page.getByRole('heading', { name: 'Ein Album voller Geschichten.' }),
  ).toBeVisible();
  await expect(page.locator('.pockets .art')).toHaveCount(9);
  await page.getByRole('button', { name: 'Keepsake' }).click();
  await expect(board).toHaveAttribute('data-theme', 'keepsake');
});

test('lovebrand lab has no sideways overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('./brand-lab.html');
  await expect(page.locator('#preview')).toBeVisible();
  for (const theme of ['Keepsake', 'Rare Room', 'Folio House']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    const overflow = await page.evaluate(() => ({
      pixels: document.documentElement.scrollWidth - window.innerWidth,
      offenders: [...document.querySelectorAll('body *')]
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 6)
        .map((element) => element.tagName.toLowerCase() + '.' + element.className),
    }));
    expect(overflow.pixels, theme + ': ' + overflow.offenders.join(', ')).toBeLessThanOrEqual(1);
  }
});
