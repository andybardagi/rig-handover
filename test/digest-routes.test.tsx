import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const baseConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'unused',
};

const sortedJobs20261028 = [
  'digest/render',
  'fixtures/refresh',
  'lane/sync',
  'notes/backup',
  'rig/rotate-logs',
];

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

function jobsFromDigestHtml(html: string): string[] {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  if (!tbody) return [];
  const jobs: string[] = [];
  for (const row of tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const firstTd = row[1].match(/<td[^>]*>([^<]+)</);
    if (firstTd) jobs.push(firstTd[1]);
  }
  return jobs;
}

function jobsFromDigestJson(data: unknown): string[] {
  const rows = Array.isArray(data) ? data : (data as { rows: { job: string }[] }).rows;
  return rows.map((row) => row.job);
}

async function expectSameDigest(app: ReturnType<typeof createApp>, night: string, jobs: string[]) {
  const pageRes = await app.request(`/digest/${night}`);
  const jsonRes = await app.request(`/api/digest/${night}`);
  expect(pageRes.status).toBe(jsonRes.status);

  if (jobs.length === 0) {
    expect(await pageRes.text()).toContain('nothing ran');
  } else {
    expect(jobsFromDigestHtml(await pageRes.text())).toEqual(jobs);
  }

  const json = await jsonRes.json();
  expect(jobsFromDigestJson(json)).toEqual(jobs);
}

describe('digest routes', () => {
  it('returns 200 for a real night with the same jobs on the page and in JSON', async () => {
    const runsDir = tempRuns({
      '2026-10-28.jsonl': readFileSync(join('runs', '2026-10-28.jsonl'), 'utf8'),
    });
    const app = createApp({ ...baseConfig, runsDir });
    await expectSameDigest(app, '2026-10-28', sortedJobs20261028);
  });

  it('returns 404 when the night has no file', async () => {
    const runsDir = tempRuns({});
    const app = createApp({ ...baseConfig, runsDir });

    const pageRes = await app.request('/digest/2026-10-29');
    const jsonRes = await app.request('/api/digest/2026-10-29');
    expect(pageRes.status).toBe(404);
    expect(jsonRes.status).toBe(404);
  });

  it('returns 200 for an empty night with nothing ran and empty rows', async () => {
    const runsDir = tempRuns({ '2026-10-27.jsonl': '' });
    const app = createApp({ ...baseConfig, runsDir });
    await expectSameDigest(app, '2026-10-27', []);
  });

  it('returns 200 for a night with a bad line and still renders rows', async () => {
    const runsDir = tempRuns({
      '2026-10-26.jsonl':
        '{"at":"2026-10-26T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}\n[]\n',
    });
    const app = createApp({ ...baseConfig, runsDir });
    await expectSameDigest(app, '2026-10-26', ['lane/sync']);
  });
});
