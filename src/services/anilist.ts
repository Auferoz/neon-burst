/**
 * AniList provider — public GraphQL API (https://graphql.anilist.co).
 * No auth needed for reads, so no Client ID/Secret are used here.
 *
 * AniList's firewall answers 403 to every request coming from a Cloudflare
 * Workers egress IP (confirmed on their forum; a custom User-Agent did not
 * change that — see CHANGELOG 1.11.1). A normal IP works fine, and AniList
 * supports CORS for browser calls, so the fetch functions below are meant to
 * run in the browser (from Vue components), not on the server. The server
 * only validates and stores what the browser already fetched — see
 * `validateAnilistMediaPayload` and `mangaService.ts`.
 *
 * This module is split on purpose:
 *   - Pure functions (parseAnilistQuery, countryToType, mapAnilistToCacheRow,
 *     validateAnilistMediaPayload) have no side effects and no
 *     `cloudflare:workers` import, so Vitest can import them directly in
 *     plain Node, and the Worker can safely validate payloads with them.
 *   - fetchAnilistPreview / fetchAnilistMedia use global `fetch` (available
 *     in the browser and in Node 22+ for tests), and no Node/Worker-only API,
 *     so this file is safely importable from a Vue component.
 */

const ANILIST_API_URL = 'https://graphql.anilist.co';

export type MangaType = 'Manga' | 'Manhwa' | 'Manhua';

/**
 * Accepts an AniList manga URL (with or without slug) or a bare numeric id.
 * Anything else (empty, garbage, a URL from another site) returns null.
 */
export function parseAnilistQuery(input: string): number | null {
  const raw = (input || '').trim();
  if (!raw) return null;

  const urlMatch = raw.match(/anilist\.co\/manga\/(\d+)/i);
  if (urlMatch) return Number(urlMatch[1]);

  if (/^\d+$/.test(raw)) return Number(raw);

  return null;
}

/** countryOfOrigin → type. JP → Manga, KR → Manhwa, CN/TW → Manhua, else Manga. */
export function countryToType(country?: string | null): MangaType {
  switch ((country || '').toUpperCase()) {
    case 'KR':
      return 'Manhwa';
    case 'CN':
    case 'TW':
      return 'Manhua';
    default:
      return 'Manga';
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

interface FuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

/** Stores what AniList actually gave us: DD/MM/YYYY, MM/YYYY, YYYY, or '' if unknown. */
function formatFuzzyDate(d?: FuzzyDate | null): string {
  if (!d || !d.year) return '';
  if (d.day && d.month) return `${pad(d.day)}/${pad(d.month)}/${d.year}`;
  if (d.month) return `${pad(d.month)}/${d.year}`;
  return String(d.year);
}

/** AniList descriptions come as limited HTML (mostly <br>, <i>, <b>); flatten to plain text. */
function stripAnilistHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(i|b|strong|em)>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

// ── AniList GraphQL response types (subset actually used) ──

export interface AnilistTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

export interface AnilistTag {
  name: string;
  rank: number;
  isMediaSpoiler: boolean;
  isGeneralSpoiler: boolean;
}

export interface AnilistStaffEdge {
  role: string;
  node: { id: number; name: { full: string }; image?: { medium?: string | null } | null };
}

export interface AnilistCharacterEdge {
  role: string;
  node: { id: number; name: { full: string }; image?: { large?: string | null } | null };
}

export interface AnilistRelationEdge {
  relationType: string;
  node: {
    id: number;
    type: string;
    format?: string | null;
    title: AnilistTitle;
    coverImage?: { large?: string | null } | null;
    siteUrl?: string | null;
  };
}

export interface AnilistRecommendationNode {
  mediaRecommendation: {
    id: number;
    type: string;
    format?: string | null;
    countryOfOrigin?: string | null;
    title: AnilistTitle;
    coverImage?: { large?: string | null } | null;
  } | null;
}

export interface AnilistExternalLink {
  url: string;
  site: string;
  type?: string | null;
  language?: string | null;
}

export interface AnilistMediaResponse {
  id: number;
  idMal?: number | null;
  type: string;
  format?: string | null;
  countryOfOrigin?: string | null;
  status?: string | null;
  title: AnilistTitle;
  synonyms?: string[] | null;
  description?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null; color?: string | null } | null;
  bannerImage?: string | null;
  startDate?: FuzzyDate | null;
  endDate?: FuzzyDate | null;
  chapters?: number | null;
  volumes?: number | null;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  source?: string | null;
  genres?: string[] | null;
  isAdult?: boolean | null;
  siteUrl?: string | null;
  tags?: AnilistTag[] | null;
  staff?: { edges: AnilistStaffEdge[] } | null;
  characters?: { edges: AnilistCharacterEdge[] } | null;
  relations?: { edges: AnilistRelationEdge[] } | null;
  recommendations?: { nodes: AnilistRecommendationNode[] } | null;
  externalLinks?: AnilistExternalLink[] | null;
}

/** Flat shape matching the manga_cache row. */
export interface MangaCacheRow {
  anilist_id: number;
  id_mal: number | null;
  title_romaji: string;
  title_english: string;
  title_native: string;
  synonyms_json: string;
  type: MangaType;
  format: string;
  country: string;
  status: string;
  description: string;
  cover: string;
  cover_color: string;
  banner: string;
  start_date: string;
  end_date: string;
  chapters: number | null;
  volumes: number | null;
  average_score: number | null;
  mean_score: number | null;
  popularity: number | null;
  favourites: number | null;
  source: string;
  genres_json: string;
  is_adult: number;
  site_url: string;
  tags_json: string;
  staff_json: string;
  characters_json: string;
  relations_json: string;
  recommendations_json: string;
  external_links_json: string;
}

/** Maps the AniList Media response into the flat manga_cache row shape. */
export function mapAnilistToCacheRow(media: AnilistMediaResponse): MangaCacheRow {
  const staff = (media.staff?.edges || []).map(e => ({
    role: e.role,
    name: e.node.name.full,
    image: e.node.image?.medium || '',
    id: e.node.id,
  }));

  const characters = (media.characters?.edges || []).map(e => ({
    role: e.role,
    name: e.node.name.full,
    image: e.node.image?.large || '',
    id: e.node.id,
  }));

  const relations = (media.relations?.edges || []).map(e => ({
    relation_type: e.relationType,
    id: e.node.id,
    type: e.node.type,
    format: e.node.format || '',
    title: e.node.title.english || e.node.title.romaji || '',
    cover: e.node.coverImage?.large || '',
    site_url: e.node.siteUrl || '',
  }));

  const recommendations = (media.recommendations?.nodes || [])
    .map(n => n.mediaRecommendation)
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map(r => ({
      id: r.id,
      type: r.type,
      format: r.format || '',
      country: r.countryOfOrigin || '',
      title: r.title.english || r.title.romaji || '',
      cover: r.coverImage?.large || '',
    }));

  const externalLinks = (media.externalLinks || []).map(l => ({
    url: l.url,
    site: l.site,
    type: l.type || '',
    language: l.language || '',
  }));

  return {
    anilist_id: media.id,
    id_mal: media.idMal ?? null,
    title_romaji: media.title.romaji || '',
    title_english: media.title.english || '',
    title_native: media.title.native || '',
    synonyms_json: JSON.stringify(media.synonyms || []),
    type: countryToType(media.countryOfOrigin),
    format: media.format || '',
    country: media.countryOfOrigin || '',
    status: media.status || '',
    description: stripAnilistHtml(media.description),
    cover: media.coverImage?.extraLarge || media.coverImage?.large || '',
    cover_color: media.coverImage?.color || '',
    banner: media.bannerImage || '',
    start_date: formatFuzzyDate(media.startDate),
    end_date: formatFuzzyDate(media.endDate),
    chapters: media.chapters ?? null,
    volumes: media.volumes ?? null,
    average_score: media.averageScore ?? null,
    mean_score: media.meanScore ?? null,
    popularity: media.popularity ?? null,
    favourites: media.favourites ?? null,
    source: media.source || '',
    genres_json: JSON.stringify(media.genres || []),
    is_adult: media.isAdult ? 1 : 0,
    site_url: media.siteUrl || '',
    tags_json: JSON.stringify(media.tags || []),
    staff_json: JSON.stringify(staff),
    characters_json: JSON.stringify(characters),
    relations_json: JSON.stringify(relations),
    recommendations_json: JSON.stringify(recommendations),
    external_links_json: JSON.stringify(externalLinks),
  };
}

/** Typed error so callers can surface a 502, like TraktRequestError in seriesSync.ts. */
export class AnilistRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AnilistRequestError';
  }
}

async function anilistFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    throw new AnilistRequestError(0, `No se pudo conectar con AniList: ${(e as Error).message}`);
  }

  if (res.status === 404) {
    throw new AnilistRequestError(404, 'No se encontró el manga en AniList');
  }

  if (res.status === 429) {
    throw new AnilistRequestError(502, 'AniList está limitando las peticiones (429). Probá de nuevo en un momento.');
  }

  if (!res.ok) {
    throw new AnilistRequestError(502, `Error de la API de AniList (${res.status})`);
  }

  const body = await res.json() as { data?: T; errors?: Array<{ message: string; status?: number }> };
  if (body.errors?.length) {
    const first = body.errors[0]!;
    if (first.status === 404) throw new AnilistRequestError(404, 'No se encontró el manga en AniList');
    throw new AnilistRequestError(502, `AniList: ${first.message}`);
  }
  if (!body.data) {
    throw new AnilistRequestError(502, 'AniList no devolvió datos');
  }
  return body.data;
}

const PREVIEW_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: MANGA) {
      id
      countryOfOrigin
      status
      format
      chapters
      title { romaji english native }
      coverImage { large color }
    }
  }
`;

export interface AnilistPreview {
  id: number;
  type: MangaType;
  status: string;
  format: string;
  chapters: number | null;
  title: string;
  cover: string;
}

/** Light query for the "add" modal preview. */
export async function fetchAnilistPreview(id: number): Promise<AnilistPreview> {
  const data = await anilistFetch<{ Media: AnilistMediaResponse }>(PREVIEW_QUERY, { id });
  const m = data.Media;
  return {
    id: m.id,
    type: countryToType(m.countryOfOrigin),
    status: m.status || '',
    format: m.format || '',
    chapters: m.chapters ?? null,
    title: m.title.english || m.title.romaji || m.title.native || '',
    cover: m.coverImage?.large || '',
  };
}

const FULL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: MANGA) {
      id
      idMal
      type
      format
      countryOfOrigin
      status
      title { romaji english native }
      synonyms
      description(asHtml: false)
      coverImage { extraLarge large color }
      bannerImage
      startDate { year month day }
      endDate { year month day }
      chapters
      volumes
      averageScore
      meanScore
      popularity
      favourites
      source
      genres
      isAdult
      siteUrl
      tags { name rank isMediaSpoiler isGeneralSpoiler }
      staff(perPage: 8, sort: [RELEVANCE]) {
        edges { role node { id name { full } image { medium } } }
      }
      characters(perPage: 12, sort: [ROLE, RELEVANCE, ID]) {
        edges { role node { id name { full } image { large } } }
      }
      relations {
        edges {
          relationType
          node { id type format title { romaji english } coverImage { large } siteUrl }
        }
      }
      recommendations(perPage: 8, sort: [RATING_DESC]) {
        nodes {
          mediaRecommendation {
            id type format countryOfOrigin title { romaji english } coverImage { large }
          }
        }
      }
      externalLinks { url site type language }
    }
  }
`;

/** Full query used for the manga_cache row, with characters/staff/relations/recommendations/links. */
export async function fetchAnilistMedia(id: number): Promise<AnilistMediaResponse> {
  const data = await anilistFetch<{ Media: AnilistMediaResponse }>(FULL_QUERY, { id });
  return data.Media;
}

export type AnilistValidationResult =
  | { ok: true; media: AnilistMediaResponse }
  | { ok: false; error: string };

// AniList's full Media response is a few KB; anything past this is either a
// mistake or an attempt to stuff the server with garbage — reject it outright.
const MAX_MEDIA_PAYLOAD_CHARS = 500_000;

/**
 * Guards the shape of a `media` payload the browser POSTs after fetching it
 * from AniList directly (the server can't fetch AniList itself — see the
 * module comment above). Never trust it further than this: it must be a
 * plain object, its `id` must match what the caller expects, it must be a
 * MANGA, and it must carry at least a romaji title.
 */
export function validateAnilistMediaPayload(media: unknown, expectedId: number): AnilistValidationResult {
  if (media === null || typeof media !== 'object' || Array.isArray(media)) {
    return { ok: false, error: 'Datos de AniList inválidos' };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(media);
  } catch {
    return { ok: false, error: 'Datos de AniList inválidos' };
  }
  if (serialized.length > MAX_MEDIA_PAYLOAD_CHARS) {
    return { ok: false, error: 'Datos de AniList demasiado grandes' };
  }

  const m = media as Record<string, unknown>;

  if (m.id !== expectedId) {
    return { ok: false, error: 'El id de AniList no coincide' };
  }

  if (m.type !== 'MANGA') {
    return { ok: false, error: 'El contenido de AniList no es un manga' };
  }

  const title = m.title as Record<string, unknown> | null | undefined;
  if (!title || typeof title !== 'object' || typeof title.romaji !== 'string' || !title.romaji) {
    return { ok: false, error: 'Datos de AniList incompletos (falta el título)' };
  }

  return { ok: true, media: media as AnilistMediaResponse };
}
