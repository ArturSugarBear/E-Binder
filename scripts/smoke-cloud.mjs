/** Opt-in live audit. Creates ONE synthetic pilot account. No credentials or traces
 * enter the repository. After the run delete only fixture.id with admin tools.
 * Keep CLOUD_TEST_SESSION_FILE outside the repository; reuse it after failures.
 */
import { chromium, expect } from '@playwright/test';
import { writeFile, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173/E-Binder/';
const sessionFile = process.env.CLOUD_TEST_SESSION_FILE;
if (
  !sessionFile ||
  !relative(process.cwd(), resolve(sessionFile)).startsWith('..')
)
  throw new Error(
    'Set CLOUD_TEST_SESSION_FILE to a private path outside the repository.',
  );
const reuse = process.env.CLOUD_TEST_REUSE;
const fixture = reuse
  ? JSON.parse(await readFile(reuse, 'utf8'))
  : {
      username: `test_ui_${Date.now().toString(36)}`,
      password: crypto.randomUUID() + 'Aa1!',
    };
const record = () =>
  writeFile(sessionFile, JSON.stringify(fixture), { mode: 0o600 });
await record();
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
        args: ['--no-sandbox'],
      }
    : {},
);
const passed = [];
const done = (step) => {
  passed.push(step);
  console.log(JSON.stringify({ passed: step }));
};
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function account(page) {
  await page.locator('#workspace-account').click();
  return page.getByRole('dialog').last();
}
async function saved(page) {
  await expect(page.locator('#workspace-save-status')).toHaveText(
    'Im Konto gespeichert',
    { timeout: 40000 },
  );
}
async function auth(page, register) {
  const dialog = await account(page);
  await dialog
    .getByRole('radio', {
      name: register ? 'Konto anlegen' : 'Anmelden',
      exact: true,
    })
    .check();
  await dialog.getByLabel('Nutzername', { exact: true }).fill(fixture.username);
  await dialog.getByLabel('Passwort', { exact: true }).fill(fixture.password);
  await button(dialog, register ? 'Konto anlegen' : 'Anmelden').click();
  await expect(page.locator('.w-local-label')).toContainText(fixture.username, {
    timeout: 40000,
  });
  fixture.id = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.endsWith('-auth-token'),
    );
    return key ? JSON.parse(localStorage.getItem(key)).user.id : null;
  });
  await record();
  await saved(page);
}
try {
  const context = await browser.newContext();
  context.setDefaultTimeout(20000);
  const page = await context.newPage();
  await page.goto(new URL('#sammlung', base).href);
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  {
    await button(page, 'Erste Karte hinzufügen').click();
    const add = page.getByRole('dialog');
    await button(add, 'Karte manuell eintragen').click();
    await add.getByLabel('Kartenname', { exact: true }).fill('QA Cloudkarte');
    await add
      .getByRole('textbox', { name: 'Set', exact: true })
      .fill('Synthetisches Prüfset');
    await add.getByLabel('Sammlernummer', { exact: true }).fill('1/9');
    await button(add, 'Angaben und Menge prüfen').click();
    await add
      .getByLabel('Druckvariante', { exact: true })
      .selectOption('normal');
    await add.getByLabel('Gesamtmenge dieser Variante').fill('2');
    await add
      .getByLabel(
        'Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.',
      )
      .check();
    await button(add, 'Bestand bestätigen').click();
    await expect(page.locator('.w-quantity-badge')).toHaveText('2×');
    await expect(page.locator('#workspace-save-status')).toHaveText(
      'Auf diesem Gerät gespeichert',
    );
  }
  await auth(page, !reuse);
  done(reuse ? 'login' : 'registration');
  // Reusing an interrupted audit requires manual inspection, not a destructive reset.
  {
    let dialog;
    if (!reuse) {
      await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
      dialog = await account(page);
      await button(dialog, 'Lokalen Bestand übernehmen').click();
      await saved(page);
      await expect(page.locator('.w-quantity-badge')).toHaveText('2×');
      await button(dialog, 'Lokalen Bestand übernehmen').click();
      await expect(dialog).toContainText('Dein Konto enthält bereits Daten.');
      await button(dialog, 'Jetzt synchronisieren').click();
      await expect(dialog).toContainText('Dein Konto ist synchronisiert.');
      await page.keyboard.press('Escape');
      done('local-import-and-repeated-import-guard');
    }
    await page.getByRole('link', { name: 'Meine Binder', exact: true }).click();
    if (await button(page, 'Ersten Binder anlegen').isVisible()) {
      await button(page, 'Ersten Binder anlegen').click();
      await page
        .getByLabel('Name deines Binders', { exact: true })
        .fill('QA Cloudbinder');
      await button(page.getByRole('dialog'), 'Speichern').click();
      await page.getByRole('button', { name: /^Platz 1:/ }).click();
      await page.locator('.w-unit-choices button').first().click();
    }
    let controls = page.locator('.w-page-controls');
    if (!(await controls.evaluate((node) => node.open)))
      await controls.locator('summary').click();
    if ((await page.locator('.w-page-list button').count()) < 2)
      await button(page, 'Leere Seite hinzufügen').click();
    await saved(page);
    if (await button(page, 'Vorherige Seite').isEnabled())
      await button(page, 'Vorherige Seite').click();
    await saved(page);
    if (!(await controls.evaluate((node) => node.open)))
      await controls.locator('summary').click();
    await button(page, 'Binder teilen').click();
    dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Diesen Binder über einen Link öffentlich ansehen lassen.')
      .check();
    await button(dialog, 'Freigabe speichern').click();
    await expect(dialog.getByLabel('Link zum Weitergeben')).toBeVisible({
      timeout: 40000,
    });
    fixture.share = await dialog
      .getByLabel('Link zum Weitergeben')
      .inputValue();
    await record();
    const visitor = await browser.newContext();
    const publicPage = await visitor.newPage();
    await publicPage.goto(fixture.share);
    await expect(
      publicPage.getByRole('heading', { name: 'QA Cloudbinder', exact: true }),
    ).toBeVisible({ timeout: 40000 });
    await expect(publicPage.locator('.w-shared-page .w-pocket')).toHaveCount(9);
    await expect(
      publicPage.locator('.w-shared-page button.w-pocket'),
    ).toHaveCount(0);
    await expect(publicPage.locator('.w-shared-page')).not.toContainText('2×');
    await expect(publicPage.locator('.w-shared-page img')).toHaveCount(1);
    await button(publicPage, 'Nächste Seite').click();
    await expect(publicPage.locator('.w-shared-page img')).toHaveCount(0);
    await expect(button(publicPage, 'Nächste Seite')).toBeDisabled();
    await button(publicPage, 'Vorherige Seite').click();
    await expect(publicPage.locator('.w-shared-page img')).toHaveCount(1);
    done('public-read-only-and-page-navigation');
    await page.keyboard.press('Escape');
    if (!(await controls.evaluate((node) => node.open)))
      await controls.locator('summary').click();
    await button(page, 'Binder teilen').click();
    dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Diesen Binder über einen Link öffentlich ansehen lassen.')
      .uncheck();
    await button(dialog, 'Freigabe speichern').click();
    await expect(dialog).toContainText(
      'Bisherige Links geben keinen Zugriff mehr.',
      { timeout: 40000 },
    );
    await publicPage.reload();
    await expect(
      publicPage.getByRole('heading', {
        name: 'Binder nicht verfügbar',
        exact: true,
      }),
    ).toBeVisible({ timeout: 40000 });
    await visitor.close();
    await page.keyboard.press('Escape');
    done('share-revocation');
    const second = await browser.newContext();
    second.setDefaultTimeout(20000);
    const secondPage = await second.newPage();
    await secondPage.goto(new URL('#sammlung', base).href);
    await auth(secondPage, false);
    const baselineQuantity = Number(
      (await secondPage.locator('.w-quantity-badge').innerText()).replace(
        '×',
        '',
      ),
    );
    expect(baselineQuantity).toBeGreaterThan(0);
    await secondPage.locator('.w-owned-grid button').click();
    await secondPage
      .getByLabel('Bestätigte Gesamtmenge')
      .fill(String(baselineQuantity + 1));
    await secondPage.getByLabel('Deine Notiz').fill('QA private note');
    await button(secondPage, 'Änderungen speichern').click();
    await saved(secondPage);
    done('second-browser-restore-and-save');
    await page.getByRole('link', { name: 'Sammlung', exact: true }).click();
    await page.locator('.w-owned-grid button').click();
    await page
      .getByLabel('Bestätigte Gesamtmenge')
      .fill(String(baselineQuantity + 2));
    await button(page, 'Änderungen speichern').click();
    await expect(page.locator('#workspace-storage-error')).toContainText(
      'Cloudkonflikt',
      { timeout: 40000 },
    );
    await button(page, 'Sichern').click();
    const download = page.waitForEvent('download');
    await button(page.getByRole('dialog'), 'Sicherung herunterladen').click();
    const raw = await readFile(await (await download).path(), 'utf8');
    const holding = raw
      .trim()
      .split('\n')
      .map(JSON.parse)
      .find((row) => row.record === 'holding');
    expect(holding.data.quantity).toBe(baselineQuantity + 2);
    await page.keyboard.press('Escape');
    dialog = await account(page);
    await button(dialog, 'Cloudstand laden').click();
    await expect(dialog).toContainText('Bestätige zuerst das Ersetzen');
    await dialog
      .getByLabel(
        'Lokale, noch nicht synchronisierte Kontoänderungen durch den Cloudstand ersetzen.',
      )
      .check();
    await button(dialog, 'Cloudstand laden').click();
    await saved(page);
    await expect(page.locator('.w-quantity-badge')).toHaveText(
      `${baselineQuantity + 1}×`,
    );
    done('conflict-backup-and-explicit-remote-recovery');
    dialog = await account(page);
    await button(dialog, 'Abmelden').click();
    await expect(page.locator('.w-local-label')).not.toContainText(
      fixture.username,
    );
    await expect(page.locator('.w-quantity-badge')).toHaveText('2×');
    await secondPage.reload();
    await expect(secondPage.locator('.w-local-label')).toContainText(
      fixture.username,
      { timeout: 40000 },
    );
    await saved(secondPage);
    dialog = await account(secondPage);
    await button(dialog, 'Abmelden').click();
    await expect(secondPage.locator('.w-owned-grid button')).toHaveCount(0);
    await second.close();
    done('device-local-logout-and-original-local-data');
    console.log(JSON.stringify({ fixtureRecorded: true, passed }));
  }
} catch (error) {
  // Do not emit Playwright call logs containing filled credentials.
  console.error(
    JSON.stringify({
      failedAfter: passed.at(-1) ?? 'startup',
      error: String(error.message)
        .split('Call log:')[0]
        .replaceAll(fixture.password, '[redacted]')
        .replaceAll(fixture.username, '[fixture]'),
    }),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
