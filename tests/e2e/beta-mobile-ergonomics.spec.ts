import { test, expect } from './fixtures';

test('guest profile never enables private beta photo donations by default', async ({
  page,
}) => {
  await page.goto('./#profil');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(
    page.getByRole('button', {
      name: 'Foto-Teilnahme ausdrücklich aktivieren',
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Dein Profil' }),
  ).toBeVisible();
});

test('mobile primary navigation remains reachable without horizontal overflow', async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 667 });
    for (const route of [
      'home',
      'entdecken',
      'sammlung',
      'binder',
      'portfolio',
      'profil',
    ]) {
      await page.goto('./#' + route);
      await expect(page.locator('#workspace-main')).toHaveAttribute(
        'data-ready',
        'true',
      );
      const layout = await page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>('.w-mobile-nav');
        const visible = nav && getComputedStyle(nav).display !== 'none';
        const bounds = nav?.getBoundingClientRect();
        const controls = visible
          ? Array.from(
              nav!.querySelectorAll<HTMLElement>(':scope > a, :scope > button'),
            ).map((item) => item.getBoundingClientRect())
          : [];
        return {
          viewport: document.documentElement.clientWidth,
          content: document.documentElement.scrollWidth,
          navLeft: bounds?.left ?? 0,
          navRight: bounds?.right ?? 0,
          visible: Boolean(visible),
          controls: controls.map((box) => ({
            width: box.width,
            height: box.height,
            left: box.left,
            right: box.right,
          })),
        };
      });
      expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);
      if (layout.visible) {
        expect(layout.navLeft).toBeGreaterThanOrEqual(-1);
        expect(layout.navRight).toBeLessThanOrEqual(layout.viewport + 1);
        expect(layout.controls).toHaveLength(5);
        for (const control of layout.controls) {
          expect(control.height).toBeGreaterThanOrEqual(44);
          expect(control.width).toBeGreaterThanOrEqual(44);
          expect(control.left).toBeGreaterThanOrEqual(-1);
          expect(control.right).toBeLessThanOrEqual(layout.viewport + 1);
        }
      }
    }
  }
});

test('short iPhone camera-denied view retains a visible fallback and close action', async ({
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
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./#home');
  await page
    .getByRole('navigation', { name: 'App-Navigation' })
    .getByRole('button', { name: 'Karte scannen' })
    .click();
  const scanner = page.getByRole('dialog', {
    name: 'Karte live scannen',
    exact: true,
  });
  await expect(scanner).toBeVisible();
  await expect(
    scanner.getByRole('button', { name: 'Kamerafoto aufnehmen' }),
  ).toBeVisible();
  const close = scanner.getByRole('button', {
    name: 'Karte live scannen schließen',
  });
  const box = await close.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(scanner).toHaveCount(0);
});
