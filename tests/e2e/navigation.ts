import { expect, type Page, type Locator } from '@playwright/test';

/** Follow the actual desktop or mobile navigation, including the Vault tabs. */
export async function openVault(
  page: Page,
  destination: 'binder' | 'sammlung' | 'portfolio',
): Promise<number> {
  let steps = 0;
  const click = async (control: Locator) => {
    const before = page.url();
    await control.click();
    if (page.url() !== before) steps++;
  };
  const tabName = {
    binder: 'Binder',
    sammlung: 'Karten',
    portfolio: 'Portfolio',
  }[destination];
  const tab = page
    .locator('.w-vault-tabs')
    .getByRole('link', { name: tabName, exact: true });
  if (await tab.isVisible()) {
    await click(tab);
  } else {
    const desktop = page.locator('.w-navigation').getByRole('link', {
      name: 'Meine Binder',
      exact: true,
    });
    if (await desktop.isVisible()) await click(desktop);
    else
      await click(
        page
          .locator('.w-mobile-nav')
          .getByRole('link', { name: 'Binder', exact: true }),
      );
    if (destination !== 'binder' && !page.url().endsWith(`#${destination}`))
      await click(
        page
          .locator('.w-vault-tabs')
          .getByRole('link', { name: tabName, exact: true }),
      );
  }
  await expect(page).toHaveURL(new RegExp(`#${destination}$`));
  return steps;
}

/** Confirm the app's own sheet. `window.confirm` is no longer used. */
export async function confirmSheet(page: Page, action: string): Promise<void> {
  const sheet = page.locator('dialog.w-confirm-sheet[open]');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: action, exact: true }).click();
  // Wait for the dialog to leave the DOM, not just lose [open]; a closing
  // sheet still intercepts the next click under slow CI.
  await expect(page.locator('dialog.w-confirm-sheet')).toHaveCount(0);
}

/** Close an "unsaved input" guard without accepting a destructive action. */
export async function dismissUnsavedChangesIfAsked(page: Page): Promise<void> {
  const sheet = page.locator('dialog.w-confirm-sheet[open]');
  if (!(await sheet.count())) return;
  const discard = sheet.getByRole('button', { name: 'Verwerfen', exact: true });
  if (await discard.count()) await discard.click();
  await expect(page.locator('dialog.w-confirm-sheet')).toHaveCount(0);
}
