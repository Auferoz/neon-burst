/**
 * Pure helpers for db/sync-steam.js. Plain JS on purpose, like scoreBackfillUtils.js:
 * the script runs standalone via `node --env-file=.env`, outside the Astro toolchain.
 */

// Steam store category ids for controller support.
const CATEGORY_FULL_CONTROLLER = 28;
const CATEGORY_PARTIAL_CONTROLLER = 18;

/** Name as HowLongToBeat knows it: no ™/®/©, no trailing "(2016)", no "- GOTY Edition". */
export function cleanHltbName(name) {
  return name
    .replace(/[™®©]/g, '')
    .replace(/\s*[-–—]\s*(?:The\s+)?(Digital Edition|Enhanced|Remastered|GOTY|Game of the Year|Definitive|Complete|Standard|Edition).*$/i, '')
    .replace(/\s*\(\d{4}\)$/, '')
    .trim();
}

/**
 * Maps a Steam `appdetails` payload (`data[appid].data`) to steam_cache columns.
 * `controller_support` is 'full' | 'partial' | 'none': Steam sets the field only for
 * some games, so the "Full/Partial controller support" categories are checked too.
 * `categories` is a comma-separated id list, independent of the store language.
 */
export function mapStoreDetails(d) {
  const categoryIds = (d.categories || []).map(c => c.id);
  let controller = 'none';
  if (d.controller_support === 'full' || categoryIds.includes(CATEGORY_FULL_CONTROLLER)) controller = 'full';
  else if (d.controller_support === 'partial' || categoryIds.includes(CATEGORY_PARTIAL_CONTROLLER)) controller = 'partial';

  return {
    developer: d.developers?.join(', ') || '',
    publisher: d.publishers?.join(', ') || '',
    genres: (d.genres || []).map(g => g.description).join(', '),
    released: d.release_date?.date || '',
    controller_support: controller,
    categories: categoryIds.join(','),
    metacritic: d.metacritic?.score ?? null,
  };
}

const toHours = seconds => (seconds ? Math.round((seconds / 3600) * 10) / 10 : null);

/** Maps one HowLongToBeat search hit (times in seconds) to hours. */
export function mapHltbGame(g) {
  return { main: toHours(g.comp_main), extra: toHours(g.comp_plus), completionist: toHours(g.comp_100) };
}

/**
 * SQL string literal. Double quotes are emitted as char(34) because the statement
 * travels inside `wrangler d1 execute --command="..."`, where a literal `"` breaks
 * the Windows shell quoting.
 */
function text(value) {
  const escaped = String(value ?? '').replace(/'/g, "''");
  return `'${escaped.split('"').join("' || char(34) || '")}'`;
}

const num = value => (value == null ? 'NULL' : String(value));

/**
 * Upsert for one steam_cache row. Name and playtime always refresh; every other
 * field keeps its stored value when this run could not fetch it (empty text or NULL),
 * so a rate-limited store call or an HLTB miss never wipes good data.
 */
export function buildSteamCacheUpsert({ appid, name, playtime, lastPlayed, store = null, poster = '', hltb = null }) {
  const s = store || {};
  const keepText = col => `${col} = CASE WHEN excluded.${col} != '' THEN excluded.${col} ELSE steam_cache.${col} END`;
  const keepNum = col => `${col} = COALESCE(excluded.${col}, steam_cache.${col})`;

  return `INSERT INTO steam_cache (appid, name, developer, publisher, genres, released, poster, playtime, last_played, hltb_main, hltb_extra, hltb_completionist, controller_support, categories, metacritic, updated_at) `
    + `VALUES (${appid}, ${text(name)}, ${text(s.developer)}, ${text(s.publisher)}, ${text(s.genres)}, ${text(s.released)}, ${text(poster)}, ${playtime}, ${lastPlayed}, `
    + `${num(hltb?.main)}, ${num(hltb?.extra)}, ${num(hltb?.completionist)}, ${text(s.controller_support)}, ${text(s.categories)}, ${num(s.metacritic)}, datetime('now')) `
    + `ON CONFLICT(appid) DO UPDATE SET name = excluded.name, playtime = excluded.playtime, last_played = excluded.last_played, `
    + ['developer', 'publisher', 'genres', 'released', 'poster', 'controller_support', 'categories'].map(keepText).join(', ') + ', '
    + ['hltb_main', 'hltb_extra', 'hltb_completionist', 'metacritic'].map(keepNum).join(', ')
    + `, updated_at = excluded.updated_at`;
}
