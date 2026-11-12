import { expect, test } from './fixtures';

const routes = ['home', 'entdecken', 'binder', 'portfolio', 'profil'] as const;
const widths = [320, 375, 390, 430] as const;

for (const width of widths) {
  test('Rare Room mobile surfaces fit and scan opens at ' + width + 'px', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === 'chromium',
      'Phone viewport checks run on mobile Chromium and WebKit.',
    );
    test.setTimeout(120_000);
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
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    for (const route of routes) {
      await page.goto('./#' + route);
      await expect(page.locator('#workspace-main')).toHaveAttribute(
        'data-ready',
        'true',
      );
      const { inner, scroll } = await page.evaluate(() => ({
        inner: window.innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(
        scroll,
        'Unexpected horizontal overflow at ' + width + 'px on ' + route,
      ).toBeLessThanOrEqual(inner + 1);
      await page.screenshot({
        path: info.outputPath('rare-room-' + width + '-' + route + '.png'),
        fullPage: true,
      });
    }
    await page.goto('./#home');
    await expect(page.locator('#workspace-main')).toHaveAttribute(
      'data-ready',
      'true',
    );
    const scan = page.locator('#workspace-mobile-add');
    await expect(scan, 'Central mobile Scan must be visible').toBeVisible();
    await scan.click();
    await expect(
      page.getByRole('dialog', {
        name: 'Karte live scannen',
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath('rare-room-' + width + '-scan.png'),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    expect(pageErrors, 'Uncaught browser errors').toEqual([]);
  });
}

test('Rare Room example binder, card details and desktop shell render', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#binder');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page.getByRole('button', { name: 'Beispielbinder ansehen' }).click();
  await expect(page.locator('.w-binder-paper button').first()).toBeVisible();
  await page.screenshot({
    path: info.outputPath('rare-room-390-binder-detail.png'),
    fullPage: true,
  });
  await page.locator('.w-binder-paper button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({
    path: info.outputPath('rare-room-390-card-detail.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./#home');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page.screenshot({
    path: info.outputPath('rare-room-1440-desktop.png'),
    fullPage: true,
  });
});
