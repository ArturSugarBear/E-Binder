import { expect, type Page } from '@playwright/test';

/** Follow the actual desktop or mobile navigation, including the Vault tabs. */
export async function openVault(
  page: Page,
  destination: 'binder' | 'sammlung' | 'portfolio',
): Promise<void> {
  const tabName = {
    binder: 'Binder',
    sammlung: 'Karten',
    portfolio: 'Portfolio',
  }[destination];
  const tab = page
    .locator('.w-vault-tabs')
    .getByRole('link', { name: tabName, exact: true });
  if (await tab.isVisible()) {
    await tab.click();
  } else {
    const desktop = page.locator('.w-navigation').getByRole('link', {
      name: destination === 'sammlung' ? 'Sammlung' : 'Meine Binder',
      exact: true,
    });
    if (await desktop.isVisible()) await desktop.click();
    else
      await page
        .locator('.w-mobile-nav')
        .getByRole('link', { name: 'Sammlung', exact: true })
        .click();
    if (destination !== 'binder' && !page.url().endsWith(`#${destination}`))
      await page
        .locator('.w-vault-tabs')
        .getByRole('link', { name: tabName, exact: true })
        .click();
  }
  await expect(page).toHaveURL(new RegExp(`#${destination}$`));
}
