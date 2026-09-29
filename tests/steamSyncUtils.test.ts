import { describe, it, expect } from 'vitest';
import {
  cleanHltbName,
  mapStoreDetails,
  mapHltbGame,
  buildSteamCacheUpsert,
} from '../db/steamSyncUtils.js';

describe('cleanHltbName', () => {
  it('strips trademark symbols and a trailing year', () => {
    expect(cleanHltbName('DOOM™ (2016)')).toBe('DOOM');
  });

  it('drops edition suffixes after a dash', () => {
    expect(cleanHltbName('Batman: Arkham Knight - Game of the Year Edition')).toBe('Batman: Arkham Knight');
    expect(cleanHltbName('Nioh 2 – The Complete Edition')).toBe('Nioh 2');
  });

  it('leaves a plain name alone', () => {
    expect(cleanHltbName('Hollow Knight')).toBe('Hollow Knight');
  });
});

describe('mapStoreDetails', () => {
  const raw = {
    developers: ['FromSoftware Inc.'],
    publishers: ['FromSoftware Inc.', 'Bandai Namco'],
    genres: [{ description: 'Acción' }, { description: 'Rol' }],
    release_date: { date: '24 FEB 2022' },
    controller_support: 'full',
    categories: [{ id: 2, description: 'Un jugador' }, { id: 28, description: 'Compat. total con mando' }],
    metacritic: { score: 94 },
  };

  it('keeps the existing text fields', () => {
    expect(mapStoreDetails(raw)).toMatchObject({
      developer: 'FromSoftware Inc.',
      publisher: 'FromSoftware Inc., Bandai Namco',
      genres: 'Acción, Rol',
      released: '24 FEB 2022',
    });
  });

  it('stores categories as a comma-separated id list (language independent)', () => {
    expect(mapStoreDetails(raw).categories).toBe('2,28');
  });

  it('classifies controller support from the field and the categories', () => {
    expect(mapStoreDetails(raw).controller_support).toBe('full');
    expect(mapStoreDetails({ categories: [{ id: 18 }] }).controller_support).toBe('partial');
    expect(mapStoreDetails({ controller_support: 'partial' }).controller_support).toBe('partial');
    expect(mapStoreDetails({ categories: [{ id: 2 }] }).controller_support).toBe('none');
  });

  it('reads the metacritic score or null', () => {
    expect(mapStoreDetails(raw).metacritic).toBe(94);
    expect(mapStoreDetails({}).metacritic).toBeNull();
  });
});

describe('mapHltbGame', () => {
  it('converts seconds to hours with one decimal', () => {
    expect(mapHltbGame({ comp_main: 216360, comp_plus: 364680, comp_100: 490320 }))
      .toEqual({ main: 60.1, extra: 101.3, completionist: 136.2 });
  });

  it('turns zero or missing times into null', () => {
    expect(mapHltbGame({ comp_main: 0, comp_plus: 3600 })).toEqual({ main: null, extra: 1, completionist: null });
  });
});

describe('buildSteamCacheUpsert', () => {
  const base = { appid: 1245620, name: "Tom Clancy's Test", playtime: 90, lastPlayed: 1700000000 };

  it('always refreshes name and playtime', () => {
    const sql = buildSteamCacheUpsert(base);
    expect(sql).toContain("VALUES (1245620, 'Tom Clancy''s Test'");
    expect(sql).toContain('playtime = excluded.playtime');
    expect(sql).toContain('last_played = excluded.last_played');
  });

  it('never overwrites a stored text value with an empty one', () => {
    const sql = buildSteamCacheUpsert(base);
    expect(sql).toContain("genres = CASE WHEN excluded.genres != '' THEN excluded.genres ELSE steam_cache.genres END");
    expect(sql).toContain("poster = CASE WHEN excluded.poster != '' THEN excluded.poster ELSE steam_cache.poster END");
  });

  it('never overwrites stored HLTB times or metacritic with NULL', () => {
    const sql = buildSteamCacheUpsert(base);
    expect(sql).toContain('hltb_main = COALESCE(excluded.hltb_main, steam_cache.hltb_main)');
    expect(sql).toContain('metacritic = COALESCE(excluded.metacritic, steam_cache.metacritic)');
  });

  it('writes fetched values as SQL literals', () => {
    const sql = buildSteamCacheUpsert({
      ...base,
      store: { developer: 'A', publisher: 'B', genres: 'Rol', released: '2022', controller_support: 'full', categories: '2,28', metacritic: 94 },
      poster: 'https://x/p.jpg',
      hltb: { main: 60.1, extra: null, completionist: 136.2 },
    });
    expect(sql).toContain("'Rol', '2022', 'https://x/p.jpg', 90, 1700000000, 60.1, NULL, 136.2, 'full', '2,28', 94,");
  });

  it('never contains a double quote, so it survives the Windows --command quoting', () => {
    const sql = buildSteamCacheUpsert({ ...base, name: 'The "Quoted" Game' });
    expect(sql).not.toContain('"');
  });
});
