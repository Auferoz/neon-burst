import { describe, it, expect } from 'vitest';
import {
  normalizeSearchQuery,
  toLikePattern,
  toPrefixPattern,
  mapGameRow,
  mapLibraryRow,
  mapSteamRow,
  mapMovieRow,
  mapSeriesRow,
  mapMangaRow,
  groupResults,
  SEARCH_SECTIONS,
  type SearchResult,
} from '../src/utils/search';

describe('normalizeSearchQuery', () => {
  it('returns null for an empty string', () => {
    expect(normalizeSearchQuery('')).toBeNull();
  });

  it('returns null for null or undefined', () => {
    expect(normalizeSearchQuery(null)).toBeNull();
    expect(normalizeSearchQuery(undefined)).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(normalizeSearchQuery('   ')).toBeNull();
  });

  it('returns null for a single character', () => {
    expect(normalizeSearchQuery('a')).toBeNull();
  });

  it('accepts a 2-character query, trimmed', () => {
    expect(normalizeSearchQuery('  ab  ')).toBe('ab');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeSearchQuery('final   fantasy')).toBe('final fantasy');
  });

  it('returns null for a query over 100 characters', () => {
    expect(normalizeSearchQuery('a'.repeat(101))).toBeNull();
  });

  it('accepts a query at exactly 100 characters', () => {
    expect(normalizeSearchQuery('a'.repeat(100))).toBe('a'.repeat(100));
  });
});

describe('toPrefixPattern', () => {
  it('only allows a trailing wildcard, so it matches titles that start with the query', () => {
    expect(toPrefixPattern('final')).toBe('final%');
  });

  it('escapes LIKE wildcards the same way as toLikePattern', () => {
    expect(toPrefixPattern('100%_a\\b')).toBe('100\\%\\_a\\\\b%');
  });
});

describe('toLikePattern', () => {
  it('wraps the query with wildcards', () => {
    expect(toLikePattern('dune')).toBe('%dune%');
  });

  it('escapes a literal percent sign', () => {
    expect(toLikePattern('100%')).toBe('%100\\%%');
  });

  it('escapes a literal underscore', () => {
    expect(toLikePattern('super_mario')).toBe('%super\\_mario%');
  });

  it('escapes a literal backslash before escaping % and _', () => {
    expect(toLikePattern('a\\b')).toBe('%a\\\\b%');
  });

  it('escapes a mix of backslash, percent and underscore', () => {
    expect(toLikePattern('a\\b_c%d')).toBe('%a\\\\b\\_c\\%d%');
  });
});

describe('mapGameRow', () => {
  it('maps a regular game', () => {
    const result = mapGameRow({ id: 12, title: 'Elden Ring', is_demo: 0, poster: 'co4jni' });
    expect(result).toMatchObject<Partial<SearchResult>>({
      section: 'games',
      id: '12',
      title: 'Elden Ring',
      href: '/playedGames/12',
    });
    expect(result.subtitle).toBeUndefined();
    expect(result.image).toContain('co4jni');
  });

  it('shows a Demo hint when is_demo is 1', () => {
    const result = mapGameRow({ id: 5, title: 'Some Game', is_demo: 1, poster: null });
    expect(result.subtitle).toBe('Demo');
  });

  it('omits the image when there is no poster', () => {
    const result = mapGameRow({ id: 5, title: 'Some Game', is_demo: 0, poster: null });
    expect(result.image).toBeUndefined();
  });
});

describe('mapLibraryRow', () => {
  it('maps a library game, linking to /myLibrary', () => {
    const result = mapLibraryRow({ id: 3, title: 'Hades', store: 'Epic Games', poster: 'co1a2b' });
    expect(result.section).toBe('library');
    expect(result.id).toBe('3');
    expect(result.title).toBe('Hades');
    expect(result.subtitle).toBe('Epic Games');
    expect(result.href).toBe('/myLibrary');
    expect(result.image).toContain('co1a2b');
  });
});

describe('mapSteamRow', () => {
  it('maps a steam game, linking to /mySteamGames', () => {
    const result = mapSteamRow({ appid: 440, name: 'Team Fortress 2', poster: 'https://cdn/tf2.jpg' });
    expect(result.section).toBe('steam');
    expect(result.id).toBe('440');
    expect(result.title).toBe('Team Fortress 2');
    expect(result.href).toBe('/mySteamGames');
    expect(result.image).toBe('https://cdn/tf2.jpg');
  });
});

describe('mapMovieRow', () => {
  it('maps a watched movie with year subtitle', () => {
    const result = mapMovieRow({ tmdb_id: 693134, title: 'Dune: Part Two', year: 2024, poster: 'https://img/dune.jpg' });
    expect(result.section).toBe('movies');
    expect(result.id).toBe('693134');
    expect(result.subtitle).toBe('2024');
    expect(result.href).toBe('/movies/693134');
    expect(result.image).toBe('https://img/dune.jpg');
  });

  it('omits the subtitle when there is no year', () => {
    const result = mapMovieRow({ tmdb_id: 1, title: 'Untitled', year: null, poster: null });
    expect(result.subtitle).toBeUndefined();
    expect(result.image).toBeUndefined();
  });
});

describe('mapSeriesRow', () => {
  it('maps a watched series, keyed by trakt_slug', () => {
    const result = mapSeriesRow({ trakt_slug: 'breaking-bad', title: 'Breaking Bad', year: 2008, poster: 'https://img/bb.jpg' });
    expect(result.section).toBe('series');
    expect(result.id).toBe('breaking-bad');
    expect(result.subtitle).toBe('2008');
    expect(result.href).toBe('/series/breaking-bad');
  });
});

describe('mapMangaRow', () => {
  it('prefers the english title when present', () => {
    const result = mapMangaRow({
      anilist_id: 30013,
      title_romaji: 'ONE PIECE',
      title_english: 'One Piece',
      title_native: 'ワンピース',
      cover: 'https://img/op.jpg',
    });
    expect(result.title).toBe('One Piece');
    expect(result.href).toBe('/manga/30013');
  });

  it('falls back to the romaji title when english is empty', () => {
    const result = mapMangaRow({
      anilist_id: 1,
      title_romaji: 'Sousou no Frieren',
      title_english: '',
      title_native: '葬送のフリーレン',
      cover: null,
    });
    expect(result.title).toBe('Sousou no Frieren');
  });

  it('falls back to the romaji title when english is null', () => {
    const result = mapMangaRow({
      anilist_id: 2,
      title_romaji: 'Chainsaw Man',
      title_english: null,
      title_native: null,
      cover: null,
    });
    expect(result.title).toBe('Chainsaw Man');
  });
});

describe('groupResults', () => {
  it('groups results by section in SEARCH_SECTIONS order regardless of input order', () => {
    const results: SearchResult[] = [
      { section: 'manga', id: '1', title: 'M', href: '/manga/1' },
      { section: 'games', id: '2', title: 'G', href: '/playedGames/2' },
      { section: 'games', id: '3', title: 'G2', href: '/playedGames/3' },
    ];
    const groups = groupResults(results);
    expect(groups.map((g) => g.key)).toEqual(['games', 'manga']);
    expect(groups[0].results).toHaveLength(2);
    expect(groups[1].results).toHaveLength(1);
  });

  it('drops sections with no results', () => {
    const results: SearchResult[] = [{ section: 'steam', id: '1', title: 'S', href: '/mySteamGames' }];
    const groups = groupResults(results);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('steam');
  });

  it('returns an empty array for no results', () => {
    expect(groupResults([])).toEqual([]);
  });

  it('SEARCH_SECTIONS covers all six public sections in the documented order', () => {
    expect(SEARCH_SECTIONS.map((s) => s.key)).toEqual([
      'games',
      'library',
      'steam',
      'movies',
      'series',
      'manga',
    ]);
  });
});
