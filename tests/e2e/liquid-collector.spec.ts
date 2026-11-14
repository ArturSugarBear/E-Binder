import { test, expect } from './fixtures';

test('liquid shell remains usable and supports reduce-motion/reduce-transparency', async ({
  page,
}) => {
  await page.goto('./#home');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(page.locator('.w-mobile-nav .w-liquid-optic')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page
    .locator('a[data-workspace-route="entdecken"]:visible')
    .first()
    .click();
  await expect(page).toHaveURL(/#entdecken$/);
  await expect(
    page.getByRole('main').locator('.w-discover-mode'),
  ).toBeVisible();
});

test('full collector glass has clear layers and a real lime active segment', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#binder');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  const vault = page.locator('.w-vault-tabs.w-glass-panel');
  await expect(vault).toBeVisible();
  const material = await vault.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      background: style.backgroundColor,
      blur: style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter'),
      border: style.borderTopColor,
      shadow: style.boxShadow,
    };
  });
  // The old .87 opaque coating flattened the surface on iPhone.
  const alpha = Number(
    material.background.split(',').at(-1)?.replace(')', '').trim(),
  );
  expect(alpha).toBeGreaterThan(0.25);
  expect(alpha).toBeLessThan(0.7);
  expect(material.blur).toContain('blur(');
  expect(material.shadow).toContain('inset');
  await expect(vault.locator('[aria-current="true"]')).toHaveCount(1);
  const activeColor = await vault
    .locator('[aria-current="true"]')
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(activeColor).toBe('rgb(216, 242, 90)');

  const optic = page.locator('.w-mobile-nav .w-liquid-optic');
  await expect(optic).toHaveCount(1);
  await expect(optic).toHaveAttribute('strength', '0.2');
  await expect(optic).toHaveAttribute('saturation', '160');
});

test('camera scanner switches modes without writing inventory', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException('Camera denied', 'NotAllowedError');
        },
      },
    });
  });
  await page.goto('./#sammlung');
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await add.getByRole('button', { name: 'Karte live scannen' }).click();
  const single = page.getByRole('dialog', { name: 'Karte live scannen' });
  await expect(
    single
      .getByRole('group', { name: 'Scanmodus wählen' })
      .getByRole('button', { name: 'Einzelkarte' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await single
    .getByRole('group', { name: 'Scanmodus wählen' })
    .getByRole('button', { name: 'Binderseite' })
    .click();
  const pageScanner = page.getByRole('dialog', {
    name: 'Binderseiten scannen',
  });
  await expect(pageScanner).toBeVisible();
  await pageScanner
    .getByRole('button', { name: 'Binderseite live scannen' })
    .click();
  const livePage = page.getByRole('dialog', {
    name: 'Binderseite live scannen',
  });
  await expect(livePage.locator('.w-live-page-cell')).toHaveCount(9);
  await expect(
    livePage
      .getByRole('group', { name: 'Scanmodus wählen' })
      .getByRole('button', { name: 'Binderseite' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await livePage
    .getByRole('group', { name: 'Scanmodus wählen' })
    .getByRole('button', { name: 'Einzelkarte' })
    .click();
  const returned = page.getByRole('dialog', {
    name: 'Karte live scannen',
  });
  await expect(returned).toBeVisible();
  // One scanner surface: the single scanner reopens directly; no stacked
  // add-card dialog competes with the live camera controls.
  await expect(page.locator('dialog.w-dialog[open]')).toHaveCount(1);
  await returned
    .getByRole('button', { name: 'Karte live scannen schließen' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Karten hinzufügen' }),
  ).toHaveCount(0);
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
