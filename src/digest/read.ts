import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, ReadNight } from './types.js';

// One row per job. A line that does not parse, or is not a record, is counted.
type LogRecord = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

function isStatus(value: unknown): value is DigestStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseLine(line: string): LogRecord | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

  const rec = value as Record<string, unknown>;
  const { at, job, status, owner, error } = rec;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return undefined;
  if (typeof job !== 'string' || job === '') return undefined;
  if (!isStatus(status)) return undefined;
  if (owner !== null && typeof owner !== 'string') return undefined;
  if (error !== undefined && typeof error !== 'string') return undefined;

  return { at, job, status, owner, error: error ?? null };
}

function isNotFound(err: unknown): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT';
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of text.split('\n')) {
    if (line === '') continue;
    const rec = parseLine(line);
    if (!rec) {
      badLines += 1;
      continue;
    }

    const atMs = Date.parse(rec.at);
    const row = byJob.get(rec.job);
    if (!row) {
      byJob.set(rec.job, {
        job: rec.job,
        owner: rec.owner,
        runs: 1,
        retries: rec.status === 'retry' ? 1 : 0,
        lastStatus: rec.status,
        lastError: rec.error,
        firstAt: rec.at,
        lastAt: rec.at,
      });
      continue;
    }

    row.runs += 1;
    if (rec.status === 'retry') row.retries += 1;
    if (atMs < Date.parse(row.firstAt)) row.firstAt = rec.at;
    if (atMs >= Date.parse(row.lastAt)) {
      row.lastAt = rec.at;
      row.lastStatus = rec.status;
      row.lastError = rec.error;
      row.owner = rec.owner;
    }
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
};
