import { openVault } from './navigation';
import { test, expect } from './fixtures';
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

const chapters = JSON.parse(readFileSync('public/collection.json', 'utf8')) as {
  title: string;
  cards: { id: string; name: string; set: string; number: string }[];
}[];

async function ready(page: Page, route = 'sammlung') {
  await page.goto(`./#${route}`);
  await expect(page.locator('#workspace-main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(page.locator('#workspace-catalog-error')).toBeHidden();
}

async function manual(page: Page, name = 'Meine Testkarte') {
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    exact: true,
  });
  await add
    .getByRole('button', { name: 'Karte manuell eintragen', exact: true })
    .click();
  await add.getByLabel('Kartenname', { exact: true }).fill(name);
  await add
    .getByRole('textbox', { name: 'Set', exact: true })
    .fill('Eigenes Testset');
  await add.getByLabel('Sammlernummer', { exact: true }).fill('1/9');
  await add
    .getByRole('button', { name: 'Angaben und Menge prüfen', exact: true })
    .click();
  return add;
}

test('the demo shows the original physical page and can restart without replacing personal possessions', async ({
  page,
}) => {
  await ready(page);
  const add = await manual(page);
  await add.getByLabel('Druckvariante', { exact: true }).selectOption('normal');
  await add.getByLabel('Gesamtmenge dieser Variante').fill('2');
  await add
    .getByLabel('Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.')
    .check();
  await add
    .getByRole('button', { name: 'Bestand bestätigen', exact: true })
    .click();
  await openVault(page, 'binder');
  await page
    .getByRole('button', { name: 'Beispielbinder ansehen', exact: true })
    .click();
  await expect(page.locator('#workspace-demo')).toBeVisible();
  await expect(page.locator('.w-binder-title h2')).toHaveText(
    chapters[0]!.title,
  );
  await expect(page.locator('.w-binder-paper img')).toHaveCount(9);
  for (const [index, card] of chapters[0]!.cards.entries())
    await expect(
      page.locator('.w-binder-paper img').nth(index),
    ).toHaveAttribute('alt', `${card.name}, ${card.set} ${card.number}`);
  await page.locator('button.w-pocket').first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Platz leeren', exact: true })
    .click();
  await expect(page.locator('.w-binder-paper img')).toHaveCount(8);
  await page
    .getByRole('button', { name: 'Demo neu starten', exact: true })
    .click();
  const reset = page.getByRole('dialog', {
    name: 'Demo zurücksetzen?',
    exact: true,
  });
  await expect(reset).toBeVisible();
  await reset.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(reset).toHaveCount(0);
  await expect(page.locator('.w-binder-paper img')).toHaveCount(8);
  await page
    .getByRole('button', { name: 'Demo neu starten', exact: true })
    .click();
  await reset
    .getByRole('button', { name: 'Zurücksetzen', exact: true })
    .click();
  await expect(reset).toHaveCount(0);
  await expect(page.locator('.w-binder-paper img')).toHaveCount(9);
  await page.reload();
  await expect(page.locator('.w-binder-paper img')).toHaveCount(9);
  await page
    .getByRole('button', { name: 'Zu meinen Karten', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
  await expect(page.locator('.w-quantity-badge')).toHaveText('2×');
  await expect(page.locator('.w-owned-grid')).toContainText('Meine Testkarte');
  await page.reload();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(1);
  await expect(page.locator('#workspace-demo')).toBeHidden();
});

test('all 22 original pages can be previewed inside the binder without creating possessions or layouts', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await ready(page, 'binder');
  await page
    .getByRole('button', { name: 'Vorlagen entdecken', exact: true })
    .click();
  const gallery = page.getByRole('dialog', {
    name: 'Eine Seite aus deinen Inspirationen',
    exact: true,
  });
  await expect(gallery.locator('.w-template')).toHaveCount(22);
  for (const [index, chapter] of chapters.entries()) {
    const entry = gallery.locator('.w-template').nth(index);
    await expect(
      entry.getByRole('heading', { name: chapter.title, exact: true }),
    ).toBeVisible();
    await entry
      .getByRole('button', { name: 'Vorschau ansehen', exact: true })
      .click();
    const preview = page.getByRole('dialog', {
      name: chapter.title,
      exact: true,
    });
    await expect(preview.locator('.w-pocket img')).toHaveCount(9);
    for (const [position, card] of chapter.cards.entries())
      await expect(
        preview.locator('.w-pocket img').nth(position),
      ).toHaveAttribute('alt', `${card.name}, ${card.set} ${card.number}`);
    await preview
      .getByRole('button', { name: 'Zurück zu den Vorlagen', exact: true })
      .click();
    await expect(gallery).toBeVisible();
    await expect(
      entry.getByRole('button', { name: 'Vorschau ansehen', exact: true }),
    ).toBeFocused();
  }
  await gallery
    .getByRole('button', {
      name: 'Eine Seite aus deinen Inspirationen schließen',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Deine erste Seite wartet.',
      exact: true,
    }),
  ).toBeVisible();
  await openVault(page, 'sammlung');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('template search recovers from no results and explicitly creates a planned binder that survives reload', async ({
  page,
}) => {
  await ready(page, 'binder');
  await page
    .getByRole('button', { name: 'Vorlagen entdecken', exact: true })
    .click();
  const gallery = page.getByRole('dialog', {
    name: 'Eine Seite aus deinen Inspirationen',
    exact: true,
  });
  const search = gallery.getByLabel('Vorlagen durchsuchen', { exact: true });
  await search.fill('  ');
  await expect(gallery.locator('.w-template')).toHaveCount(22);
  await search.fill('existiert-nicht-qa');
  await expect(gallery.locator('.w-template')).toHaveCount(0);
  await gallery
    .getByRole('button', { name: 'Suche zurücksetzen', exact: true })
    .click();
  await expect(search).toBeFocused();
  await expect(gallery.locator('.w-template')).toHaveCount(22);
  await search.fill(chapters[21]!.title.toUpperCase());
  await expect(gallery.locator('.w-template')).toHaveCount(1);
  await gallery
    .getByRole('button', { name: 'Vorschau ansehen', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: chapters[21]!.title, exact: true })
    .getByRole('button', { name: 'Diese Seite planen', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.w-binder-title h2')).toHaveText(
    chapters[21]!.title,
  );
  await expect(page.locator('.w-binder-paper .w-pocket-planned')).toHaveCount(
    9,
  );
  await page.reload();
  await expect(page.locator('.w-binder-title h2')).toHaveText(
    chapters[21]!.title,
  );
  await openVault(page, 'sammlung');
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});

test('planning another template preserves an occupied and locked page', async ({
  page,
}) => {
  await ready(page, 'binder');
  await page
    .getByRole('button', { name: 'Beispielbinder ansehen', exact: true })
    .click();
  await page.locator('button.w-pocket').first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Platz festhalten', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Vorlage übernehmen', exact: true })
    .click();
  const gallery = page.getByRole('dialog', {
    name: 'Eine Seite aus deinen Inspirationen',
    exact: true,
  });
  await gallery.getByLabel('Vorlagen durchsuchen').fill(chapters[21]!.title);
  await gallery
    .getByRole('button', { name: 'Diese Vorlage übernehmen', exact: true })
    .click();
  await expect(page.locator('.w-page-pager .w-mono')).toHaveText('2 / 2');
  await page
    .getByRole('button', { name: 'Vorherige Seite', exact: true })
    .click();
  await expect(page.locator('.w-binder-title h2')).toHaveText(
    chapters[0]!.title,
  );
  await expect(page.locator('.w-binder-paper img')).toHaveCount(9);
  await expect(page.locator('button.w-pocket').first()).toHaveAttribute(
    'aria-label',
    /festgehalten/,
  );
});

test('required names reject whitespace at the field before any confirmation or saved change', async ({
  page,
}) => {
  await ready(page, 'binder');
  await page
    .getByRole('button', { name: 'Ersten Binder anlegen', exact: true })
    .click();
  const naming = page.getByRole('dialog', {
    name: 'Neuen Binder anlegen',
    exact: true,
  });
  const name = naming.getByLabel('Name deines Binders', { exact: true });
  await name.fill('   ');
  await naming.getByRole('button', { name: 'Speichern', exact: true }).click();
  expect(
    await name.evaluate((node: HTMLInputElement) => node.checkValidity()),
  ).toBe(false);
  await expect(naming).toBeVisible();
  await name.fill('  Mein gültiger Binder  ');
  await naming.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mein gültiger Binder', exact: true }),
  ).toBeVisible();
  await openVault(page, 'sammlung');
  await page
    .getByRole('button', { name: 'Karten hinzufügen', exact: true })
    .click();
  const add = page.getByRole('dialog', {
    name: 'Karten hinzufügen',
    exact: true,
  });
  await add
    .getByRole('button', { name: 'Karte manuell eintragen', exact: true })
    .click();
  for (const label of ['Kartenname', 'Set', 'Sammlernummer']) {
    const field = add.getByRole('textbox', { name: label, exact: true });
    await field.fill('   ');
    expect(
      await field.evaluate((node: HTMLInputElement) => node.checkValidity()),
    ).toBe(false);
    await field.fill('Gültig');
  }
  await add
    .getByRole('button', { name: 'Angaben und Menge prüfen', exact: true })
    .click();
  await expect(
    add.getByRole('button', { name: 'Bestand bestätigen', exact: true }),
  ).toBeVisible();
  await add
    .getByRole('button', { name: 'Karten hinzufügen schließen', exact: true })
    .click();
  await expect(page.locator('.w-owned-grid button')).toHaveCount(0);
});
