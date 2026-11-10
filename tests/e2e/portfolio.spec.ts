import { openVault } from './navigation';
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
  await expect(page.getByRole('link', { name: 'Portfolio' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test('portfolio reports partial coverage in demo and links to binder pages', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  await page.getByRole('button', { name: 'Mit Demo ausprobieren' }).click();
  await openVault(page, 'portfolio');
  await expect(page.locator('.w-portfolio-balance')).toBeVisible();
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

test('late price responses preserve an opened binder', async ({ page }) => {
  let release!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://api.tcgdex.net/**', async (route) => {
    await responseGate;
    await route.fulfill({
      status: 503,
      body: 'Unavailable for regression test',
    });
  });
  await page.goto('./#sammlung');
  await page.getByRole('button', { name: 'Mit Demo ausprobieren' }).click();
  await openVault(page, 'portfolio');
  await expect(page.locator('.w-portfolio-load-progress')).toBeVisible();
  await page.locator('.w-portfolio-binder summary').click();
  await expect(page.locator('.w-portfolio-binder')).toHaveAttribute('open', '');
  release();
  await expect(page.locator('.w-portfolio-load-progress')).toHaveCount(0);
  await expect(page.locator('.w-portfolio-binder')).toHaveAttribute('open', '');
  await page.locator('.w-portfolio-pages > button').first().click();
  await expect(page).toHaveURL(/#binder$/);
});
