import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/** Optional artifact harness for environments without a local HTTP listener.
 * CI always tests the real Vite preview HTTP server instead.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const artifact = process.env.E2E_STATIC_DIR;
    if (artifact && baseURL) {
      const root = resolve(artifact);
      const base = new URL(baseURL);
      await page.context().route(`${base.origin}/**`, async (route) => {
        const url = new URL(route.request().url());
        const relative =
          decodeURIComponent(url.pathname.slice(base.pathname.length)) ||
          'index.html';
        const file = resolve(root, relative);
        if (
          !url.pathname.startsWith(base.pathname) ||
          !file.startsWith(root + sep)
        ) {
          await route.fulfill({ status: 404, body: 'Not found' });
          return;
        }
        try {
          await readFile(file);
          await route.fulfill({ path: file });
        } catch {
          await route.fulfill({ status: 404, body: 'Not found' });
        }
      });
    }
    await use(page);
  },
});
export { expect };
