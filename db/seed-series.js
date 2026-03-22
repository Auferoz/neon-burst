/**
 * Seed series_watched with initial data + sync series_cache from Trakt/TMDB.
 *
 * Usage: node --env-file=.env db/seed-series.js [--local | --remote]
 * Default: --local
 */
import { execSync } from 'node:child_process';

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TRAKT_API_URL = 'https://api.trakt.tv';
const TARGET = process.argv.includes('--remote') ? '--remote' : '--local';

function d1(sql, dbTarget = TARGET) {
  const cmd = `npx wrangler d1 execute neon-burst-db ${dbTarget} --command="${sql.replace(/"/g, '\\"')}"`;
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return output;
  } catch (e) {
    console.error(`  D1 error: ${e.message?.slice(0, 200)}`);
    return '';
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const esc = (str) => str ? str.replace(/'/g, "''") : '';

// ── Initial data ──

const ListSeriesByYear = [
  {
    year: 2024,
    series: [
      { idTrakt: "the-prince-of-tennis-ii-u-17-world-cup", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
    ]
  },
  {
    year: 2025,
    series: [
      { idTrakt: "blue-lock", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
      { idTrakt: "castlevania-nocturne", numberSeason: 1, platformViewed: "Netflix", statusViewed: "completed" },
      { idTrakt: "castlevania-nocturne", numberSeason: 2, platformViewed: "Netflix", statusViewed: "completed" },
      { idTrakt: "my-love-story", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
      { idTrakt: "white-collar", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "white-collar", numberSeason: 2, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "white-collar", numberSeason: 3, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "white-collar", numberSeason: 4, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "white-collar", numberSeason: 5, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "white-collar", numberSeason: 6, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "dragon-ball-daima", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
      { idTrakt: "formula-1-drive-to-survive", numberSeason: 7, platformViewed: "netflix", statusViewed: "completed" },
      { idTrakt: "solo-leveling", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
      { idTrakt: "you", numberSeason: 4, platformViewed: "netflix", statusViewed: "completed" },
      { idTrakt: "you", numberSeason: 5, platformViewed: "netflix", statusViewed: "completed" },
      { idTrakt: "black-mirror", numberSeason: 7, platformViewed: "netflix", statusViewed: "completed" },
      { idTrakt: "ghosts-2021", numberSeason: 1, platformViewed: "Netflix", statusViewed: "completed" },
      { idTrakt: "ghosts-2021", numberSeason: 2, platformViewed: "Netflix", statusViewed: "completed" },
      { idTrakt: "chrono-crusade", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
      { idTrakt: "the-beginning-after-the-end", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
      { idTrakt: "squid-game", numberSeason: 3, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "the-day-of-the-jackal", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "my-hero-academia-vigilantes", numberSeason: 1, platformViewed: "Crunchyroll", statusViewed: "completed" },
      { idTrakt: "chespirito-not-really-on-purpose", numberSeason: 1, platformViewed: "HBO Max", statusViewed: "completed" },
      { idTrakt: "the-playlist-2022", numberSeason: 1, platformViewed: "Netflix", statusViewed: "completed" },
      { idTrakt: "kaiju-no-8", numberSeason: 1, platformViewed: "Crunchyroll", statusViewed: "completed" },
      { idTrakt: "anne-shirley", numberSeason: 1, platformViewed: "Crunchyroll", statusViewed: "completed" },
      { idTrakt: "it-welcome-to-derry", numberSeason: 1, platformViewed: "HBO Max", statusViewed: "completed" },
      { idTrakt: "ghosts-2021", numberSeason: 3, platformViewed: "Netflix", statusViewed: "completed" },
    ]
  },
  {
    year: 2026,
    series: [
      { idTrakt: "east-new-york", numberSeason: 1, platformViewed: "HBO Max", statusViewed: "completed" },
      { idTrakt: "wandavision", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "the-falcon-and-the-winter-soldier", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "loki-2021", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "spy-x-family", numberSeason: 3, platformViewed: "Crunchyroll", statusViewed: "ongoing" },
      { idTrakt: "what-if-2021", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "hawkeye-2021", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "moon-knight", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "ms-marvel", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "i-am-groot", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "she-hulk-attorney-at-law", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "secret-invasion", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "i-am-groot", numberSeason: 2, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "loki-2021", numberSeason: 2, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "what-if-2021", numberSeason: 2, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "echo", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "agatha-all-along", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "x-men-97", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "what-if-2021", numberSeason: 3, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "your-friendly-neighborhood-spider-man", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "daredevil-born-again", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "ironheart", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "eyes-of-wakanda", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "marvel-zombies", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "wonder-man", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
      { idTrakt: "love-death-robots", numberSeason: 4, platformViewed: "Netflix", statusViewed: "completed" },
      { idTrakt: "rick-and-morty", numberSeason: 8, platformViewed: "HBO Max", statusViewed: "completed" },
      { idTrakt: "formula-1-drive-to-survive", numberSeason: 8, platformViewed: "Netflix", statusViewed: "completed" },
      { idTrakt: "how-to-sell-drugs-online-fast", numberSeason: 4, platformViewed: "Netflix", statusViewed: "completed" },
    ]
  },
];

// ── Trakt API ──

async function fetchShowInfo(slug) {
  try {
    const res = await fetch(`${TRAKT_API_URL}/shows/${slug}?extended=full`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-key': TRAKT_CLIENT_ID,
        'trakt-api-version': '2',
      },
    });
    if (!res.ok) {
      console.log(`  Trakt error ${res.status} for ${slug}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.log(`  Trakt fetch error for ${slug}: ${e.message}`);
    return null;
  }
}

async function fetchTmdbPoster(tmdbId) {
  if (!tmdbId || !TMDB_API_KEY) return '';
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return '';
    const data = await res.json();
    return data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
  } catch {
    return '';
  }
}

// ── Main ──

async function main() {
  console.log(`Seeding series data (${TARGET})...\n`);

  // Create tables
  d1(`CREATE TABLE IF NOT EXISTS series_cache (
    trakt_slug TEXT PRIMARY KEY, trakt_id INTEGER, tmdb_id INTEGER, imdb_id TEXT,
    title TEXT NOT NULL, year INTEGER, overview TEXT, rating REAL DEFAULT 0,
    genres TEXT, network TEXT, status TEXT, runtime INTEGER DEFAULT 0,
    poster TEXT, updated_at TEXT DEFAULT (datetime('now'))
  )`);
  d1(`CREATE TABLE IF NOT EXISTS series_watched (
    id INTEGER PRIMARY KEY AUTOINCREMENT, trakt_slug TEXT NOT NULL,
    season_number INTEGER NOT NULL, year_watched INTEGER NOT NULL,
    platform TEXT, status_viewed TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(trakt_slug, season_number)
  )`);
  d1(`CREATE INDEX IF NOT EXISTS idx_series_watched_slug ON series_watched(trakt_slug)`);
  d1(`CREATE INDEX IF NOT EXISTS idx_series_watched_year ON series_watched(year_watched)`);

  // Clear existing data
  d1('DELETE FROM series_watched');
  d1('DELETE FROM series_cache');

  // Insert watched entries
  console.log('Inserting watched entries...');
  let totalEntries = 0;

  for (const yearGroup of ListSeriesByYear) {
    for (const s of yearGroup.series) {
      d1(`INSERT OR IGNORE INTO series_watched (trakt_slug, season_number, year_watched, platform, status_viewed) VALUES ('${esc(s.idTrakt)}', ${s.numberSeason}, ${yearGroup.year}, '${esc(s.platformViewed)}', '${esc(s.statusViewed)}')`);
      totalEntries++;
    }
  }
  console.log(`  ${totalEntries} entries inserted\n`);

  // Get unique slugs
  const allSlugs = new Set();
  for (const yearGroup of ListSeriesByYear) {
    for (const s of yearGroup.series) {
      allSlugs.add(s.idTrakt);
    }
  }

  const slugs = [...allSlugs];
  console.log(`Syncing ${slugs.length} unique shows from Trakt...\n`);

  let synced = 0, errors = 0;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    process.stdout.write(`  [${i + 1}/${slugs.length}] ${slug}... `);

    const show = await fetchShowInfo(slug);
    await sleep(300);

    if (!show) {
      errors++;
      console.log('NOT FOUND');
      continue;
    }

    let poster = '';
    if (show.ids?.tmdb) {
      poster = await fetchTmdbPoster(show.ids.tmdb);
      await sleep(200);
    }

    const rating = Math.round((show.rating || 0) * 10) / 10;
    const genres = show.genres?.join(', ') || '';

    const sql = `INSERT OR REPLACE INTO series_cache (trakt_slug, trakt_id, tmdb_id, imdb_id, title, year, overview, rating, genres, network, status, runtime, poster, updated_at) VALUES ('${esc(slug)}', ${show.ids?.trakt || 'NULL'}, ${show.ids?.tmdb || 'NULL'}, '${esc(show.ids?.imdb || '')}', '${esc(show.title)}', ${show.year || 'NULL'}, '${esc(show.overview || '')}', ${rating}, '${esc(genres)}', '${esc(show.network || '')}', '${esc(show.status || '')}', ${show.runtime || 0}, '${esc(poster)}', datetime('now'))`;

    const result = d1(sql);
    if (result !== '') {
      synced++;
      const parts = [];
      parts.push(poster ? 'Poster' : 'No Poster');
      parts.push(`Rating ${rating}`);
      parts.push(show.network || 'No Network');
      console.log(`OK (${parts.join(', ')})`);
    } else {
      errors++;
      console.log('D1 INSERT ERROR');
    }
  }

  console.log(`\nDone! Entries: ${totalEntries}, Shows synced: ${synced}, Errors: ${errors}`);
}

main().catch(console.error);
