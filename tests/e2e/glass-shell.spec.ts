import { openVault } from './navigation';
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

test('Home and Profile actions reach the named task and cancellation preserves an empty collection', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
    });
  });
  await page.goto('./#home');
  const main = page.getByRole('main');
  // The single primary scan CTA replaces the old duplicate onboarding button.
  for (const caption of ['Karte live scannen']) {
    await main.getByRole('button', { name: caption, exact: true }).click();
    const live = page.getByRole('dialog', {
      name: 'Karte live scannen',
      exact: true,
    });
    await expect(live.locator('.w-live-status')).toBeVisible();
    const close = live.getByRole('button', {
      name: 'Karte live scannen schließen',
      exact: true,
    });
    const box = await close.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await close.click();
    await page
      .getByRole('dialog', { name: 'Karten hinzufügen', exact: true })
      .getByRole('button', { name: 'Karten hinzufügen schließen', exact: true })
      .click();
    await expect(
      main.getByRole('button', { name: caption, exact: true }),
    ).toBeFocused();
  }
  await main.getByRole('button', { name: 'Meine Binder', exact: true }).click();
  await expect(page).toHaveURL(/#binder$/);
  await expect(
    page.getByRole('button', { name: 'Ersten Binder anlegen' }),
  ).toBeVisible();
  await page.goto('./#profil');
  for (const [caption, title] of [
    ['Konto verwalten', 'Sammlung im Konto sichern'],
    ['Sammlung sichern', 'Sichern & wiederherstellen'],
    ['Binderseiten scannen', 'Binderseiten scannen'],
  ]) {
    await main.getByRole('button', { name: new RegExp(`^${caption}`) }).click();
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('button', { name: `${title} schließen`, exact: true })
      .click();
  }
  await main.getByRole('button', { name: /^Live-Kartenscanner/ }).click();
  await expect(
    page.getByRole('dialog', { name: 'Karte live scannen', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await main.getByRole('button', { name: /^Wunschliste/ }).click();
  await expect(page).toHaveURL(/#wunschliste$/);
  await expect(page.locator('.w-wish-card')).toHaveCount(0);
  await page.goto('./#profil');
  await main.getByRole('button', { name: /^Katalog durchsuchen/ }).click();
  await expect(page).toHaveURL(/#entdecken/);
  await openVault(page, 'sammlung');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await expect(page.locator('#workspace-demo')).toBeHidden();
});
