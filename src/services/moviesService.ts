/**
 * Movies service — D1 CRUD + on-demand detail fetch from Trakt/TMDB
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

// ── Interfaces ──

export interface CastMember {
  name: string;
  character: string;
  headshot: string;
  tmdb_id: number | null;
}

export interface Video {
  name: string;
  key: string;
  type: string;
  site: string;
}

export interface MovieImages {
  poster: string[];
  fanart: string[];
  thumb: string[];
  banner: string[];
  logo: string[];
  clearart: string[];
}

export interface MovieDetail {
  trakt_id: number;
  tmdb_id: number;
  imdb_id: string;
  title: string;
  year: number;
  released: string;
  runtime: number;
  genres: string;
  overview: string;
  rating: number;
  poster: string;
  thumb: string;
  tagline: string;
  certification: string;
  country: string;
  language: string;
  trailer: string;
  homepage: string;
  fanart: string;
  logo: string;
  cast: CastMember[];
  videos: Video[];
  images: MovieImages;
  after_credits: boolean;
  during_credits: boolean;
  votes: number;
  list_slug: string;
  listed_at: string;
}

// ── Trakt API fetchers ──

interface TraktMovieFull {
  title: string;
  year: number;
  ids: { trakt: number; slug: string; imdb: string; tmdb: number };
  tagline: string;
  overview: string;
  released: string;
  runtime: number;
  certification: string;
  country: string;
  language: string;
  trailer: string;
  homepage: string;
  rating: number;
  votes: number;
  genres: string[];
  after_credits: boolean;
  during_credits: boolean;
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
  person: {
    name: string;
    ids: { trakt: number; slug: string; imdb: string; tmdb: number };
    images?: { headshot?: string[] };
  };
}

async function fetchTraktMovie(slugOrId: string | number): Promise<TraktMovieFull | null> {
  try {
    const res = await fetch(`${TRAKT_API_URL}/movies/${slugOrId}?extended=full`, {
      headers: getTraktHeaders(),
    });
    if (!res.ok) {
      console.error(`[movies] fetchTraktMovie ${slugOrId} failed: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json() as TraktMovieFull;
  } catch (e) {
    console.error(`[movies] fetchTraktMovie ${slugOrId} error:`, e);
    return null;
  }
}

async function fetchTraktMoviePeople(slugOrId: string | number): Promise<CastMember[]> {
  try {
    const res = await fetch(`${TRAKT_API_URL}/movies/${slugOrId}/people?extended=full`, {
      headers: getTraktHeaders(),
    });
    if (!res.ok) {
      console.error(`[movies] fetchTraktMoviePeople ${slugOrId} failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json() as { cast?: TraktPerson[] };
    return (data.cast || []).slice(0, 20).map(p => ({
      name: p.person.name,
      character: p.characters?.[0] || p.character || '',
      headshot: traktImage(p.person.images?.headshot?.[0]),
      tmdb_id: p.person.ids?.tmdb || null,
    }));
  } catch (e) {
    console.error(`[movies] fetchTraktMoviePeople ${slugOrId} error:`, e);
    return [];
  }
}

async function fetchTmdbVideos(tmdbId: number): Promise<Video[]> {
  if (!tmdbId || !env.TMDB_API_KEY) return [];
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${env.TMDB_API_KEY}`);
    if (!res.ok) {
      console.error(`[movies] fetchTmdbVideos ${tmdbId} failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json() as { results: Array<{ name: string; key: string; type: string; site: string }> };
    return (data.results || [])
      .filter(v => v.site === 'YouTube')
      .slice(0, 10)
      .map(v => ({ name: v.name, key: v.key, type: v.type, site: v.site }));
  } catch (e) {
    console.error(`[movies] fetchTmdbVideos ${tmdbId} error:`, e);
    return [];
  }
}

// ── Main service functions ──

export async function getMovieById(db: D1Database, traktId: number): Promise<MovieDetail | null> {
  const row = await db.prepare('SELECT * FROM movies_cache WHERE trakt_id = ?').bind(traktId).first<Record<string, unknown>>();
  if (!row) return null;

  // On-demand detail fetch (or re-fetch if stale/empty)
  const needsFetch = !row.detail_fetched_at || (
    row.cast_json === '[]' && row.detail_fetched_at
  );
  if (needsFetch) {
    await fetchMovieDetail(db, traktId, row.tmdb_id as number);
    const updated = await db.prepare('SELECT * FROM movies_cache WHERE trakt_id = ?').bind(traktId).first<Record<string, unknown>>();
    if (updated) return rowToMovieDetail(updated);
  }

  return rowToMovieDetail(row);
}

function rowToMovieDetail(row: Record<string, unknown>): MovieDetail {
  let cast: CastMember[] = [];
  let videos: Video[] = [];
  let images: MovieImages = { poster: [], fanart: [], thumb: [], banner: [], logo: [], clearart: [] };

  try { cast = JSON.parse((row.cast_json as string) || '[]'); } catch { /* */ }
  try { videos = JSON.parse((row.videos_json as string) || '[]'); } catch { /* */ }
  try { images = JSON.parse((row.images_json as string) || '{}'); } catch { /* */ }

  return {
    trakt_id: row.trakt_id as number,
    tmdb_id: row.tmdb_id as number,
    imdb_id: (row.imdb_id as string) || '',
    title: (row.title as string) || '',
    year: row.year as number,
    released: (row.released as string) || '',
    runtime: (row.runtime as number) || 0,
    genres: (row.genres as string) || '',
    overview: (row.overview as string) || '',
    rating: (row.rating as number) || 0,
    poster: (row.poster as string) || '',
    thumb: (row.thumb as string) || '',
    tagline: (row.tagline as string) || '',
    certification: (row.certification as string) || '',
    country: (row.country as string) || '',
    language: (row.language as string) || '',
    trailer: (row.trailer as string) || '',
    homepage: (row.homepage as string) || '',
    fanart: (row.fanart as string) || '',
    logo: (row.logo as string) || '',
    cast,
    videos,
    images,
    after_credits: !!(row.after_credits as number),
    during_credits: !!(row.during_credits as number),
    votes: (row.votes as number) || 0,
    list_slug: (row.list_slug as string) || '',
    listed_at: (row.listed_at as string) || '',
  };
}

async function fetchMovieDetail(db: D1Database, traktId: number, tmdbId: number): Promise<void> {
  // 1. Fetch full Trakt movie data
  const movie = await fetchTraktMovie(traktId);
  if (!movie) return;
  await sleep(300);

  // 2. Fetch cast
  const cast = await fetchTraktMoviePeople(movie.ids.slug);
  await sleep(300);

  // 3. Fetch TMDB videos
  const videos = await fetchTmdbVideos(tmdbId);

  // Extract images
  const images: MovieImages = {
    poster: (movie.images?.poster || []).map(traktImage),
    fanart: (movie.images?.fanart || []).map(traktImage),
    thumb: (movie.images?.thumb || []).map(traktImage),
    banner: (movie.images?.banner || []).map(traktImage),
    logo: (movie.images?.logo || []).map(traktImage),
    clearart: (movie.images?.clearart || []).map(traktImage),
  };

  const fanart = images.fanart[0] || '';
  const logo = images.logo[0] || '';

  // Extract trailer YouTube ID from URL
  let trailer = '';
  if (movie.trailer) {
    const match = movie.trailer.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    trailer = match?.[1] || '';
  }

  try {
    await db.prepare(`
      UPDATE movies_cache SET
        tagline = ?, certification = ?, country = ?, language = ?,
        trailer = ?, homepage = ?, fanart = ?, logo = ?,
        cast_json = ?, videos_json = ?, images_json = ?,
        after_credits = ?, during_credits = ?, votes = ?,
        detail_fetched_at = datetime('now')
      WHERE trakt_id = ?
    `).bind(
      movie.tagline || '', movie.certification || '', movie.country || '', movie.language || '',
      trailer, movie.homepage || '', fanart, logo,
      JSON.stringify(cast), JSON.stringify(videos), JSON.stringify(images),
      movie.after_credits ? 1 : 0, movie.during_credits ? 1 : 0, movie.votes || 0,
      traktId,
    ).run();
  } catch (e) {
    console.error(`[movies] fetchMovieDetail DB update for ${traktId} failed:`, e);
  }
}
