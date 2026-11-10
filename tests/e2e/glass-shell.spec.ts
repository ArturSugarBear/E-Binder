import { test, expect } from './fixtures';

test('fresh Rare Room entry explains the collector journey without inventing a portfolio price', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(page).toHaveURL(/#home$/);
  await expect(
    page.getByRole('heading', { name: 'Dein Fund. Dein Moment.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'So beginnt dein Binder' }),
  ).toBeVisible();
  await expect(page.locator('.w-home-step')).toHaveCount(3);
  await expect(page.locator('.w-home-hero')).not.toContainText('€0');
  await expect(page.locator('.w-home-hero')).not.toContainText('100 %');
});

test('the Vault groups binder, cards and portfolio without changing saved holdings', async ({
  page,
}) => {
  await page.goto('./#binder');
  await expect(page.locator('.w-vault-tabs a')).toHaveCount(3);
  await expect(
    page.getByRole('heading', { name: 'Deine Binder' }),
  ).toBeVisible();
  await page
    .locator('.w-vault-tabs')
    .getByRole('link', { name: 'Karten' })
    .click();
  await expect(page).toHaveURL(/#sammlung$/);
  await expect(
    page.getByRole('heading', { name: 'Deine Sammlung' }),
  ).toBeVisible();
  await page
    .locator('.w-vault-tabs')
    .getByRole('link', { name: 'Portfolio' })
    .click();
  await expect(page).toHaveURL(/#portfolio$/);
  await expect(
    page.getByRole('heading', { name: 'Dein Portfolio', exact: true }),
  ).toBeVisible();
  await page
    .locator('.w-vault-tabs')
    .getByRole('link', { name: 'Binder' })
    .click();
  await expect(page).toHaveURL(/#binder$/);
  await expect(page.locator('.w-vault-tabs')).toHaveCount(1);
});

test('profile links lead to real account and backup operations', async ({
  page,
}) => {
  await page.goto('./#profil');
  await expect(
    page.getByRole('heading', { name: 'Dein Profil' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sammlung sichern' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
