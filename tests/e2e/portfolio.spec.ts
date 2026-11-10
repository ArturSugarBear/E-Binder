import { test, expect } from './fixtures';

test('portfolio opens directly without inventing a zero market price', async ({
  page,
}) => {
  await page.goto('./#portfolio');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(
    page.getByRole('heading', { name: 'Dein Portfolio', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.w-portfolio-balance')).toHaveText('—');
  await expect(
    page.getByRole('heading', { name: 'Wert deiner Binder' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Portfolio' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test('portfolio retains unpriced demo collection and links to binder pages', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Mit Demo ausprobieren' }).click();
  await page.getByRole('link', { name: 'Portfolio' }).click();
  await expect(page.locator('.w-portfolio-balance')).toHaveText('—');
  await expect(page.locator('.w-portfolio-binder')).toHaveCount(1);
  await page.locator('.w-portfolio-binder summary').click();
  await expect(
    page.locator('.w-portfolio-pages > button').first(),
  ).toBeVisible();
  await page.locator('.w-portfolio-pages > button').first().click();
  await expect(page).toHaveURL(/#binder$/);
  await expect(
    page.getByRole('heading', { name: 'Deine Binder', exact: true }),
  ).toBeVisible();
});
