import type { DigestRow, ReadNightResult } from '../digest/types.js';

function markRow(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function ownerCell(owner: string | null) {
  return owner ?? '—';
}

export function DigestPage(props: { night: string; result: ReadNightResult }) {
  const rows = [...props.result.rows].sort((a, b) => a.job.localeCompare(b.job));

  return (
    <>
      <h1>digest · {props.night}</h1>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last</th>
              <th>error</th>
              <th>first</th>
              <th>last at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const marked = markRow(row);
              const cell = marked ? 'warn' : undefined;
              return (
                <tr>
                  <td class={cell}>{row.job}</td>
                  <td class={cell}>{ownerCell(row.owner)}</td>
                  <td class={cell}>{row.runs}</td>
                  <td class={cell}>{row.retries}</td>
                  <td class={cell}>{row.lastStatus}</td>
                  <td class={cell}>{row.lastError ?? '—'}</td>
                  <td class={cell}>{row.firstAt}</td>
                  <td class={cell}>{row.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {props.result.badLines > 0 ? (
        <p class="mute">
          {props.result.badLines} line{props.result.badLines === 1 ? '' : 's'} did not parse
        </p>
      ) : null}
    </>
  );
}
