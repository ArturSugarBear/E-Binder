import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test.describe('Apple UI review acceptance', () => {
  test('one mobile IA: Binder tab opens Deine Binder and is the only active nav item', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#home');
    const navigation = page.getByRole('navigation', {
      name: 'App-Navigation',
    });
    await expect(navigation).toBeVisible();
    const tabs = navigation.locator(':scope > a, :scope > button');
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(0)).toContainText('Home');
    await expect(tabs.nth(1)).toContainText('Entdecken');
    await expect(tabs.nth(2)).toContainText('Scan');
    await expect(tabs.nth(3)).toContainText('Binder');
    await expect(tabs.nth(4)).toContainText('Profil');
    await expect(tabs.nth(3)).not.toContainText('Sammlung');

    await tabs.nth(3).click();
    await expect(page).toHaveURL(/#binder$/);
    await expect(
      page.getByRole('heading', { name: 'Deine Binder', exact: true }),
    ).toBeVisible();
    // Exactly one active nav item in the dock.
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(navigation.locator('[aria-current="page"]')).toHaveAttribute(
      'data-workspace-route',
      'binder',
    );
    // The desktop header never duplicates the route.
    await expect(
      page.locator('.w-navigation').getByRole('link', { name: 'Sammlung' }),
    ).toHaveCount(0);
    // The vault sub-tabs mark their selection separately.
    await expect(
      page.locator('.w-vault-tabs [aria-current="true"]'),
    ).toHaveCount(1);
  });

  test('mobile vault links visibly highlight the active Binder, Karten or Portfolio view', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#binder');
    for (const [route, caption] of [
      ['binder', 'Binder'],
      ['sammlung', 'Karten'],
      ['portfolio', 'Portfolio'],
    ] as const) {
      const navigation = page.getByRole('navigation', {
        name: 'Sammlungsansichten',
      });
      await expect(navigation).toBeVisible();
      const active = navigation.getByRole('link', {
        name: caption,
        exact: true,
      });
      await expect(active).toHaveAttribute('aria-current', 'true');
      await expect(
        navigation.locator('.w-vault-tab[aria-current="true"]'),
      ).toHaveCount(1);
      const colors = await active.evaluate((node) => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, text: style.color };
      });
      expect(colors.background).toBe('rgb(216, 242, 90)');
      expect(colors.text).toBe('rgb(20, 21, 25)');
      await expect(
        page.locator('.w-mobile-nav [aria-current="page"]'),
      ).toHaveCount(1);
      const inactive = navigation.locator('.w-vault-tab[aria-current="false"]');
      await expect(inactive).toHaveCount(2);
      for (const tab of await inactive.all()) {
        expect(
          await tab.evaluate((node) => getComputedStyle(node).backgroundColor),
        ).not.toBe(colors.background);
      }
      const nextRoute =
        route === 'binder'
          ? 'sammlung'
          : route === 'sammlung'
            ? 'portfolio'
            : null;
      if (nextRoute) {
        const nextName = nextRoute === 'sammlung' ? 'Karten' : 'Portfolio';
        await navigation
          .getByRole('link', { name: nextName, exact: true })
          .click();
        await expect(page).toHaveURL(new RegExp('#' + nextRoute + '$'));
      }
    }
  });

  test('one scanner surface: Home and dock Scan open the viewfinder directly', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#home');
    await page
      .getByRole('button', { name: 'Karte live scannen', exact: true })
      .click();
    const live = page.getByRole('dialog', { name: 'Karte live scannen' });
    await expect(live).toBeVisible();
    // No stacked dialog: the add-card sheet is not opened underneath.
    await expect(page.locator('dialog.w-dialog[open]')).toHaveCount(1);
    await expect(
      page.getByRole('dialog', { name: 'Karten hinzufügen' }),
    ).toHaveCount(0);
    await live
      .getByRole('button', { name: 'Karte live scannen schließen' })
      .click();
    await expect(page.locator('dialog.w-dialog[open]')).toHaveCount(0);
    // Closing returns to the originating screen: Home.
    await expect(
      page.getByRole('heading', { name: 'Dein Fund. Dein Moment.' }),
    ).toBeVisible();
  });

  test('one primary action on the empty collection, stacked cleanly at 320px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('./#sammlung');
    // The hidden desktop "+ Karte" header control does not count; only the
    // visible screen content may carry a primary.
    const primary = page.locator('.w-button-primary:visible');
    await expect(primary).toHaveCount(1);
    await expect(primary).toContainText('Karten hinzufügen');
    await expect(
      page.getByRole('button', { name: 'Erste Karte hinzufügen' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Mit Demo ausprobieren' }),
    ).toBeVisible();
    // No horizontal overflow and no wrapped 3-line CTA at 320px.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const buttons = await page
      .locator('.w-page-heading .w-button')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { x: box.x, width: box.width, height: box.height };
        }),
      );
    for (const button of buttons) {
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeLessThan(60);
    }
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
  });

  test('dirty fields are never silently discarded by Escape or the close control', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#sammlung');
    await page
      .getByRole('button', { name: 'Karten hinzufügen', exact: true })
      .click();
    const add = page.getByRole('dialog', { name: 'Karten hinzufügen' });
    const search = add.getByPlaceholder('Kartenname oder Sammlernummer');
    await search.fill('Pikachu');
    await page.keyboard.press('Escape');
    // The app's own confirmation sheet appears instead of closing.
    const confirm = page.getByRole('dialog', {
      name: 'Ungespeicherte Eingaben verwerfen?',
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(add).toBeVisible();
    await expect(search).toHaveValue('Pikachu');
    // Confirming discards deliberately.
    await page.keyboard.press('Escape');
    await expect(confirm).toBeVisible();
    await confirm
      .getByRole('button', { name: 'Verwerfen', exact: true })
      .click();
    await expect(add).toHaveCount(0);
  });

  test('window.confirm is replaced by the app confirmation sheet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#sammlung');
    await page
      .getByRole('button', { name: 'Karten hinzufügen', exact: true })
      .click();
    const add = page.getByRole('dialog', { name: 'Karten hinzufügen' });
    await add.locator('input[type=file][multiple]').setInputFiles([
      {
        name: 'probe.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x11, 0xff, 0xd9]),
      },
    ]);
    await expect(add.locator('.w-capture-queue')).toContainText('1 offen', {
      timeout: 30_000,
    });
    await add
      .getByRole('button', { name: 'Alle offenen Aufnahmen entfernen (1)' })
      .click();
    const confirm = page.getByRole('dialog', {
      name: 'Offene Aufnahmen entfernen?',
    });
    await expect(confirm).toBeVisible();
    await expect(
      confirm.getByRole('button', { name: 'Entfernen', exact: true }),
    ).toBeVisible();
    await confirm.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(add.locator('.w-capture-queue')).toContainText('1 offen');
    await add
      .getByRole('button', { name: 'Alle offenen Aufnahmen entfernen (1)' })
      .click();
    await confirm
      .getByRole('button', { name: 'Entfernen', exact: true })
      .click();
    // The confirmed removal clears the queue entry entirely.
    await expect(add.locator('.w-capture-queue')).not.toContainText('1 offen');
    await expect(
      add.getByRole('button', {
        name: 'Alle offenen Aufnahmen entfernen (1)',
      }),
    ).toHaveCount(0);
    // Clean up: closing the sheet clears the temporary capture metadata.
    await add
      .getByRole('button', { name: 'Karten hinzufügen schließen' })
      .click();
  });

  test('restored mobile tab bar: lime scanner action is highlighted', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#home');
    const bar = page.locator('.w-mobile-nav');
    const box = await bar.boundingBox();
    expect(box).not.toBeNull();
    // The restored floating glass dock has 11px side gutters and a 10px
    // lower inset; the full-width bar belonged to the rejected redesign.
    expect(Math.round(box!.width)).toBe(368);
    expect(Math.round(box!.x)).toBe(11);
    expect(Math.round(box!.y + box!.height)).toBe(834);
    const symbol = await page
      .locator('.w-mobile-add-symbol')
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          background: style.backgroundColor,
          boxShadow: style.boxShadow,
          borderRadius: style.borderRadius,
        };
      });
    expect(symbol.background).toBe('rgb(216, 242, 90)');
    expect(symbol.boxShadow).not.toBe('none');
    expect(symbol.borderRadius).toBe('50%');
    // Unselected tabs are gray; the active tab uses the single lime tint.
    const color = await page
      .locator('.w-mobile-nav > a')
      .nth(1)
      .evaluate((node) => getComputedStyle(node).color);
    expect(color).not.toBe('rgb(216, 242, 90)');
    const active = await page
      .locator('.w-mobile-nav > a[aria-current="page"]')
      .evaluate((node) => getComputedStyle(node).color);
    expect(active).toBe('rgb(216, 242, 90)');
  });

  test('restored collector typography: compact body, expressive headings and mono eyebrows', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#sammlung');
    const body = await page.evaluate(
      () => getComputedStyle(document.body).fontSize,
    );
    expect(body).toBe('15px');
    const eyebrow = await page
      .locator('.w-eyebrow')
      .first()
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          family: style.fontFamily,
          size: style.fontSize,
          weight: style.fontWeight,
        };
      });
    expect(parseFloat(eyebrow.size)).toBe(9);
    expect(eyebrow.family).toContain('Mono');
    const h1 = await page.locator('.w-page-heading h1').evaluate((node) => {
      const style = getComputedStyle(node);
      return { weight: style.fontWeight, spacing: style.letterSpacing };
    });
    expect(h1.weight).toBe('900');
    await page.goto('./#home');
    const hero = await page.locator('.w-home-hero h1').evaluate((node) => {
      const style = getComputedStyle(node);
      return { weight: style.fontWeight, spacing: style.letterSpacing };
    });
    expect(hero.weight).toBe('900');
    expect(parseFloat(hero.spacing)).toBeLessThanOrEqual(-0.04);
  });
});
