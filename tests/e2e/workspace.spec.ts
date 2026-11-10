import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    console.log(
      'Visible app errors:',
      await page
        .locator('.w-form-notices, .w-dialog-alerts, #workspace-storage-error')
        .allTextContents()
        .catch(() => []),
    );
});

async function ready(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(page.locator('.w-welcome-art img')).toHaveCount(3);
}
async function addFirst(page: Page, quantity = '1'): Promise<void> {
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Karte suchen', { exact: true }).fill('Floink');
  await dialog.locator('.w-search-results button').first().click();
  await dialog
    .getByLabel('Druckvariante', { exact: true })
    .selectOption('holo');
  await dialog.getByLabel('Gesamtmenge dieser Variante').fill(quantity);
  await dialog
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await dialog
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#workspace-save-status')).toHaveText(
    'Auf diesem Gerät gespeichert',
  );
}
async function newBinder(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Meine Binder', exact: true }).click();
  await page.getByRole('button', { name: 'Ersten Binder anlegen' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Name deines Binders')
    .fill('Meine Lieblingsseite');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Speichern', exact: true })
    .click();
  await expect(page.locator('button.w-pocket')).toHaveCount(9);
}
async function downloadBackup(page: Page): Promise<Buffer> {
  await page.getByRole('button', { name: 'Sichern', exact: true }).click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Sicherung herunterladen', exact: true })
    .click();
  const path = await (await download).path();
  if (!path) throw new Error('No downloaded backup');
  const content = await readFile(path);
  await page.keyboard.press('Escape');
  return content;
}

test('confirmed totals, edition corrections, wishes and undo survive reload', async ({
  page,
}) => {
  await ready(page);
  await addFirst(page, '2');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
  await addFirst(page, '2');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
  await expect(page.locator('.w-quantity-badge')).toHaveText('2×');
  await page.locator('.w-owned-grid button').click();
  await page.getByRole('dialog').getByLabel('Bestätigte Gesamtmenge').fill('3');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(page.locator('.w-quantity-badge')).toHaveText('3×');
  await page.locator('#workspace-undo').click();
  await expect(page.locator('.w-quantity-badge')).toHaveText('2×');
  await expect(page.locator('#workspace-save-status')).toHaveText(
    'Auf diesem Gerät gespeichert',
  );
  await page.reload();
  await expect(page.locator('.w-quantity-badge')).toHaveText('2×');
  await page.locator('.w-owned-grid button').click();
  await page.getByRole('button', { name: 'Auch auf die Wunschliste' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Wunschliste', exact: true }).click();
  await expect(page.locator('.w-wish-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Sammlung', exact: true }).click();
  await expect(page.locator('.w-quantity-badge')).toHaveText('2×');
  await page.locator('.w-owned-grid button').click();
  await page
    .getByRole('button', { name: 'Ausgabe korrigieren', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Druckvariante', { exact: true })
    .selectOption('reverse');
  await page
    .getByRole('dialog')
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await page.getByRole('button', { name: 'Korrektur übernehmen' }).click();
  await page.locator('.w-owned-grid button').click();
  await expect(page.getByRole('dialog')).toContainText('Reverse-Holo');
  await page.keyboard.press('Escape');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
});

test('templates create planned slots without possession, owned copies cannot be reused or silently offered for trade', async ({
  page,
}) => {
  await ready(page);
  await addFirst(page);
  await newBinder(page);
  await page
    .getByRole('button', { name: 'Vorlage übernehmen', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Diese Vorlage übernehmen' })
    .first()
    .click();
  await expect(page.locator('.w-pocket-planned')).toHaveCount(8);
  await page.getByRole('button', { name: /^Platz 1:/ }).click();
  await page.getByRole('button', { name: 'Platz festhalten' }).click();
  await page.getByRole('button', { name: /^Platz 1:/ }).click();
  await expect(
    page.getByRole('button', { name: 'Platz leeren' }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  if (!(await page.locator('.w-page-controls').getAttribute('open'))) {
    if (
      !(await page
        .getByRole('button', { name: 'Leere Seite hinzufügen', exact: true })
        .isVisible())
    )
      await page.locator('.w-page-controls summary').click();
  }
  await page
    .getByRole('button', { name: 'Leere Seite hinzufügen', exact: true })
    .click();
  await page.getByRole('button', { name: /^Platz 1:/ }).click();
  await expect(page.locator('.w-unit-choices')).toContainText(
    'Keine freie Karte passt.',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Sammlung', exact: true }).click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
  await page.locator('.w-owned-grid button').click();
  await page
    .getByRole('dialog')
    .getByLabel('Davon ausdrücklich zum Tausch')
    .fill('1');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(page.locator('.w-dialog-alerts')).toContainText(
    'Ein belegtes Exemplar ist nicht verfügbar.',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.w-card-availability')).toHaveText('0 frei');
});

test('artist shortage, fixed anchor and independent demo survive proposal adoption', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Mit Demo ausprobieren' }).click();
  await expect(page.locator('#workspace-demo')).toBeVisible();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(18);
  await page.getByRole('link', { name: 'Meine Binder', exact: true }).click();
  await page
    .getByRole('button', { name: 'Seiten vorschlagen', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByRole('group', { name: '1. Was soll diese Seite verbinden?' })
    .getByRole('radio', { name: 'Ein bestimmter Illustrator' })
    .check();
  await dialog
    .getByLabel('Illustrator aus deinem Bestand')
    .selectOption('Jiro Sasumo');
  await dialog
    .getByLabel('Pflichtkarte', { exact: true })
    .selectOption({ label: 'Trasla · 211/198' });
  await dialog.getByRole('button', { name: 'Vorschläge ansehen' }).click();
  await expect(dialog.locator('.w-proposal').first()).toContainText('3/9');
  await expect(
    dialog.locator('.w-proposal').first().locator('.card-art img'),
  ).toHaveCount(3);
  await dialog
    .getByRole('button', { name: 'Diesen Entwurf übernehmen' })
    .first()
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Platz 5: Trasla, festgehalten',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Seiten vorschlagen', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Vorschläge ansehen' }).click();
  await expect(dialog.locator('.w-proposal').first()).toBeVisible();
  for (const proposal of await dialog.locator('.w-proposal').all()) {
    await expect(proposal.locator('.w-pocket').nth(4)).toContainText('Fest');
    await expect(
      proposal.locator('.w-pocket').nth(4).locator('img'),
    ).toHaveAttribute('alt', /Trasla/);
  }
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Zu meinen Karten', exact: true })
    .click();
  await expect(page.locator('#workspace-demo')).toBeHidden();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'Eine Sammlung, die nach dir aussieht.',
    }),
  ).toBeVisible();
});

test('scan metadata resumes without ownership and exports no image bytes', async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const original = 'public/assets/cards/svi-211.webp';
  await page
    .getByRole('dialog')
    .locator('input[type=file][multiple]')
    .setInputFiles(original);
  await expect(page.locator('.w-capture-queue')).toContainText(
    '1 offen · 0 übernommen',
  );
  await page
    .getByRole('dialog')
    .locator('input[type=file][multiple]')
    .setInputFiles(original);
  await expect(page.locator('.w-form-notices')).toContainText(
    '1 identische Fotos',
  );
  await expect(page.locator('.w-capture-list button')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await expect(page.locator('#workspace-save-status')).toHaveText(
    'Auf diesem Gerät gespeichert',
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Erfassung fortsetzen', exact: true })
    .click();
  await expect(page.locator('.w-photo-review img')).toHaveCount(0);
  await expect(page.locator('.w-photo-review')).toContainText(
    'Kein Foto gespeichert',
  );
  const buffer = await (async () => {
    await page.keyboard.press('Escape');
    return downloadBackup(page);
  })();
  const records = buffer
    .toString('utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { record: string; data?: string });
  expect(records.filter((line) => line.record === 'photo')).toHaveLength(0);
  expect(buffer.toString('utf8')).not.toContain('photoId');
  expect(buffer.toString('utf8')).not.toContain('data:image/');
  expect(
    await page.evaluate(async () => {
      return await new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('e-binder-personal');
        open.onsuccess = () => {
          const db = open.result;
          const names = [...db.objectStoreNames];
          db.close();
          resolve(names);
        };
        open.onerror = () => reject(open.error);
      });
    }),
  ).toEqual(['states']);
  expect(records.filter((line) => line.record === 'capture')).toHaveLength(1);
  expect(records.filter((line) => line.record === 'holding')).toHaveLength(0);
  await addFirst(page);
  await page.getByRole('button', { name: 'Sichern', exact: true }).click();
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({
    name: 'backup.jsonl',
    mimeType: 'application/x-ndjson',
    buffer,
  });
  await expect(page.locator('.w-import-preview')).toContainText(
    '0 Ausgaben · 0 Binder · 0 Wünsche',
  );
  await page
    .getByLabel(
      'Ich möchte den aktuellen Bestand durch diese Sicherung ersetzen.',
    )
    .check();
  await page
    .getByRole('button', { name: 'Geprüfte Sicherung wiederherstellen' })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Erfassung fortsetzen', exact: true })
    .click();
  await expect(page.locator('.w-photo-review img')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('#workspace-undo').click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
});

test('catalog failures and unknown credits remain recoverable without inventing metadata', async ({
  page,
}) => {
  await ready(page);
  await page.route('https://api.tcgdex.net/**', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Karte suchen', { exact: true })
    .fill('Unknown name');
  await expect(page.locator('.w-form-notices')).toContainText(
    'nicht erreichbar',
  );
  await page.getByRole('button', { name: 'Karte manuell eintragen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Kartenname', { exact: true })
    .fill('Meine unbekannte Karte');
  await dialog
    .getByRole('textbox', { name: 'Set', exact: true })
    .fill('Mein Set');
  await dialog.getByLabel('Sammlernummer', { exact: true }).fill('1/10');
  await dialog
    .getByRole('button', { name: 'Angaben und Menge prüfen' })
    .click();
  await expect(dialog).toContainText('Illustrator noch unbekannt');
  await dialog
    .getByLabel('Druckvariante', { exact: true })
    .selectOption('normal');
  await dialog
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await dialog
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
  await expect(page.locator('.w-card-caption')).toContainText(
    'Illustrator unbekannt',
  );
});

test('concurrent tabs preserve the saved collection and expose a conflict instead of overwriting', async ({
  page,
  context,
}) => {
  await ready(page);
  const other = await context.newPage();
  await other.goto('./');
  await expect(other.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await addFirst(page, '2');
  await other
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  await other
    .getByRole('dialog')
    .getByRole('button', { name: 'Karte manuell eintragen' })
    .click();
  await other
    .getByRole('dialog')
    .getByLabel('Kartenname', { exact: true })
    .fill('Tab zwei');
  await other
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Set', exact: true })
    .fill('Unabhängiges Set');
  await other
    .getByRole('dialog')
    .getByLabel('Sammlernummer', { exact: true })
    .fill('2/3');
  await other
    .getByRole('dialog')
    .getByRole('button', { name: 'Angaben und Menge prüfen' })
    .click();
  await other
    .getByRole('dialog')
    .getByLabel('Druckvariante', { exact: true })
    .selectOption('normal');
  await other
    .getByRole('dialog')
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await other
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await expect(other.locator('#workspace-storage-error')).toContainText(
    'anderen Tab',
  );
  await page.reload();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
  await expect(page.locator('.w-quantity-badge')).toHaveText('2×');
  await other.close();
});

test('personal screens, native dialogs and narrow binder pages remain accessible', async ({
  page,
}) => {
  await ready(page);
  const audit = async () =>
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  await audit();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  await audit();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Karten hinzufügen', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Mit Demo ausprobieren' }).click();
  await audit();
  await page.getByRole('link', { name: 'Meine Binder', exact: true }).click();
  await audit();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Seiten vorschlagen', exact: true })
    .click();
  await page.getByRole('button', { name: 'Vorschläge ansehen' }).click();
  await expect(page.locator('.w-proposal').first()).toBeVisible();
  await audit();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true);
});

test('legacy chapter links redirect to the preserved inspiration archive', async ({
  page,
}) => {
  await page.goto('./#greninja');
  await expect(page).toHaveURL(/archive\.html#greninja$/);
  await expect(page.locator('#chapter-title')).toHaveText('Greninja · Grails');
  await page.getByRole('link', { name: '← E-Binder' }).click();
  await expect(
    page.getByRole('heading', { name: 'Deine Sammlung', exact: true }),
  ).toBeVisible();
});

test('OCR cancellation keeps the temporary preview and leaves inventory unchanged', async ({
  page,
}) => {
  await ready(page);
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/ocr/ppocrv4-rec.onnx', async (route) => {
    await held;
    await route.abort().catch(() => undefined);
  });
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .locator('input[type=file][multiple]')
    .setInputFiles('public/assets/cards/svi-211.webp');
  await page
    .getByRole('button', { name: 'Foto ausrichten und erkennen', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Ausschnitt prüfen', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Karte ausrichten', exact: true })
    .getByRole('button', { name: 'Texterkennung starten', exact: true })
    .click();
  await expect(page.locator('.w-form-notices')).toContainText(
    'Erkennungsmodell wird geladen',
  );
  await page
    .getByRole('button', { name: 'Erkennung abbrechen', exact: true })
    .click();
  await expect(page.locator('.w-form-notices')).toContainText(
    'Erkennung abgebrochen.',
  );
  release();
  await expect(page.locator('.w-capture-queue')).toContainText(
    '1 offen · 0 übernommen',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  expect(failures).toEqual([]);
});

test('local vision model reads a printed identifier without saving the photo or confirming ownership', async ({
  page,
}) => {
  await ready(page);
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') writes.push(request.url());
  });
  await page.route('https://api.tcgdex.net/**', (route) =>
    route.fulfill({
      json: {
        id: 'sv01-211',
        localId: '211',
        name: 'Trasla',
        illustrator: 'Jiro Sasumo',
        image: 'https://assets.tcgdex.net/de/sv/sv01/211',
        set: {
          id: 'sv01',
          name: 'Karmesin & Purpur',
          cardCount: { official: 198 },
        },
        variants: { holo: true },
      },
    }),
  );
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .locator('input[type=file][multiple]')
    .setInputFiles('public/assets/cards/svi-211.webp');
  await page
    .getByRole('button', { name: 'Foto ausrichten und erkennen', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Ausschnitt prüfen', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Karte ausrichten', exact: true })
    .getByRole('button', { name: 'Texterkennung starten', exact: true })
    .click();
  await expect(page.locator('.w-form-notices')).toContainText(
    'Mögliche Ausgaben, noch kein bestätigter Bestand.',
    { timeout: 45000 },
  );
  await expect(page.locator('.w-ocr-text')).toContainText('211/198');
  await expect(page.locator('.w-search-results')).toContainText('Trasla');
  await expect(page.locator('.w-capture-queue')).toContainText(
    '1 offen · 0 übernommen',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
  expect(writes).toEqual([]);
});
