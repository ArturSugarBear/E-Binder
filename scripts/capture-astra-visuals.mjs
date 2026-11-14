#!/usr/bin/env node
/**
 * Capture the Astra review surfaces from a running dev/preview server.
 * Demo data only; never owner photos.
 *
 * Usage:
 *   VITE_BASE_PATH=/ npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
 *   node scripts/capture-astra-visuals.mjs
 *
 * Output: docs/reviews/astra-2026-11-14/visuals/<label>/
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.env.ASTRA_BASE_URL ?? 'http://127.0.0.1:5173/';
const label = process.env.ASTRA_LABEL ?? 'after';
const output = `docs/reviews/astra-2026-11-14/visuals/${label}`;
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  args: ['--disable-dev-shm-usage'],
});

/**
 * A deterministic canvas camera so the scanner surface can be photographed
 * without a physical device or a private photo.
 */
const fakeCamera = () => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 720;
        canvas.height = 960;
        const context = canvas.getContext('2d');
        const draw = () => {
          if (!context) return;
          context.fillStyle = '#1c1e24';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.save();
          context.translate(70, 80);
          context.rotate(-0.04);
          context.fillStyle = '#f4f1ea';
          context.fillRect(0, 0, 580, 800);
          context.fillStyle = '#d8f25a';
          context.fillRect(0, 0, 580, 54);
          context.fillStyle = '#22242b';
          context.fillRect(28, 90, 524, 470);
          context.fillStyle = '#a9a8b4';
          context.fillRect(28, 590, 380, 18);
          context.fillRect(28, 620, 300, 14);
          context.fillRect(28, 650, 250, 14);
          context.restore();
          requestAnimationFrame(draw);
        };
        draw();
        return canvas.captureStream(20);
      },
    },
  });
};

async function surface(name, viewport, path, action) {
  let context;
  try {
    context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
    });
    await context.addInitScript(fakeCamera);
    const page = await context.newPage();
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    await page
      .locator('#workspace-main[data-ready="true"]')
      .waitFor({ timeout: 30000 });
    await action(page);
    await page.screenshot({
      path: `${output}/${name}-${viewport.width}.png`,
      fullPage: false,
    });
    console.log(`captured ${name}-${viewport.width}`);
  } catch (error) {
    console.error(`failed ${name}-${viewport.width}: ${String(error)}`);
  } finally {
    await context?.close().catch(() => undefined);
  }
}

const wait = (page, selector) =>
  page.locator(selector).first().waitFor({ timeout: 30000 });

const mobile = { width: 390, height: 844 };
const narrow = { width: 320, height: 800 };
const desktop = { width: 1440, height: 900 };

await surface('home-first', mobile, '#home', async () => {});
await surface('discover-sets', mobile, '#entdecken', async (page) => {
  await wait(page, '.w-set-grid .w-set-choice');
});
await surface('discover-set', mobile, '#entdecken', async (page) => {
  await wait(page, '.w-set-grid .w-set-choice');
  await page.locator('.w-set-grid .w-set-choice').first().click();
  await wait(page, '.w-search-results button');
});
await surface('portfolio', mobile, '#portfolio', async () => {});
await surface('profile', mobile, '#profil', async () => {});

await surface('binder', mobile, '#binder', async (page) => {
  const demo = page.getByRole('button', {
    name: 'Mit Demo ausprobieren',
    exact: true,
  });
  if (await demo.count()) await demo.click();
  await wait(page, '.w-binder-paper');
});
await surface('collection-cards', mobile, '#sammlung', async (page) => {
  const demo = page.getByRole('button', {
    name: 'Mit Demo ausprobieren',
    exact: true,
  });
  if (await demo.count()) await demo.click();
  await wait(page, '.w-owned-grid button');
});
await surface('card-detail', mobile, '#sammlung', async (page) => {
  const demo = page.getByRole('button', {
    name: 'Mit Demo ausprobieren',
    exact: true,
  });
  if (await demo.count()) await demo.click();
  await wait(page, '.w-owned-grid button');
  await page.locator('.w-owned-grid button').first().click();
  await wait(page, 'dialog.w-dialog[open]');
});
await surface('home-returning', mobile, '#home', async (page) => {
  const demo = page.getByRole('button', {
    name: 'Mit Demo ausprobieren',
    exact: true,
  });
  await page.goto(`${base}#sammlung`);
  await wait(page, '#workspace-main[data-ready="true"]');
  if (await demo.count()) await demo.click();
  await wait(page, '.w-owned-grid button');
  await page.goto(`${base}#home`);
  await wait(page, '#workspace-main[data-ready="true"]');
});
await surface('scanner', mobile, '#home', async (page) => {
  const scan = page.getByRole('button', {
    name: /Karte (live )?scannen/,
  });
  await scan.first().click();
  await wait(page, 'dialog.w-dialog[open] .w-live-stage');
  await page.waitForTimeout(1200);
});

await surface('home-returning', narrow, '#home', async (page) => {
  await page.goto(`${base}#sammlung`);
  await wait(page, '#workspace-main[data-ready="true"]');
  const demo = page.getByRole('button', {
    name: 'Mit Demo ausprobieren',
    exact: true,
  });
  if (await demo.count()) await demo.click();
  await wait(page, '.w-owned-grid button');
  await page.goto(`${base}#home`);
  await wait(page, '#workspace-main[data-ready="true"]');
});
await surface('binder', narrow, '#binder', async (page) => {
  const demo = page.getByRole('button', {
    name: 'Mit Demo ausprobieren',
    exact: true,
  });
  if (await demo.count()) await demo.click();
  await wait(page, '.w-binder-paper');
});
await surface('discover-sets', narrow, '#entdecken', async (page) => {
  await wait(page, '.w-set-grid .w-set-choice');
});
await surface('portfolio', narrow, '#portfolio', async () => {});

await surface('home-returning', desktop, '#home', async (page) => {
  await page.goto(`${base}#sammlung`);
  await wait(page, '#workspace-main[data-ready="true"]');
  const demo = page.getByRole('button', {
    name: 'Mit Demo ausprobieren',
    exact: true,
  });
  if (await demo.count()) await demo.click();
  await wait(page, '.w-owned-grid button');
  await page.goto(`${base}#home`);
  await wait(page, '#workspace-main[data-ready="true"]');
});
await surface('discover-sets', desktop, '#entdecken', async (page) => {
  await wait(page, '.w-set-grid .w-set-choice');
});
await surface('portfolio', desktop, '#portfolio', async () => {});
await surface('binder', desktop, '#binder', async (page) => {
  const demo = page.getByRole('button', {
    name: 'Mit Demo ausprobieren',
    exact: true,
  });
  if (await demo.count()) await demo.click();
  await wait(page, '.w-binder-paper');
});

await browser.close();
console.log(`done: ${output}`);
