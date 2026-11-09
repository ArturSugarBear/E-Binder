/** Explicit integration check: creates a disposable pilot account. Credentials stay in memory.
 * Optional CLOUD_TEST_SESSION_FILE writes a private session outside the repository for a later live check.
 * Delete only the reported fixture account after the check using the administrator tools.
 */
import { chromium, expect } from '@playwright/test';
import { writeFile, readFile } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173/E-Binder/';
const reuse = process.env.CLOUD_TEST_REUSE;
const fixture = reuse
  ? JSON.parse(await readFile(reuse, 'utf8'))
  : {
      username: `test_ui_${Date.now().toString(36)}`,
      password: crypto.randomUUID() + 'Aa1!',
    };
if (process.env.CLOUD_TEST_SESSION_FILE)
  await writeFile(
    process.env.CLOUD_TEST_SESSION_FILE,
    JSON.stringify(fixture),
    { mode: 0o600 },
  );
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base);
  await page.locator('#workspace-account').click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Zugang', { exact: true })
    .selectOption(reuse ? 'login' : 'register');
  await dialog.getByLabel('Nutzername', { exact: true }).fill(fixture.username);
  await dialog.getByLabel('Passwort', { exact: true }).fill(fixture.password);
  await dialog
    .getByRole('button', {
      name: reuse ? 'Anmelden' : 'Konto anlegen',
      exact: true,
    })
    .click();
  await expect(page.locator('.w-local-label')).toContainText(fixture.username, {
    timeout: 40000,
  });
  await expect(page.locator('#workspace-save-status')).toHaveText(
    'Im Konto gespeichert',
    { timeout: 40000 },
  );
  const user = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.endsWith('-auth-token'),
    );
    return key ? JSON.parse(localStorage.getItem(key)).user.id : null;
  });
  fixture.id = user;
  if (process.env.CLOUD_TEST_SESSION_FILE)
    await writeFile(
      process.env.CLOUD_TEST_SESSION_FILE,
      JSON.stringify(fixture),
      { mode: 0o600 },
    );
  if (!reuse) {
    await page
      .getByRole('button', { name: 'Karten hinzufügen', exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog.locator('.w-search-results button').first().click();
    await dialog
      .getByLabel('Druckvariante', { exact: true })
      .selectOption('holo');
    await dialog
      .getByLabel(
        'Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.',
      )
      .check();
    await dialog
      .getByRole('button', { name: 'Bestand bestätigen', exact: true })
      .click();
    await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
    await expect(page.locator('#workspace-save-status')).toHaveText(
      'Im Konto gespeichert',
      { timeout: 40000 },
    );
    await page.getByRole('link', { name: 'Meine Binder', exact: true }).click();
    await page
      .getByRole('button', { name: 'Ersten Binder anlegen', exact: true })
      .click();
    await page
      .getByLabel('Name deines Binders', { exact: true })
      .fill('Cloud-Testbinder');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.getByRole('button', { name: /^Platz 1:/ }).click();
    await page.locator('.w-unit-choices button').first().click();
    await expect(page.locator('#workspace-save-status')).toHaveText(
      'Im Konto gespeichert',
      { timeout: 40000 },
    );
    await page
      .getByRole('button', { name: 'Binder teilen', exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Diesen Binder über einen Link öffentlich ansehen lassen.')
      .check();
    await dialog
      .getByRole('button', { name: 'Freigabe speichern', exact: true })
      .click();
    await expect(dialog.getByLabel('Link zum Weitergeben')).toBeVisible({
      timeout: 40000,
    });
    fixture.share = await dialog
      .getByLabel('Link zum Weitergeben')
      .inputValue();
    if (process.env.CLOUD_TEST_SESSION_FILE)
      await writeFile(
        process.env.CLOUD_TEST_SESSION_FILE,
        JSON.stringify(fixture),
        { mode: 0o600 },
      );
    const visitor = await browser.newContext();
    const publicPage = await visitor.newPage();
    await publicPage.goto(fixture.share);
    await expect(
      publicPage.getByRole('heading', {
        name: 'Cloud-Testbinder',
        exact: true,
      }),
    ).toBeVisible({ timeout: 40000 });
    await expect(publicPage.locator('.w-shared-page .w-pocket')).toHaveCount(9);
    await expect(publicPage.locator('.w-shared-page img')).toHaveCount(1);
    await visitor.close();
    await page.keyboard.press('Escape');
  }
  const second = await browser.newContext();
  const secondPage = await second.newPage();
  await secondPage.goto(base);
  await secondPage.locator('#workspace-account').click();
  dialog = secondPage.getByRole('dialog');
  await dialog.getByLabel('Nutzername', { exact: true }).fill(fixture.username);
  await dialog.getByLabel('Passwort', { exact: true }).fill(fixture.password);
  await dialog.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(secondPage.locator('.w-owned-grid button')).toHaveCount(1, {
    timeout: 40000,
  });
  await expect(secondPage.locator('#workspace-save-status')).toHaveText(
    'Im Konto gespeichert',
    { timeout: 40000 },
  );
  await second.close();
  console.log(
    JSON.stringify({
      registration: reuse ? 'reused' : 'pass',
      login: 'pass',
      save: 'pass',
      newBrowserRestore: 'pass',
      publicReadOnly: fixture.share ? 'pass' : 'not checked',
      fixtureRecorded: !!process.env.CLOUD_TEST_SESSION_FILE,
    }),
  );
} finally {
  await browser.close();
}
