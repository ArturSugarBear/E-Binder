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
      name: destination === 'sammlung' ? 'Sammlung' : 'Meine Binder',
      exact: true,
    });
    if (await desktop.isVisible()) await click(desktop);
    else
      await click(
        page
          .locator('.w-mobile-nav')
          .getByRole('link', { name: 'Sammlung', exact: true }),
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
