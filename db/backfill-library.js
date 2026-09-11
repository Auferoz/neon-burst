/**
 * Backfill library_games metadata from IGDB.
 *
 * Two kinds of broken rows are repaired:
 *   1. igdb_id IS NULL  — the import never resolved the title. Most of these
 *      failed because the store appends its own suffix ("- PC Edition",
 *      "Digital Deluxe", "(Game Preview)"), which IGDB has never heard of.
 *      Cleaning the title first is what actually recovers them.
 *   2. igdb_id present but metadata empty — re-fetch straight by id.
 *
 * Reports by default and writes nothing. Pass --apply to update the database.
 *
 * Usage: node --env-file=.env db/backfill-library.js [--local|--remote] [--apply]
 */
import { execSync } from 'node:child_process';

const TARGET = process.argv.includes('--remote') ? '--remote' : '--local';
const APPLY = process.argv.includes('--apply');

/** `--skip 550,442` leaves those library_games rows untouched (bad IGDB matches). */
const SKIP_IDS = new Set(
  (process.argv.find((a) => a.startsWith('--skip='))?.slice('--skip='.length) ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(Number.isFinite),
);

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (str) => (str ? String(str).replace(/'/g, "''") : '');

function d1(sql) {
  // Must be a single line: multi-line SQL breaks quote escaping on the Windows shell.
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  const cmd = `npx wrangler d1 execute neon-burst-db ${TARGET} --json --command="${oneLine.replace(/"/g, '\\"')}"`;
  try {
    const out = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
    const start = out.indexOf('[');
    return start === -1 ? [] : (JSON.parse(out.slice(start))[0]?.results ?? []);
  } catch (e) {
    console.error('  d1 error:', e.message.split('\n')[0]);
    return [];
  }
}

// ── Title cleanup ──────────────────────────────────────────────────────────

/**
 * Launcher entries that are not games at all. These are reported and skipped —
 * chasing them in IGDB only produces confident wrong matches.
 */
const NOT_A_GAME = [
  /\bmod\s?kit\b/i,
  /\bresource archiver\b/i,
  /\blauncher\b/i,
  /\bpre-?game editor\b/i,
  /\b(pts|pps)\b/,
  /\bpublic testing\b/i,
  /\btest branch\b/i,
  /\bplaytest\b/i,
  /\bfree experience\b/i,
];

/**
 * Store-appended noise. Order matters: the longest, most specific phrases go
 * first so a shorter pattern never eats half of a longer one.
 */
const SUFFIX_NOISE = [
  /\s*[-–—]\s*PC Edition\b/i,
  /\s*\bXbox Series X\|S\b/i,
  /\s*\bWINDOWS EDITION\b/i,
  /\s*\bfor Windows\b/i,
  /\s*\(Game Preview\)/i,
  /\s*\(Beta\)/i,
  /\s*\bBeta\b$/i,
  /\s*\bDemo\b$/i,
  /\s*[-–—]?\s*(Digital )?Deluxe Edition\b/i,
  /\s*[-–—]?\s*Standard Edition\b/i,
  /\s*[-–—]?\s*Digital Deluxe\b/i,
  /\s*[-–—]?\s*Champions Edition\b/i,
  /\s*[-–—]?\s*Limited Edition\b/i,
  /\s*[-–—]?\s*Hunter Edition\b/i,
  /\s*[-–—]?\s*Celebration Edition\b/i,
  /\s*[-–—]?\s*EA Play Edition\b/i,
  /\s*[-–—]?\s*Maximum Edition\b/i,
  /\s*\((19|20)\d{2}\)\s*$/,
  /^EA SPORTS\s+/i,
];

/** Strips store noise so the title has a chance of existing in IGDB. */
function cleanTitle(title) {
  let cleaned = title;
  for (const pattern of SUFFIX_NOISE) cleaned = cleaned.replace(pattern, '');
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

function isNotAGame(title) {
  return NOT_A_GAME.some((p) => p.test(title));
}

// ── IGDB ───────────────────────────────────────────────────────────────────

let token = null;

async function getToken() {
  if (token) return token;
  const url = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch OAuth failed: ${res.status}`);
  token = (await res.json()).access_token;
  return token;
}

async function igdb(body) {
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${await getToken()}`,
      'Content-Type': 'text/plain',
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB ${res.status}: ${await res.text()}`);
  return res.json();
}

const FIELDS =
  'fields id,name,slug,first_release_date,summary,cover.image_id,artworks.image_id,' +
  'genres.name,involved_companies.company.name,involved_companies.developer,' +
  'involved_companies.publisher,videos.name,videos.video_id,platforms.abbreviation;';

async function lookupByName(name) {
  const escaped = name.replace(/"/g, '\\"');
  const results = await igdb(`${FIELDS} search "${escaped}"; limit 5;`);
  return results[0] ?? null;
}

async function lookupById(id) {
  const results = await igdb(`${FIELDS} where id = ${id}; limit 1;`);
  return results[0] ?? null;
}

/** Maps an IGDB game to the library_games column shapes (image_id, DD/MM/YYYY, ...). */
function mapGame(g) {
  const companies = g.involved_companies ?? [];
  const developer = companies.find((c) => c.developer)?.company?.name;
  const publisher = companies.find((c) => c.publisher)?.company?.name;
  const trailer =
    (g.videos ?? []).find((v) => /trailer/i.test(v.name ?? ''))?.video_id ??
    (g.videos ?? [])[0]?.video_id ??
    '';

  let released = '';
  if (g.first_release_date) {
    const d = new Date(g.first_release_date * 1000);
    released = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }

  return {
    igdb_id: g.id,
    igdb_name: g.name,
    poster: g.cover?.image_id ?? '',
    artworks: (g.artworks ?? [])[0]?.image_id ?? '',
    released,
    companie: developer ?? publisher ?? '',
    genre: (g.genres ?? []).map((x) => x.name).join(', '),
    description: (g.summary ?? '').slice(0, 2000),
    trailer,
  };
}

// ── Update ─────────────────────────────────────────────────────────────────

/**
 * Only fills blanks. A field the user typed by hand is never overwritten, which
 * is what makes re-running this safe.
 */
function buildUpdate(row, data) {
  const sets = [`igdb_id = ${data.igdb_id}`];
  const fillable = ['poster', 'artworks', 'released', 'companie', 'genre', 'description', 'trailer'];

  for (const field of fillable) {
    if (!data[field]) continue;
    if (row[field]) continue;
    sets.push(`${field} = '${esc(data[field])}'`);
  }

  return `UPDATE library_games SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ${row.id};`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    console.error('Missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET. Run with --env-file=.env');
    process.exit(1);
  }

  console.log(`Target: ${TARGET}   Mode: ${APPLY ? 'APPLY (writes)' : 'REPORT ONLY (no writes)'}\n`);

  const broken = d1(
    `SELECT id, title, store, igdb_id, poster, artworks, released, companie, genre, description, trailer
     FROM library_games
     WHERE igdb_id IS NULL
        OR poster = '' OR poster IS NULL
        OR released = '' OR released IS NULL
        OR companie = '' OR companie IS NULL
        OR genre = '' OR genre IS NULL
     ORDER BY store, title;`,
  );

  console.log(`Rows needing work: ${broken.length}\n`);

  const resolved = [];
  const notGames = [];
  const unresolved = [];

  for (const row of broken) {
    if (SKIP_IDS.has(row.id)) continue;
    if (row.igdb_id == null && isNotAGame(row.title)) {
      notGames.push(row);
      continue;
    }

    try {
      let game;
      let via;

      if (row.igdb_id != null) {
        game = await lookupById(row.igdb_id);
        via = `id ${row.igdb_id}`;
      } else {
        const cleaned = cleanTitle(row.title);
        game = await lookupByName(cleaned);
        via = cleaned === row.title ? 'search' : `search "${cleaned}"`;
      }

      if (!game) unresolved.push({ row, via });
      else resolved.push({ row, via, data: mapGame(game) });
    } catch (e) {
      unresolved.push({ row, via: `error: ${e.message}` });
    }

    await sleep(260); // IGDB allows 4 req/s; stay under it.
  }

  console.log(`── RESOLVED (${resolved.length}) ─────────────────────────────`);
  for (const { row, via, data } of resolved) {
    const renamed = data.igdb_name !== row.title ? `  ->  "${data.igdb_name}"` : '';
    const fields = ['poster', 'released', 'companie', 'genre']
      .filter((f) => !row[f] && data[f])
      .join(', ');
    console.log(`  [${row.store}] ${row.title}${renamed}`);
    console.log(`      via ${via} | igdb_id=${data.igdb_id}${fields ? ` | llena: ${fields}` : ''}`);
  }

  console.log(`\n── NOT A GAME, skipped (${notGames.length}) ────────────────`);
  notGames.forEach((r) => console.log(`  [${r.store}] ${r.title}   (id ${r.id})`));

  console.log(`\n── UNRESOLVED (${unresolved.length}) ───────────────────────`);
  unresolved.forEach(({ row, via }) => console.log(`  [${row.store}] ${row.title}   (${via})`));

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to update the database.');
    return;
  }

  console.log('\nApplying...');
  let ok = 0;
  for (const { row, data } of resolved) {
    d1(buildUpdate(row, data));
    ok++;
  }
  console.log(`Updated ${ok} rows.`);
  console.log(
    `\nThe title itself is left alone on purpose — it is half of the unique index, ` +
      `so renaming can collide with an existing row. Rename from the UI if you want the IGDB name.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
