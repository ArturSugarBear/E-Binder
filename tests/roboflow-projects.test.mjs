import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverProjects,
  summarizeProjects,
} from '../scripts/roboflow-projects.mjs';

test('project inventory selects workspace-owned slugs and stable image counts', () => {
  assert.deepEqual(
    summarizeProjects(
      {
        workspace: {
          projects: [
            {
              id: 'artur-schuhmacher/smaller',
              images: 142,
              annotation: 'trading-cards',
              type: 'object-detection',
            },
            {
              id: 'artur-schuhmacher/larger',
              images: 430,
              annotation: 'cards',
              type: 'object-detection',
            },
          ],
        },
      },
      'artur-schuhmacher',
    ),
    [
      {
        project: 'larger',
        images: 430,
        annotation: 'cards',
        type: 'object-detection',
      },
      {
        project: 'smaller',
        images: 142,
        annotation: 'trading-cards',
        type: 'object-detection',
      },
    ],
  );
});

test('discovery rejects untrusted workspace and malformed project IDs', () => {
  assert.throws(
    () => summarizeProjects({ workspace: {} }, 'safe'),
    /project list/,
  );
  assert.throws(
    () =>
      summarizeProjects(
        {
          workspace: { projects: [{ id: 'other/private-project', images: 3 }] },
        },
        'safe',
      ),
    /Unexpected/,
  );
});

test('authenticated discovery contacts only Roboflow and never prints private API key', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (address) => {
    const url = new URL(String(address));
    calls.push({
      host: url.host,
      workspace: url.pathname,
      hasKey: url.searchParams.has('api_key'),
    });
    return Response.json({
      workspace: {
        projects: [
          {
            id: 'mock/fork',
            images: 430,
            annotation: 'cards',
            type: 'object-detection',
          },
        ],
      },
    });
  };
  try {
    const projects = await discoverProjects('mock', 'fixture-private-key');
    assert.equal(projects[0].project, 'fork');
    assert.deepEqual(calls, [
      { host: 'api.roboflow.com', workspace: '/mock', hasKey: true },
    ]);
    assert.ok(!JSON.stringify(projects).includes('fixture-private-key'));
  } finally {
    globalThis.fetch = original;
  }
});
