import { describe, it, expect } from 'vitest';
import { parseAnilistQuery, countryToType, mapAnilistToCacheRow, validateAnilistMediaPayload } from '../src/services/anilist';
import fixture from './fixtures/anilist-media.json';

describe('parseAnilistQuery', () => {
  it('parses a full AniList URL with slug', () => {
    expect(parseAnilistQuery('https://anilist.co/manga/30013/One-Piece')).toBe(30013);
  });

  it('parses an AniList URL without slug', () => {
    expect(parseAnilistQuery('https://anilist.co/manga/30013')).toBe(30013);
  });

  it('parses a bare numeric id', () => {
    expect(parseAnilistQuery('30013')).toBe(30013);
  });

  it('returns null for a non-AniList URL', () => {
    expect(parseAnilistQuery('https://mangadex.org/title/abc123')).toBeNull();
  });

  it('returns null for empty or garbage input', () => {
    expect(parseAnilistQuery('')).toBeNull();
    expect(parseAnilistQuery('   ')).toBeNull();
    expect(parseAnilistQuery('not-a-valid-query')).toBeNull();
  });
});

describe('countryToType', () => {
  it('maps JP to Manga', () => {
    expect(countryToType('JP')).toBe('Manga');
  });

  it('maps KR to Manhwa', () => {
    expect(countryToType('KR')).toBe('Manhwa');
  });

  it('maps CN to Manhua', () => {
    expect(countryToType('CN')).toBe('Manhua');
  });

  it('maps TW to Manhua', () => {
    expect(countryToType('TW')).toBe('Manhua');
  });

  it('falls back to Manga for an unknown or null country', () => {
    expect(countryToType('FR')).toBe('Manga');
    expect(countryToType(null)).toBe('Manga');
    expect(countryToType(undefined)).toBe('Manga');
  });
});

describe('mapAnilistToCacheRow', () => {
  const row = mapAnilistToCacheRow(fixture as any);

  it('maps the anilist id and basic identity fields', () => {
    expect(row.anilist_id).toBe(30013);
    expect(row.id_mal).toBe(13);
    expect(row.title_romaji).toBe('ONE PIECE');
    expect(row.title_native).toBe('ワンピース');
  });

  it('falls back title_english to empty string when missing', () => {
    expect(row.title_english).toBe('');
  });

  it('derives type from countryOfOrigin', () => {
    expect(row.type).toBe('Manga');
    expect(row.country).toBe('JP');
  });

  it('formats a full start date as DD/MM/YYYY', () => {
    expect(row.start_date).toBe('22/07/1997');
  });

  it('formats a null end date as empty string', () => {
    expect(row.end_date).toBe('');
  });

  it('leaves chapters null while the manga is RELEASING', () => {
    expect(row.chapters).toBeNull();
    expect(row.status).toBe('RELEASING');
  });

  it('strips <br> tags from the description into line breaks', () => {
    expect(row.description).toContain('\n');
    expect(row.description).not.toContain('<br>');
    expect(row.description).not.toContain('<i>');
  });

  it('serializes genres, tags, staff, characters, relations, recommendations and external links as JSON', () => {
    expect(JSON.parse(row.genres_json)).toEqual(['Action', 'Adventure', 'Comedy']);
    expect(JSON.parse(row.tags_json)).toHaveLength(2);
    expect(JSON.parse(row.staff_json)[0].name).toBe('Eiichiro Oda');
    expect(JSON.parse(row.characters_json)[0].name).toBe('Monkey D. Luffy');
    expect(JSON.parse(row.relations_json)).toHaveLength(1);
    expect(JSON.parse(row.recommendations_json)).toHaveLength(1);
    expect(JSON.parse(row.external_links_json)[0].site).toBe('VIZ');
  });

  it('keeps the site url and cover data', () => {
    expect(row.site_url).toBe('https://anilist.co/manga/30013');
    expect(row.cover).toContain('bx30013.jpg');
    expect(row.cover_color).toBe('#e4a015');
  });
});

describe('validateAnilistMediaPayload', () => {
  it('accepts a valid media payload matching the expected id', () => {
    const result = validateAnilistMediaPayload(fixture, 30013);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.media.id).toBe(30013);
    }
  });

  it('rejects when the id does not match', () => {
    const result = validateAnilistMediaPayload(fixture, 999);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/id/i);
    }
  });

  it('rejects when type is not MANGA', () => {
    const result = validateAnilistMediaPayload({ ...fixture, type: 'ANIME' }, 30013);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/manga/i);
    }
  });

  it('rejects when the title is missing', () => {
    const { title, ...withoutTitle } = fixture as any;
    const result = validateAnilistMediaPayload(withoutTitle, 30013);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/título/i);
    }
  });

  it('rejects when title.romaji is missing or not a string', () => {
    const result = validateAnilistMediaPayload({ ...fixture, title: { romaji: null } }, 30013);
    expect(result.ok).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(validateAnilistMediaPayload(null, 30013).ok).toBe(false);
    expect(validateAnilistMediaPayload(undefined, 30013).ok).toBe(false);
    expect(validateAnilistMediaPayload('not an object', 30013).ok).toBe(false);
    expect(validateAnilistMediaPayload(42, 30013).ok).toBe(false);
    expect(validateAnilistMediaPayload([fixture], 30013).ok).toBe(false);
  });

  it('rejects an oversized payload', () => {
    const huge = { ...fixture, description: 'x'.repeat(600_000) };
    const result = validateAnilistMediaPayload(huge, 30013);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/grandes/i);
    }
  });
});
