import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import collection from '../../public/collection.json' with { type: 'json' };

for (const [position, chapter] of collection.entries()) {
  test(`chapter ${position + 1} preserves cards, images and exact Cardmarket products`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./archive.html');
    await expect(page.locator('.index .idx')).toHaveCount(22);
    await page.evaluate(
      (hash) => {
        location.hash = hash;
      },
      `#kapitel-${position + 1}`,
    );
    await expect(page.locator('#chapter-title')).toHaveText(chapter.title);
    await expect(page.locator('.pocket')).toHaveCount(9);
    await expect
      .poll(() =>
        page
          .locator('.pocket img')
          .evaluateAll((images) =>
            images.every(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await page.locator('.pocket').first().click();
    for (const [cardPosition, card] of chapter.cards.entries()) {
      await expect(page.locator('dialog')).toBeVisible();
      await expect(page.locator('#card-title')).toHaveText(card.name);
      await expect(page.locator('.market')).toHaveAttribute(
        'href',
        card.cardmarket,
      );
      await expect(page.locator('.nr')).toHaveText(card.number);
      if (cardPosition < 8)
        await page.locator('.sheet-nav button').last().click();
    }
    await expect(page.locator('.sheet-nav button').last()).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).not.toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('deep links, keyboard navigation and browser history work together', async ({
  page,
}) => {
  await page.goto('./archive.html#greninja');
  await expect(page.locator('#chapter-title')).toHaveText('Greninja · Grails');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#kapitel-22$/);
  await expect(page.locator('#chapter-title')).toHaveText('Greninja · Epochen');
  await page.goBack();
  await expect(page.locator('#chapter-title')).toHaveText('Greninja · Grails');
  await page.goForward();
  await expect(page.locator('#chapter-title')).toHaveText('Greninja · Epochen');
  await page.locator('.pocket').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.close')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.pos')).toContainText('2 von 9');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pocket').first()).toBeFocused();
});

test('failed loading is recoverable and repeated clicks do not duplicate the app', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/collection.json', async (route) => {
    requests += 1;
    if (requests === 1)
      await route.fulfill({ status: 503, body: 'Unavailable' });
    else await route.fallback();
  });
  await page.goto('./archive.html#greninja');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.getByRole('alert')).toBeHidden();
  await expect(page.locator('.pocket')).toHaveCount(9);
  await expect(page.locator('.index .idx')).toHaveCount(22);
  expect(requests).toBe(2);
});

test('invalid remote data is not rendered', async ({ page }) => {
  await page.route('**/collection.json', (route) =>
    route.fulfill({ json: [{ title: 'Incomplete' }] }),
  );
  await page.goto('./archive.html');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.pocket')).toHaveCount(0);
});

test('first load fetches only the visible card images', async ({ page }) => {
  const images = new Set<string>();
  page.on('request', (request) => {
    if (request.url().includes('/assets/cards/')) images.add(request.url());
  });
  await page.goto('./archive.html#greninja');
  await expect(page.locator('.pocket')).toHaveCount(9);
  await expect.poll(() => images.size).toBeGreaterThanOrEqual(9);
  expect(images.size).toBeLessThan(40);
});

test('standard and Greninja chapters and dialogs pass automated accessibility rules', async ({
  page,
}) => {
  for (const hash of ['#kapitel-1', '#greninja']) {
    await page.goto(`./archive.html${hash}`);
    await expect(page.locator('.pocket')).toHaveCount(9);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.locator('.pocket').first().click();
    await expect(page.locator('dialog')).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});

test('narrow screens and reduced motion retain the binder layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./archive.html#greninja');
  await expect(page.locator('.pocket')).toHaveCount(9);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator('.grid')
      .evaluate((element) =>
        parseFloat(getComputedStyle(element).animationDuration),
      ),
  ).toBeLessThanOrEqual(0.01);
  await page.locator('.pocket').first().click();
  await expect(page.locator('dialog')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('touch swipes turn chapters without accidentally opening a card', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || !isMobile,
    'Real touch event injection uses Chromium CDP on the mobile project.',
  );
  await page.goto('./archive.html#greninja');
  const pocket = page.locator('.pocket').nth(4);
  await expect(pocket).toBeVisible();
  await pocket.scrollIntoViewIfNeeded();
  const box = await pocket.boundingBox();
  if (!box) throw new Error('Pocket is not visible');
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let distance = 15; distance <= 90; distance += 15) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x - distance, y }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('#chapter-title')).toHaveText('Greninja · Epochen');
  await expect(page.locator('dialog')).not.toBeVisible();
});
