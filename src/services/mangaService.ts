/**
 * Manga service — D1 CRUD for manga_read + manga_cache
 * + on-demand detail fetch from AniList.
 *
 * Modeled on seriesService.ts: manga_cache holds AniList metadata (upserted on
 * add and refreshed on demand), manga_read holds the personal tracking entry.
 */

import {
  fetchAnilistMedia,
  fetchAnilistPreview,
  mapAnilistToCacheRow,
  AnilistRequestError,
  type MangaCacheRow,
} from './anilist';

export { AnilistRequestError };

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

async function upsertMangaCache(db: D1Database, row: MangaCacheRow): Promise<void> {
  await db.prepare(`
    INSERT INTO manga_cache
      (anilist_id, id_mal, title_romaji, title_english, title_native, synonyms_json,
       type, format, country, status, description, cover, cover_color, banner,
       start_date, end_date, chapters, volumes, average_score, mean_score,
       popularity, favourites, source, genres_json, is_adult, site_url, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
      updated_at=excluded.updated_at
  `).bind(
    row.anilist_id, row.id_mal, row.title_romaji, row.title_english, row.title_native, row.synonyms_json,
    row.type, row.format, row.country, row.status, row.description, row.cover, row.cover_color, row.banner,
    row.start_date, row.end_date, row.chapters, row.volumes, row.average_score, row.mean_score,
    row.popularity, row.favourites, row.source, row.genres_json, row.is_adult, row.site_url,
  ).run();
}

export async function createMangaEntry(
  db: D1Database,
  data: {
    anilist_id: number;
    estado: string;
    capitulo_actual: number;
    platform: string;
    fecha_inicio: string;
    fecha_final: string;
    rating_personal: number | null;
  }
): Promise<MangaReadRow> {
  // Cache the AniList metadata first if not already there (or stale full detail exists already).
  const cached = await db.prepare('SELECT anilist_id FROM manga_cache WHERE anilist_id = ?')
    .bind(data.anilist_id).first();
  if (!cached) {
    const media = await fetchAnilistMedia(data.anilist_id);
    const row = mapAnilistToCacheRow(media);
    await upsertMangaCache(db, row);
    // Full detail already came with the media fetch — persist it too.
    await db.prepare(`
      UPDATE manga_cache SET
        tags_json = ?, staff_json = ?, characters_json = ?, relations_json = ?,
        recommendations_json = ?, external_links_json = ?, detail_fetched_at = datetime('now')
      WHERE anilist_id = ?
    `).bind(
      row.tags_json, row.staff_json, row.characters_json, row.relations_json,
      row.recommendations_json, row.external_links_json, row.anilist_id,
    ).run();
  }

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

// ── Lookup (preview for the add modal) ──

export interface MangaLookupPreview {
  anilist_id: number;
  title: string;
  type: string;
  format: string;
  status: string;
  chapters: number | null;
  cover: string;
  already_added: boolean;
}

export async function lookupManga(db: D1Database, anilistId: number): Promise<MangaLookupPreview> {
  const preview = await fetchAnilistPreview(anilistId);
  const existing = await db.prepare('SELECT id FROM manga_read WHERE anilist_id = ?').bind(anilistId).first();
  return {
    anilist_id: preview.id,
    title: preview.title,
    type: preview.type,
    format: preview.format,
    status: preview.status,
    chapters: preview.chapters,
    cover: preview.cover,
    already_added: !!existing,
  };
}

// ── Detail ──

export interface MangaDetail extends MangaCacheRow {
  read_entry: MangaReadRow | null;
}

const RELEASING_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * On-demand detail: fetches full AniList data if never fetched, or if the
 * title is still RELEASING and the cached detail is older than 7 days (so the
 * chapter count stays fresh without a cron job).
 */
export async function getMangaDetail(db: D1Database, anilistId: number): Promise<MangaDetail | null> {
  let row = await db.prepare('SELECT * FROM manga_cache WHERE anilist_id = ?')
    .bind(anilistId).first<Record<string, unknown>>();
  if (!row) return null;

  const fetchedAt = row.detail_fetched_at as string | null;
  const isStaleReleasing = row.status === 'RELEASING' && fetchedAt &&
    (Date.now() - new Date(fetchedAt + 'Z').getTime()) > RELEASING_STALE_MS;

  if (!fetchedAt || isStaleReleasing) {
    try {
      const media = await fetchAnilistMedia(anilistId);
      const mapped = mapAnilistToCacheRow(media);
      await db.prepare(`
        UPDATE manga_cache SET
          id_mal = ?, title_romaji = ?, title_english = ?, title_native = ?, synonyms_json = ?,
          type = ?, format = ?, country = ?, status = ?, description = ?, cover = ?, cover_color = ?,
          banner = ?, start_date = ?, end_date = ?, chapters = ?, volumes = ?, average_score = ?,
          mean_score = ?, popularity = ?, favourites = ?, source = ?, genres_json = ?, is_adult = ?,
          site_url = ?, tags_json = ?, staff_json = ?, characters_json = ?, relations_json = ?,
          recommendations_json = ?, external_links_json = ?, detail_fetched_at = datetime('now'),
          updated_at = datetime('now')
        WHERE anilist_id = ?
      `).bind(
        mapped.id_mal, mapped.title_romaji, mapped.title_english, mapped.title_native, mapped.synonyms_json,
        mapped.type, mapped.format, mapped.country, mapped.status, mapped.description, mapped.cover, mapped.cover_color,
        mapped.banner, mapped.start_date, mapped.end_date, mapped.chapters, mapped.volumes, mapped.average_score,
        mapped.mean_score, mapped.popularity, mapped.favourites, mapped.source, mapped.genres_json, mapped.is_adult,
        mapped.site_url, mapped.tags_json, mapped.staff_json, mapped.characters_json, mapped.relations_json,
        mapped.recommendations_json, mapped.external_links_json, anilistId,
      ).run();

      row = await db.prepare('SELECT * FROM manga_cache WHERE anilist_id = ?').bind(anilistId).first<Record<string, unknown>>();
    } catch (e) {
      // Stale cache is still useful; only bubble the error up when there's nothing to show at all.
      console.error(`[manga] getMangaDetail refresh for ${anilistId} failed:`, e);
      if (!fetchedAt) throw e;
    }
  }

  const readEntry = await db.prepare('SELECT * FROM manga_read WHERE anilist_id = ?')
    .bind(anilistId).first<MangaReadRow>();

  return { ...(row as unknown as MangaCacheRow), read_entry: readEntry || null };
}
