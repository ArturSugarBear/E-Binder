/** WIP audit evidence, not a completed usability acceptance test.
 * Uses an isolated synthetic demo; never opens an existing user's session.
 */
import { chromium, webkit, expect } from '@playwright/test';
const engine = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173/E-Binder/';
const browser = await { chromium, webkit }[engine].launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  context.setDefaultTimeout(20000);
  const page = await context.newPage();
  await page.goto(new URL('#sammlung', base).href);
  await page
    .getByRole('button', { name: 'Mit Demo ausprobieren', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(18);
  await page
    .locator('.w-vault-tabs')
    .getByRole('link', { name: 'Binder', exact: true })
    .click();
  await expect(page.locator('.w-binder-paper img')).toHaveCount(9);
  const pocket = await page
    .locator('.w-binder-paper .w-pocket')
    .first()
    .boundingBox();
  const dock = await page.locator('.w-mobile-nav').boundingBox();
  const result = {
    engine,
    viewport: page.viewportSize(),
    firstPocket: pocket,
    dock,
    firstPocketStartsBelowDock: pocket.y >= dock.y,
    note: 'Measured initial viewport. Scroll and interaction coverage remain separate audit tasks.',
  };
  if (process.env.WIP_SCREENSHOT_PATH)
    await page.screenshot({ path: process.env.WIP_SCREENSHOT_PATH });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
