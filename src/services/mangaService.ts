/**
 * Manga service — D1 CRUD for manga_read + manga_cache.
 *
 * Modeled on seriesService.ts, with one difference: AniList blocks Cloudflare
 * Workers IPs with a 403 (see anilist.ts), so this service never calls
 * AniList itself. The browser fetches AniList data and sends it in — this
 * module only validates (at the API route, via validateAnilistMediaPayload),
 * maps it with mapAnilistToCacheRow, and persists it.
 */

import {
  mapAnilistToCacheRow,
  type AnilistMediaResponse,
  type MangaCacheRow,
} from './anilist';

export interface MangaReadRow {
  id: number;
  anilist_id: number;
  estado: string;
  capitulo_actual: number;
  platform: string;
  fecha_inicio: string;
  fecha_final: string;
  rating_personal: number | null;
  created_at: string;
  updated_at: string;
}

export interface MangaEntry extends MangaReadRow {
  title_romaji: string;
  title_english: string;
  title_native: string;
  type: string;
  format: string;
  status: string;
  cover: string;
  cover_color: string;
  chapters: number | null;
  volumes: number | null;
  genres_json: string;
}

// ── List ──

export async function getAllManga(db: D1Database): Promise<MangaEntry[]> {
  const { results } = await db.prepare(`
    SELECT r.*, c.title_romaji, c.title_english, c.title_native, c.type, c.format,
           c.status, c.cover, c.cover_color, c.chapters, c.volumes, c.genres_json
    FROM manga_read r
    LEFT JOIN manga_cache c ON r.anilist_id = c.anilist_id
    ORDER BY r.created_at DESC
  `).all<MangaEntry>();
  return results;
}

/**
 * Upserts a full manga_cache row (base fields + tags/staff/characters/relations/
 * recommendations/external links + detail_fetched_at). The browser always sends
 * the full AniList query result (see FULL_QUERY in anilist.ts), so there's no
 * partial variant of this — unlike the old two-step insert-then-update.
 */
async function upsertMangaCache(db: D1Database, row: MangaCacheRow): Promise<void> {
  await db.prepare(`
    INSERT INTO manga_cache
      (anilist_id, id_mal, title_romaji, title_english, title_native, synonyms_json,
       type, format, country, status, description, cover, cover_color, banner,
       start_date, end_date, chapters, volumes, average_score, mean_score,
       popularity, favourites, source, genres_json, is_adult, site_url,
       tags_json, staff_json, characters_json, relations_json, recommendations_json,
       external_links_json, detail_fetched_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(anilist_id) DO UPDATE SET
      id_mal=excluded.id_mal, title_romaji=excluded.title_romaji,
      title_english=excluded.title_english, title_native=excluded.title_native,
      synonyms_json=excluded.synonyms_json, type=excluded.type, format=excluded.format,
      country=excluded.country, status=excluded.status, description=excluded.description,
      cover=excluded.cover, cover_color=excluded.cover_color, banner=excluded.banner,
      start_date=excluded.start_date, end_date=excluded.end_date, chapters=excluded.chapters,
      volumes=excluded.volumes, average_score=excluded.average_score, mean_score=excluded.mean_score,
      popularity=excluded.popularity, favourites=excluded.favourites, source=excluded.source,
      genres_json=excluded.genres_json, is_adult=excluded.is_adult, site_url=excluded.site_url,
      tags_json=excluded.tags_json, staff_json=excluded.staff_json, characters_json=excluded.characters_json,
      relations_json=excluded.relations_json, recommendations_json=excluded.recommendations_json,
      external_links_json=excluded.external_links_json, detail_fetched_at=excluded.detail_fetched_at,
      updated_at=excluded.updated_at
  `).bind(
    row.anilist_id, row.id_mal, row.title_romaji, row.title_english, row.title_native, row.synonyms_json,
    row.type, row.format, row.country, row.status, row.description, row.cover, row.cover_color, row.banner,
    row.start_date, row.end_date, row.chapters, row.volumes, row.average_score, row.mean_score,
    row.popularity, row.favourites, row.source, row.genres_json, row.is_adult, row.site_url,
    row.tags_json, row.staff_json, row.characters_json, row.relations_json, row.recommendations_json,
    row.external_links_json,
  ).run();
}

/** Refreshes manga_cache from a media payload the browser already validated-fetched. Used by the on-demand refresh endpoint. */
export async function refreshMangaCache(db: D1Database, media: AnilistMediaResponse): Promise<void> {
  const row = mapAnilistToCacheRow(media);
  await upsertMangaCache(db, row);
}

export async function createMangaEntry(
  db: D1Database,
  data: {
    anilist_id: number;
    media: AnilistMediaResponse;
    estado: string;
    capitulo_actual: number;
    platform: string;
    fecha_inicio: string;
    fecha_final: string;
    rating_personal: number | null;
  }
): Promise<MangaReadRow> {
  const row = mapAnilistToCacheRow(data.media);
  await upsertMangaCache(db, row);

  const result = await db.prepare(
    `INSERT INTO manga_read (anilist_id, estado, capitulo_actual, platform, fecha_inicio, fecha_final, rating_personal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.anilist_id, data.estado || 'Leyendo', data.capitulo_actual || 0,
    data.platform || '', data.fecha_inicio || '', data.fecha_final || '', data.rating_personal ?? null,
  ).run();

  const id = result.meta.last_row_id as number;
  return (await db.prepare('SELECT * FROM manga_read WHERE id = ?').bind(id).first<MangaReadRow>())!;
}

export async function updateMangaEntry(
  db: D1Database,
  id: number,
  data: Partial<{
    estado: string; capitulo_actual: number; platform: string;
    fecha_inicio: string; fecha_final: string; rating_personal: number | null;
  }>
): Promise<MangaReadRow | null> {
  const allowedColumns = new Set(['estado', 'capitulo_actual', 'platform', 'fecha_inicio', 'fecha_final', 'rating_personal']);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && allowedColumns.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return null;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await db.prepare(`UPDATE manga_read SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return db.prepare('SELECT * FROM manga_read WHERE id = ?').bind(id).first<MangaReadRow>();
}

export async function deleteMangaEntry(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM manga_read WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

// ── Lookup (DB-only "already added?" check for the add modal) ──

/**
 * The AniList preview itself is fetched by the browser (see anilist.ts);
 * this only answers whether the manga is already tracked, which is the one
 * thing that needs D1.
 */
export async function isMangaAlreadyAdded(db: D1Database, anilistId: number): Promise<boolean> {
  const existing = await db.prepare('SELECT id FROM manga_read WHERE anilist_id = ?').bind(anilistId).first();
  return !!existing;
}

// ── Detail ──

export interface MangaDetail extends MangaCacheRow {
  read_entry: MangaReadRow | null;
  /** True when the cache was never fetched, or the title is still RELEASING and the cached detail is older than 7 days. */
  needs_refresh: boolean;
}

const RELEASING_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Renders strictly from D1 — the server can't fetch AniList (see anilist.ts).
 * `needs_refresh` tells the detail page whether to mount MangaRefresher.vue,
 * which does the AniList fetch client-side and PUTs the result back.
 */
export async function getMangaDetail(db: D1Database, anilistId: number): Promise<MangaDetail | null> {
  const row = await db.prepare('SELECT * FROM manga_cache WHERE anilist_id = ?')
    .bind(anilistId).first<Record<string, unknown>>();
  if (!row) return null;

  const fetchedAt = row.detail_fetched_at as string | null;
  const isStaleReleasing = row.status === 'RELEASING' && !!fetchedAt &&
    (Date.now() - new Date(fetchedAt + 'Z').getTime()) > RELEASING_STALE_MS;
  const needsRefresh = !fetchedAt || isStaleReleasing;

  const readEntry = await db.prepare('SELECT * FROM manga_read WHERE anilist_id = ?')
    .bind(anilistId).first<MangaReadRow>();

  return { ...(row as unknown as MangaCacheRow), read_entry: readEntry || null, needs_refresh: needsRefresh };
}
