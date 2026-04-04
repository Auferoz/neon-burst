/**
 * Series service — D1 CRUD for series_watched + series_cache
 * + on-demand detail fetch from Trakt/TMDB
 */

import { env } from 'cloudflare:workers';

const TRAKT_API_URL = 'https://api.trakt.tv';

function getTraktHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'trakt-api-key': env.TRAKT_CLIENT_ID,
    'trakt-api-version': '2',
    'User-Agent': 'neon-burst/1.0',
  };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function traktImage(url?: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://${url}`;
}

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
  thumb: string;
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
  thumb: string;
  tmdb_id: number;
  imdb_id: string;
}

export async function getAllSeries(db: D1Database): Promise<SeriesEntry[]> {
  const { results } = await db.prepare(`
    SELECT w.*, c.title, c.year, c.overview, c.rating, c.genres, c.network,
           c.status, c.runtime, c.poster, c.thumb, c.tmdb_id, c.imdb_id
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

// ── Detail interfaces ──

export interface CastMember {
  name: string;
  character: string;
  headshot: string;
  episode_count: number;
  tmdb_id: number | null;
}

export interface Video {
  name: string;
  key: string;
  type: string;
  site: string;
}

export interface SeasonEpisode {
  number: number;
  title: string;
  overview: string;
  rating: number;
  runtime: number;
  first_aired: string;
  screenshot: string;
  episode_type: string;
}

export interface Season {
  number: number;
  title: string;
  episode_count: number;
  aired_episodes: number;
  rating: number;
  overview: string;
  episodes: SeasonEpisode[];
}

export interface SeriesImages {
  poster: string[];
  fanart: string[];
  thumb: string[];
  banner: string[];
  logo: string[];
  clearart: string[];
}

export interface SeriesDetail {
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
  thumb: string;
  tagline: string;
  certification: string;
  country: string;
  language: string;
  trailer: string;
  fanart: string;
  logo: string;
  airs_day: string;
  airs_time: string;
  airs_timezone: string;
  first_aired: string;
  aired_episodes: number;
  cast: CastMember[];
  videos: Video[];
  images: SeriesImages;
  seasons: Season[];
  watched_entries: SeriesWatchedRow[];
  votes: number;
}

// ── Trakt API types ──

interface TraktShowFull {
  title: string;
  year: number;
  ids: { trakt: number; slug: string; imdb: string; tmdb: number };
  tagline: string;
  overview: string;
  first_aired: string;
  runtime: number;
  certification: string;
  network: string;
  country: string;
  language: string;
  trailer: string;
  status: string;
  rating: number;
  votes: number;
  genres: string[];
  aired_episodes: number;
  airs: { day: string; time: string; timezone: string };
  images?: {
    poster?: string[];
    fanart?: string[];
    thumb?: string[];
    banner?: string[];
    logo?: string[];
    clearart?: string[];
  };
}

interface TraktPerson {
  character: string;
  characters: string[];
  episode_count: number;
  person: {
    name: string;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    images?: { headshot?: string[] };
  };
}

interface TraktSeason {
  number: number;
  title: string;
  episode_count: number;
  aired_episodes: number;
  rating: number;
  overview: string;
  episodes?: Array<{
    number: number;
    title: string;
    overview: string;
    rating: number;
    runtime: number;
    first_aired: string;
    episode_type: string;
    images?: { screenshot?: string[] };
  }>;
}

// ── Detail fetch functions ──

async function fetchTraktShow(slug: string): Promise<TraktShowFull | null> {
  try {
    const res = await fetch(`${TRAKT_API_URL}/shows/${slug}?extended=full`, {
      headers: getTraktHeaders(),
    });
    if (!res.ok) {
      console.error(`[series] fetchTraktShow ${slug} failed: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json() as TraktShowFull;
  } catch (e) {
    console.error(`[series] fetchTraktShow ${slug} error:`, e);
    return null;
  }
}

async function fetchTraktShowPeople(slug: string): Promise<CastMember[]> {
  try {
    const res = await fetch(`${TRAKT_API_URL}/shows/${slug}/people?extended=full`, {
      headers: getTraktHeaders(),
    });
    if (!res.ok) {
      console.error(`[series] fetchTraktShowPeople ${slug} failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json() as { cast?: TraktPerson[] };
    return (data.cast || []).slice(0, 20).map(p => ({
      name: p.person.name,
      character: p.characters?.[0] || p.character || '',
      headshot: traktImage(p.person.images?.headshot?.[0]),
      episode_count: p.episode_count || 0,
      tmdb_id: p.person.ids?.tmdb || null,
    }));
  } catch (e) {
    console.error(`[series] fetchTraktShowPeople ${slug} error:`, e);
    return [];
  }
}

async function fetchTraktSeasons(slug: string): Promise<Season[]> {
  try {
    const res = await fetch(`${TRAKT_API_URL}/shows/${slug}/seasons?extended=full,episodes`, {
      headers: getTraktHeaders(),
    });
    if (!res.ok) {
      console.error(`[series] fetchTraktSeasons ${slug} failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json() as TraktSeason[];
    return data
      .filter(s => s.number > 0) // Exclude specials (season 0)
      .map(s => ({
        number: s.number,
        title: s.title || `Temporada ${s.number}`,
        episode_count: s.episode_count || 0,
        aired_episodes: s.aired_episodes || 0,
        rating: Math.round((s.rating || 0) * 10) / 10,
        overview: s.overview || '',
        episodes: (s.episodes || []).map(e => ({
          number: e.number,
          title: e.title || '',
          overview: e.overview || '',
          rating: Math.round((e.rating || 0) * 10) / 10,
          runtime: e.runtime || 0,
          first_aired: e.first_aired || '',
          screenshot: traktImage(e.images?.screenshot?.[0]),
          episode_type: e.episode_type || 'standard',
        })),
      }));
  } catch (e) {
    console.error(`[series] fetchTraktSeasons ${slug} error:`, e);
    return [];
  }
}

async function fetchTmdbTvVideos(tmdbId: number): Promise<Video[]> {
  if (!tmdbId || !env.TMDB_API_KEY) return [];
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${env.TMDB_API_KEY}`);
    if (!res.ok) {
      console.error(`[series] fetchTmdbTvVideos ${tmdbId} failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json() as { results: Array<{ name: string; key: string; type: string; site: string }> };
    return (data.results || [])
      .filter(v => v.site === 'YouTube')
      .slice(0, 10)
      .map(v => ({ name: v.name, key: v.key, type: v.type, site: v.site }));
  } catch (e) {
    console.error(`[series] fetchTmdbTvVideos ${tmdbId} error:`, e);
    return [];
  }
}

// ── Main detail function ──

export async function getSeriesDetail(db: D1Database, slug: string): Promise<SeriesDetail | null> {
  const row = await db.prepare('SELECT * FROM series_cache WHERE trakt_slug = ?').bind(slug).first<Record<string, unknown>>();
  if (!row) return null;

  // On-demand detail fetch (or re-fetch if stale/empty)
  const needsFetch = !row.detail_fetched_at || (
    row.cast_json === '[]' && row.seasons_json === '[]' && row.detail_fetched_at
  );
  if (needsFetch) {
    await fetchSeriesDetail(db, slug, row.tmdb_id as number);
    const updated = await db.prepare('SELECT * FROM series_cache WHERE trakt_slug = ?').bind(slug).first<Record<string, unknown>>();
    if (updated) return rowToSeriesDetail(db, updated);
  }

  return rowToSeriesDetail(db, row);
}

async function rowToSeriesDetail(db: D1Database, row: Record<string, unknown>): Promise<SeriesDetail> {
  let cast: CastMember[] = [];
  let videos: Video[] = [];
  let images: SeriesImages = { poster: [], fanart: [], thumb: [], banner: [], logo: [], clearart: [] };
  let seasons: Season[] = [];

  try { cast = JSON.parse((row.cast_json as string) || '[]'); } catch { /* */ }
  try { videos = JSON.parse((row.videos_json as string) || '[]'); } catch { /* */ }
  try { images = JSON.parse((row.images_json as string) || '{}'); } catch { /* */ }
  try { seasons = JSON.parse((row.seasons_json as string) || '[]'); } catch { /* */ }

  // Fetch watched entries
  const { results: watched } = await db.prepare(
    'SELECT * FROM series_watched WHERE trakt_slug = ? ORDER BY season_number ASC'
  ).bind(row.trakt_slug as string).all<SeriesWatchedRow>();

  let trailer = (row.trailer as string) || '';
  // If trailer is a full YouTube URL, extract the ID
  if (trailer && trailer.includes('youtube')) {
    const match = trailer.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    trailer = match?.[1] || trailer;
  }

  return {
    trakt_slug: (row.trakt_slug as string) || '',
    trakt_id: row.trakt_id as number,
    tmdb_id: row.tmdb_id as number,
    imdb_id: (row.imdb_id as string) || '',
    title: (row.title as string) || '',
    year: row.year as number,
    overview: (row.overview as string) || '',
    rating: (row.rating as number) || 0,
    genres: (row.genres as string) || '',
    network: (row.network as string) || '',
    status: (row.status as string) || '',
    runtime: (row.runtime as number) || 0,
    poster: (row.poster as string) || '',
    thumb: (row.thumb as string) || '',
    tagline: (row.tagline as string) || '',
    certification: (row.certification as string) || '',
    country: (row.country as string) || '',
    language: (row.language as string) || '',
    trailer,
    fanart: (row.fanart as string) || '',
    logo: (row.logo as string) || '',
    airs_day: (row.airs_day as string) || '',
    airs_time: (row.airs_time as string) || '',
    airs_timezone: (row.airs_timezone as string) || '',
    first_aired: (row.first_aired as string) || '',
    aired_episodes: (row.aired_episodes as number) || 0,
    cast,
    videos,
    images,
    seasons,
    watched_entries: watched,
    votes: (row.votes as number) || 0,
  };
}

async function fetchSeriesDetail(db: D1Database, slug: string, tmdbId: number): Promise<void> {
  // 1. Fetch full Trakt show data
  const show = await fetchTraktShow(slug);
  if (!show) return;
  await sleep(300);

  // 2. Fetch cast
  const cast = await fetchTraktShowPeople(slug);
  await sleep(300);

  // 3. Fetch seasons + episodes
  const seasons = await fetchTraktSeasons(slug);
  await sleep(300);

  // 4. Fetch TMDB videos
  const videos = await fetchTmdbTvVideos(tmdbId);

  // Extract images
  const images: SeriesImages = {
    poster: (show.images?.poster || []).map(traktImage),
    fanart: (show.images?.fanart || []).map(traktImage),
    thumb: (show.images?.thumb || []).map(traktImage),
    banner: (show.images?.banner || []).map(traktImage),
    logo: (show.images?.logo || []).map(traktImage),
    clearart: (show.images?.clearart || []).map(traktImage),
  };

  const fanart = images.fanart[0] || '';
  const logo = images.logo[0] || '';

  let trailer = '';
  if (show.trailer) {
    const match = show.trailer.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    trailer = match?.[1] || '';
  }

  await db.prepare(`
    UPDATE series_cache SET
      tagline = ?, certification = ?, country = ?, language = ?,
      trailer = ?, fanart = ?, logo = ?,
      airs_day = ?, airs_time = ?, airs_timezone = ?,
      first_aired = ?, aired_episodes = ?,
      cast_json = ?, videos_json = ?, images_json = ?, seasons_json = ?,
      votes = ?, detail_fetched_at = datetime('now')
    WHERE trakt_slug = ?
  `).bind(
    show.tagline || '', show.certification || '', show.country || '', show.language || '',
    trailer, fanart, logo,
    show.airs?.day || '', show.airs?.time || '', show.airs?.timezone || '',
    show.first_aired || '', show.aired_episodes || 0,
    JSON.stringify(cast), JSON.stringify(videos), JSON.stringify(images), JSON.stringify(seasons),
    show.votes || 0, slug,
  ).run();
}
