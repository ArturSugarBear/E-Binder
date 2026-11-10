import { test, expect } from './fixtures';

test('liquid shell remains usable and supports reduce-motion/reduce-transparency', async ({ page }) => {
  await page.goto('./#home');
  await expect(page.locator('#workspace-main')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.w-mobile-nav .w-liquid-optic')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('link', { name: 'Entdecken' }).first().click();
  await expect(page).toHaveURL(/#entdecken$/);
  await expect(page.getByRole('main').locator('.w-discover-mode')).toBeVisible();
});

test('camera scanner switches modes without writing inventory', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException('Camera denied', 'NotAllowedError'); } },
    });
  });
  await page.goto('./#sammlung');
  await page.getByRole('main').getByRole('button', { name: 'Karten hinzufügen', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await add.getByRole('button', { name: 'Karte live scannen' }).click();
  const single = page.getByRole('dialog', { name: 'Karte live scannen' });
  await expect(single.getByRole('group', { name: 'Scanmodus wählen' })
    .getByRole('button', { name: 'Einzelkarte' })).toHaveAttribute('aria-pressed', 'true');
  await single.getByRole('group', { name: 'Scanmodus wählen' })
    .getByRole('button', { name: 'Binderseite' }).click();
  const pageScanner = page.getByRole('dialog', { name: 'Binderseiten scannen' });
  await expect(pageScanner).toBeVisible();
  await pageScanner.getByRole('button', { name: 'Binderseite live scannen' }).click();
  const livePage = page.getByRole('dialog', { name: 'Binderseite live scannen' });
  await expect(livePage.locator('.w-live-page-cell')).toHaveCount(9);
  await expect(livePage.getByRole('group', { name: 'Scanmodus wählen' })
    .getByRole('button', { name: 'Binderseite' })).toHaveAttribute('aria-pressed', 'true');
  await livePage.getByRole('group', { name: 'Scanmodus wählen' })
    .getByRole('button', { name: 'Einzelkarte' }).click();
  await expect(page.getByRole('dialog', { name: 'Karten hinzufügen' })).toBeVisible();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
