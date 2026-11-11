import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

// Run the actual release command against a small offline provider contract.
// No fixture may accidentally fall through to the public catalogue.
async function audit(scenario: 'healthy' | 'metadata-failed' | 'image-failed') {
  const cwd = await mkdtemp(join(tmpdir(), 'e-binder-art-audit-'));
  directories.push(cwd);
  await mkdir(join(cwd, 'public'));
  await writeFile(join(cwd, 'public/collection.json'), '[]');
  const bootstrap = join(cwd, 'providers.mjs');
  await writeFile(
    bootstrap,
    `
    const scenario = ${JSON.stringify(scenario)};
    const primary = 'https://assets.tcgdex.net/en/base/base1';
    const secondary = 'https://images.pokemontcg.io/base1';
    const set = { id: 'base1', name: 'Base Set', cardCount: { official: 102 } };
    globalThis.fetch = async (url) => {
      if (/api.tcgdex.net.*\\/sets$/.test(url)) return Response.json([set]);
      if (/api.tcgdex.net.*\\/sets\\/base1$/.test(url)) {
        if (scenario === 'metadata-failed' && url.includes('/en/')) return new Response('', { status: 404 });
        return Response.json({ ...set, logo: primary + '/logo', symbol: primary + '/symbol' });
      }
      if (url.endsWith('/sets/en.json')) return Response.json([
        { id: 'base1', name: 'Base Set', printedTotal: 102, images: { logo: secondary + '/logo.png', symbol: secondary + '/symbol.png' } }
      ]);
      if (url.endsWith('/cards/en/base1.json')) return Response.json([
        ...['a', 'b', 'c'].map((id) => ({ id, number: '001', images: { large: secondary + '/' + id + '.png' } })),
        { id: 'base1-2', number: '002', images: { large: secondary + '/2.png' } }
      ]);
      if (url.startsWith(primary) || url.startsWith(secondary)) {
        if (scenario === 'image-failed' && url.startsWith(primary)) return new Response('', { status: 404 });
        return new Response(new Uint8Array(200), { headers: { 'content-type': 'image/png' } });
      }
      throw new Error('Unexpected provider request: ' + url);
    };
  `,
  );
  const process = spawnSync(
    'node',
    ['--import', bootstrap, resolve('scripts/audit-catalog-art.mjs')],
    { cwd, encoding: 'utf8', timeout: 10000 },
  );
  const report = JSON.parse(
    await readFile(join(cwd, 'public/catalog-art/audit.json'), 'utf8'),
  );
  const index = JSON.parse(
    await readFile(join(cwd, 'public/catalog-art/index.json'), 'utf8'),
  );
  const cards = JSON.parse(
    await readFile(join(cwd, 'public/catalog-art/base1.json'), 'utf8'),
  );
  return { process, report, index, cards };
}

describe('release artwork gate', () => {
  it('rejects ambiguous collector numbers even when three records share one number', async () => {
    const { process, cards, report } = await audit('healthy');
    expect(process.status, process.stderr).toBe(0);
    expect(cards.cards['001']).toBeNull();
    expect(cards.cards['002'].providerId).toBe('base1-2');
    expect(report.sets[0].indexedCards).toBe(1);
  });

  it('blocks publication when set metadata cannot be checked', async () => {
    const { process, report } = await audit('metadata-failed');
    expect(process.status, process.stderr).toBe(1);
    expect(report.errors).toContainEqual(
      expect.stringContaining('Set metadata unavailable (en:base1)'),
    );
  });

  it('publishes verified secondary graphics after primary images fail', async () => {
    const { process, report, index } = await audit('image-failed');
    expect(process.status, process.stderr).toBe(0);
    expect(report.errors).toEqual([]);
    expect(report.sets[0].primary.logo[0].available).toBe(false);
    expect(index.sets.base1.logo).toEqual([
      'https://images.pokemontcg.io/base1/logo.png',
    ]);
  });
});
