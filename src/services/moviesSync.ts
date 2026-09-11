/**
 * Movies sync — fetches movie lists from Trakt API
 * and caches them in D1 (movies_cache + movies_lists tables).
 */

import { env } from 'cloudflare:workers';

const TRAKT_USERNAME = 'Auferoz';
const TRAKT_API_URL = 'https://api.trakt.tv';

function getTraktHeaders() {
  return {
    'Content-Type': 'application/json',
    'trakt-api-key': env.TRAKT_CLIENT_ID,
    'trakt-api-version': '2',
    'User-Agent': 'neon-burst/1.0',
  };
}

interface TraktListItem {
  listed_at: string;
  movie: {
    title: string;
    year: number;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    runtime: number;
    genres: string[];
    overview: string;
    rating: number;
    released: string;
    images?: { poster?: string[]; fanart?: string[]; thumb?: string[] };
  };
}

interface TraktList {
  name: string;
  ids: { trakt: number; slug: string };
  description: string;
  item_count: number;
}

function traktImage(url?: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://${url}`;
}

/**
 * Promueve a su trakt_id real las películas que se cargaron a mano.
 *
 * Un alta manual guarda la fila con un trakt_id provisional negativo, porque sin
 * la API de Trakt no se puede conocer el real. Si el sync insertara directo, el
 * `ON CONFLICT(trakt_id)` no encontraría esa fila —tiene otro id— y crearía una
 * segunda para la misma película. Por eso esto corre ANTES del upsert: empareja
 * por tmdb_id, que es el identificador que existe en las dos fuentes.
 *
 * Solo toca filas con trakt_id negativo: las que ya tienen uno real de Trakt no
 * se tocan, y la que ya tiene el id correcto tampoco (evita un UPDATE inútil).
 */
async function promoteProvisionalRows(db: D1Database, items: TraktListItem[]): Promise<number> {
  const pairs = items
    .map(i => ({ tmdb: i.movie.ids.tmdb, trakt: i.movie.ids.trakt }))
    .filter(p => p.tmdb && p.trakt);

  if (!pairs.length) return 0;

  const stmt = db.prepare(
    `UPDATE movies_cache SET trakt_id = ?, updated_at = datetime('now')
     WHERE tmdb_id = ? AND trakt_id < 0`
  );

  let promoted = 0;
  for (let i = 0; i < pairs.length; i += 50) {
    const batch = pairs.slice(i, i + 50);
    try {
      const results = await db.batch(batch.map(p => stmt.bind(p.trakt, p.tmdb)));
      promoted += results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
    } catch (e) {
      console.error('[moviesSync] promote failed:', e);
    }
  }

  return promoted;
}

/**
 * Registra en movies_watched las películas de la lista del año.
 *
 * Desde que la lista se lee por JOIN contra movies_watched, escribir solo en
 * movies_cache dejaría al sync mudo: las películas nuevas no aparecerían.
 *
 * El ON CONFLICT también cierra la reconciliación: si la película ya estaba
 * cargada a mano en ese año, la fila pasa a `source = 'trakt'` con su trakt_id
 * real en vez de duplicarse. El trakt_slug escrito a mano se conserva.
 */
async function upsertWatched(
  db: D1Database,
  items: TraktListItem[],
  yearWatched: number
): Promise<{ written: number; skipped: number }> {
  const stmt = db.prepare(
    `INSERT INTO movies_watched (tmdb_id, trakt_id, trakt_slug, year_watched, listed_at, source)
     VALUES (?, ?, ?, ?, ?, 'trakt')
     ON CONFLICT(tmdb_id, year_watched) DO UPDATE SET
       trakt_id = excluded.trakt_id,
       trakt_slug = COALESCE(movies_watched.trakt_slug, excluded.trakt_slug),
       listed_at = excluded.listed_at,
       source = 'trakt',
       updated_at = datetime('now')`
  );

  // Sin tmdb_id no hay forma de enlazar con movies_cache: la fila queda en el
  // caché pero fuera de la lista, y se cuenta para que no pase inadvertido.
  const usable = items.filter(i => i.movie.ids.tmdb);
  const skipped = items.length - usable.length;

  let written = 0;
  for (let i = 0; i < usable.length; i += 50) {
    const batch = usable.slice(i, i + 50);
    try {
      await db.batch(batch.map(item => stmt.bind(
        item.movie.ids.tmdb,
        item.movie.ids.trakt,
        item.movie.ids.slug || null,
        yearWatched,
        item.listed_at || '',
      )));
      written += batch.length;
    } catch (e) {
      console.error('[moviesSync] upsertWatched failed:', e);
    }
  }

  return { written, skipped };
}

async function fetchUserMovieLists(): Promise<TraktList[]> {
  const res = await fetch(`${TRAKT_API_URL}/users/${TRAKT_USERNAME}/lists`, {
    headers: getTraktHeaders(),
  });
  if (!res.ok) return [];
  const lists = await res.json() as TraktList[];
  return lists.filter(l => l.ids.slug.startsWith('movies-'));
}

async function fetchListItems(slug: string): Promise<TraktListItem[]> {
  const res = await fetch(
    `${TRAKT_API_URL}/users/${TRAKT_USERNAME}/lists/${slug}/items/movies?extended=full`,
    { headers: getTraktHeaders() }
  );
  if (!res.ok) return [];
  return await res.json() as TraktListItem[];
}

/**
 * Cron sync — only syncs the current year list (movies-YYYY).
 * Does NOT delete other years' data. Uses INSERT OR REPLACE so existing
 * data for the current year is updated safely.
 */
export async function syncMovies(db: D1Database): Promise<{ synced: number; errors: number; lists: number }> {
  // Create tables if needed
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS movies_lists (
      slug TEXT PRIMARY KEY, description TEXT, item_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS movies_cache (
      trakt_id INTEGER PRIMARY KEY, tmdb_id INTEGER, imdb_id TEXT,
      title TEXT NOT NULL, year INTEGER, released TEXT, runtime INTEGER DEFAULT 0,
      genres TEXT, overview TEXT, rating REAL DEFAULT 0, poster TEXT, thumb TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS movies_watched (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tmdb_id INTEGER NOT NULL,
      trakt_id INTEGER, trakt_slug TEXT, year_watched INTEGER NOT NULL,
      platform TEXT, source TEXT NOT NULL DEFAULT 'trakt' CHECK (source IN ('trakt', 'manual')),
      listed_at TEXT, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')), UNIQUE (tmdb_id, year_watched)
    )
  `).run();

  await db.prepare(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_cache_tmdb ON movies_cache(tmdb_id)'
  ).run();

  const currentYear = new Date().getFullYear();
  const currentSlug = `movies-${currentYear}`;

  // Fetch all user lists to find the current year's list
  const movieLists = await fetchUserMovieLists();
  const currentList = movieLists.find(l => l.ids.slug === currentSlug);
  if (!currentList) return { synced: 0, errors: 0, lists: 0 };

  // Fetch items for current year only
  const items = await fetchListItems(currentSlug);
  if (!items.length) return { synced: 0, errors: 0, lists: 1 };

  // Upsert list metadata
  await db.prepare(
    `INSERT OR REPLACE INTO movies_lists (slug, description, item_count, updated_at) VALUES (?, ?, ?, datetime('now'))`
  ).bind(currentSlug, currentList.description || '', items.length).run();

  let synced = 0, errors = 0;

  // Reconciliación: tiene que ir ANTES del upsert. Si no, el ON CONFLICT(trakt_id)
  // no encuentra las filas cargadas a mano (tienen id provisional) y las duplica.
  const promoted = await promoteProvisionalRows(db, items);
  if (promoted) console.log(`[moviesSync] ${promoted} películas manuales promovidas a su trakt_id real`);

  // Batch upsert in chunks of 50 — preserves detail columns (cast_json, videos_json, etc.)
  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    const stmt = db.prepare(
      `INSERT INTO movies_cache
        (trakt_id, tmdb_id, imdb_id, title, year, released, runtime, genres, overview, rating, poster, thumb, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(trakt_id) DO UPDATE SET
        tmdb_id=excluded.tmdb_id, imdb_id=excluded.imdb_id, title=excluded.title,
        year=excluded.year, released=excluded.released, runtime=excluded.runtime,
        genres=excluded.genres, overview=excluded.overview, rating=excluded.rating,
        poster=excluded.poster, thumb=excluded.thumb, updated_at=excluded.updated_at`
    );

    const ops = [];
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const m = item.movie;
      const poster = traktImage(m.images?.poster?.[0]);
      const thumb = traktImage(m.images?.fanart?.[0] || m.images?.thumb?.[0]);

      ops.push(stmt.bind(
        m.ids.trakt, m.ids.tmdb || null, m.ids.imdb || '',
        m.title, m.year || null, m.released || '',
        m.runtime || 0, m.genres?.join(', ') || '', m.overview || '',
        Math.round((m.rating || 0) * 10) / 10, poster, thumb,
      ));
    }

    try {
      await db.batch(ops);
      synced += batch.length;
    } catch {
      errors += batch.length;
    }
  }

  // La lista se lee por JOIN contra movies_watched: sin esto el sync no se vería
  const { written, skipped } = await upsertWatched(db, items, currentYear);
  if (skipped) console.warn(`[moviesSync] ${skipped} películas sin tmdb_id quedaron fuera de la lista`);
  console.log(`[moviesSync] ${written} entradas registradas en movies_watched (${currentYear})`);

  return { synced, errors, lists: 1 };
}
