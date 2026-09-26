/**
 * Pure helper for db/sync-local.js. Plain JS on purpose, like scoreBackfillUtils.js:
 * the script runs standalone, outside the Astro/Cloudflare toolchain.
 *
 * Local D1 rejects any single statement over ~100 KB (SQLITE_TOOBIG), and a
 * `wrangler d1 export` writes each row as one INSERT line. A row with a large JSON
 * column (series_cache.seasons_json of a long-running show) breaks the whole import.
 * This rewrites such an INSERT as the same row with its large text columns empty,
 * followed by `UPDATE ... SET col = col || '<chunk>'` statements that rebuild them.
 */

const quote = s => `'${s.replace(/'/g, "''")}'`;

/** Parses one `INSERT INTO "table" ("a","b") VALUES(...);` line from a D1 export. */
function parseInsert(line) {
  const head = line.match(/^INSERT INTO "([^"]+)" \(([^)]*)\) VALUES\(/);
  if (!head) throw new Error(`Oversized statement is not an INSERT: ${line.slice(0, 80)}...`);

  const table = head[1];
  const cols = head[2].split(',').map(c => c.replace(/"/g, ''));
  const vals = [];
  let i = head[0].length;

  while (i < line.length && line[i] !== ')') {
    if (line[i] === ',' || line[i] === ' ') { i++; continue; }
    if (line[i] === "'") {
      let text = '';
      i++;
      for (;;) {
        if (i >= line.length) throw new Error(`Unterminated literal in ${table}`);
        if (line[i] === "'" && line[i + 1] === "'") { text += "'"; i += 2; continue; }
        if (line[i] === "'") { i++; break; }
        text += line[i++];
      }
      vals.push({ text });
    } else {
      let j = i;
      while (j < line.length && line[j] !== ',' && line[j] !== ')') j++;
      vals.push({ raw: line.slice(i, j) });
      i = j;
    }
  }

  if (vals.length !== cols.length) {
    throw new Error(`Column count mismatch in ${table}: ${cols.length} columns, ${vals.length} values`);
  }
  return { table, cols, vals };
}

/**
 * @param {string[]} lines  statements of a D1 export, one per line
 * @param {{ limit: number, chunk: number }} opts  max statement length / max text per append
 * @returns {{ main: string[], deferred: string[] }}  `deferred` must run after `main`
 */
export function splitOversizedStatements(lines, { limit, chunk }) {
  const main = [];
  const deferred = [];

  for (const line of lines) {
    if (line.length <= limit) { main.push(line); continue; }

    const { table, cols, vals } = parseInsert(line);
    // The first column of a D1 export row is the primary key in every table here.
    const pk = cols[0];
    const pkValue = vals[0].text !== undefined ? quote(vals[0].text) : vals[0].raw;
    const appends = [];

    const literals = vals.map((v, k) => {
      if (v.text === undefined) return v.raw;
      if (v.text.length <= chunk) return quote(v.text);
      for (let start = 0; start < v.text.length; start += chunk) {
        appends.push(
          `UPDATE "${table}" SET "${cols[k]}" = "${cols[k]}" || ${quote(v.text.slice(start, start + chunk))} WHERE "${pk}" = ${pkValue};`
        );
      }
      return "''";
    });

    deferred.push(`INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES(${literals.join(',')});`, ...appends);
  }

  return { main, deferred };
}
