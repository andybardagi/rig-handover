// One row per job. Times are the log's `at` strings; the offset stays.
export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// Rows for the night, plus a count of lines that did not parse.
export type ReadNightResult = {
  rows: DigestRow[];
  badLines: number;
};

// readNight(runsDir, night). The reader implements this; the signature lives here.
export type ReadNight = (runsDir: string, night: string) => ReadNightResult;
