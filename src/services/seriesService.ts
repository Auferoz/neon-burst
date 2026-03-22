/**
 * Series service — D1 CRUD for series_watched + series_cache
 */

export interface SeriesWatchedRow {
  id: number;
  trakt_slug: string;
  season_number: number;
  year_watched: number;
  platform: string;
  status_viewed: string;
  created_at: string;
  updated_at: string;
}

export interface SeriesCacheRow {
  trakt_slug: string;
  trakt_id: number;
  tmdb_id: number;
  imdb_id: string;
  title: string;
  year: number;
  overview: string;
  rating: number;
  genres: string;
  network: string;
  status: string;
  runtime: number;
  poster: string;
}

export interface SeriesEntry extends SeriesWatchedRow {
  title: string;
  year: number;
  overview: string;
  rating: number;
  genres: string;
  network: string;
  status: string;
  runtime: number;
  poster: string;
  tmdb_id: number;
  imdb_id: string;
}

export async function getAllSeries(db: D1Database): Promise<SeriesEntry[]> {
  const { results } = await db.prepare(`
    SELECT w.*, c.title, c.year, c.overview, c.rating, c.genres, c.network,
           c.status, c.runtime, c.poster, c.tmdb_id, c.imdb_id
    FROM series_watched w
    LEFT JOIN series_cache c ON w.trakt_slug = c.trakt_slug
    ORDER BY w.year_watched DESC, w.created_at DESC
  `).all<SeriesEntry>();

  return results;
}

export async function createSeriesEntry(
  db: D1Database,
  data: { trakt_slug: string; season_number: number; year_watched: number; platform: string; status_viewed: string }
): Promise<SeriesWatchedRow> {
  const result = await db.prepare(
    `INSERT INTO series_watched (trakt_slug, season_number, year_watched, platform, status_viewed)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    data.trakt_slug, data.season_number, data.year_watched,
    data.platform || '', data.status_viewed || 'completed'
  ).run();

  const id = result.meta.last_row_id as number;
  return (await db.prepare('SELECT * FROM series_watched WHERE id = ?').bind(id).first<SeriesWatchedRow>())!;
}

export async function updateSeriesEntry(
  db: D1Database,
  id: number,
  data: Partial<{ trakt_slug: string; season_number: number; year_watched: number; platform: string; status_viewed: string }>
): Promise<SeriesWatchedRow | null> {
  const allowedColumns = new Set(['trakt_slug', 'season_number', 'year_watched', 'platform', 'status_viewed']);
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

  await db.prepare(
    `UPDATE series_watched SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return db.prepare('SELECT * FROM series_watched WHERE id = ?').bind(id).first<SeriesWatchedRow>();
}

export async function deleteSeriesEntry(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM series_watched WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}
