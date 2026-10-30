import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import type { DigestStatus, ReadNight } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightOnBoard = {
  night: string;
  ok: number;
  retry: number;
  fail: number;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightOnBoard[];
};

function countByLastStatus(rows: { lastStatus: DigestStatus }[]) {
  let ok = 0;
  let retry = 0;
  let fail = 0;
  for (const row of rows) {
    if (row.lastStatus === 'ok') ok += 1;
    else if (row.lastStatus === 'retry') retry += 1;
    else fail += 1;
  }
  return { ok, retry, fail };
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig, readNight: ReadNight): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => {
      const result = readNight(config.runsDir, night);
      const counts = result ? countByLastStatus(result.rows) : { ok: 0, retry: 0, fail: 0 };
      return { night, ...counts };
    }),
  };
}
