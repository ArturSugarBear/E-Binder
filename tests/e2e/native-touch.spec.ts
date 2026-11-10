import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

/** Real mobile touch input, not a synthetic click or a fake PointerEvent. */
async function drag(
  page: Page,
  target: Locator,
  dx: number,
  dy: number,
) {
  const rect = await target.boundingBox();
  if (!rect) throw new Error('Touch target is not visible');
  const x = rect.x + rect.width * 0.48;
  const y = rect.y + Math.min(rect.height / 2, 40);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 8, y: y + (dy * i) / 8 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await cdp.detach();
}

test.beforeEach(({ browserName, isMobile }) => {
  test.skip(
    browserName !== 'chromium' || !isMobile,
    'CDP touch injection runs on mobile Chromium; layout remains covered on WebKit.',
  );
});

test('a card-related bottom sheet closes with a downward drag and still has its X button', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  await expect(page.locator('#workspace-main')).toHaveAttribute('data-ready', 'true');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: 'Karten hinzufügen' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Karten hinzufügen schließen' })).toBeVisible();
  await drag(page, sheet.locator('.w-dialog-head'), 0, 166);
  await expect(sheet).toHaveCount(0);
});

test('real horizontal swipes turn personal binder pages without opening a pocket', async ({
  page,
}) => {
  await page.goto('./#binder');
  await expect(page.locator('#workspace-main')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Ersten Binder anlegen' }).click();
  const setup = page.getByRole('dialog', { name: 'Neuen Binder anlegen' });
  await setup.getByLabel('Name deines Binders').fill('Swipe-Test');
  await setup.getByRole('button', { name: 'Speichern' }).click();
  await page.locator('.w-page-controls').evaluate((node) => {
    (node as HTMLDetailsElement).open = true;
  });
  await page.getByRole('button', { name: 'Leere Seite hinzufügen' }).click();
  const paper = page.locator('.w-binder-paper');
  const pager = page.locator('.w-page-pager .w-mono');
  await expect(pager).toHaveText('2 / 2');
  await drag(page, paper.locator('.w-pocket').nth(4), 120, 4);
  await expect(pager).toHaveText('1 / 2');
  await drag(page, paper.locator('.w-pocket').nth(4), -120, 4);
  await expect(pager).toHaveText('2 / 2');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('archive cards swipe sideways and dismiss down from the artwork', async ({
  page,
}) => {
  await page.goto('./archive.html#greninja');
  await page.locator('.pocket').first().click();
  const sheet = page.locator('dialog.sheet');
  await expect(sheet).toBeVisible();
  await drag(page, sheet.locator('.stage'), -115, 3);
  await expect(sheet.locator('.pos')).toContainText('2 von 9');
  await drag(page, sheet.locator('.stage'), 0, 155);
  await expect(sheet).not.toBeVisible();
});

test('the collection preview browses cards with swipes but protects unsaved edits', async ({
  page,
}) => {
  await page.goto('./#sammlung');
  await expect(page.locator('#workspace-main')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.w-welcome-art .card-art')).toHaveCount(3, {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Mit Demo ausprobieren' }).click();
  await expect(page.locator('.w-owned-grid button').first()).toBeVisible({
    timeout: 15_000,
  });
  await page.locator('.w-owned-grid button').first().click();
  const sheet = page.getByRole('dialog');
  const pager = sheet.locator('.w-card-browse .w-mono');
  await expect(pager).toBeVisible();
  const before = (await pager.textContent())?.trim();
  const nextEnabled = await sheet.getByRole('button', { name: 'Nächste Karte' }).isEnabled();
  await drag(page, sheet.locator('.w-card-swipe-zone'), nextEnabled ? -120 : 120, 3);
  await expect.poll(async () => (await pager.textContent())?.trim()).not.toBe(before);
  await sheet.getByLabel('Deine Notiz').fill('Vorläufige Notiz');
  const current = (await pager.textContent())?.trim();
  const backEnabled = await sheet.getByRole('button', { name: 'Vorherige Karte' }).isEnabled();
  await drag(page, sheet.locator('.w-card-swipe-zone'), backEnabled ? 120 : -120, 3);
  await expect(pager).toHaveText(current!);
});
