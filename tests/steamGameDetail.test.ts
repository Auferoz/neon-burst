import { describe, it, expect } from 'vitest';
import {
  mapAchievements,
  mapStoreExtras,
  achievementPercent,
  steamHeaderCandidates,
  type PlayerAchievementsRaw,
  type SchemaRaw,
  type GlobalPercentagesRaw,
  type GameAchievementsRaw,
} from '../src/utils/steamGameDetail';

const player: PlayerAchievementsRaw = {
  playerstats: {
    success: true,
    achievements: [
      { apiname: 'A', achieved: 1, unlocktime: 100, name: 'Uno', description: 'Primero' },
      { apiname: 'B', achieved: 0, unlocktime: 0, name: 'Dos', description: 'Segundo' },
      { apiname: 'C', achieved: 0, unlocktime: 0, name: 'Tres', description: 'Tercero' },
    ],
  },
};

const schema: SchemaRaw = {
  game: {
    availableGameStats: {
      achievements: [
        { name: 'A', displayName: 'Uno', hidden: 0, description: 'Primero', icon: 'a.jpg', icongray: 'a_bw.jpg' },
        { name: 'B', displayName: 'Dos', hidden: 0, description: 'Segundo', icon: 'b.jpg', icongray: 'b_bw.jpg' },
        { name: 'C', displayName: 'Tres', hidden: 1, icon: 'c.jpg', icongray: 'c_bw.jpg' },
      ],
    },
  },
};

const global: GlobalPercentagesRaw = {
  achievementpercentages: {
    achievements: [
      { name: 'A', percent: '74.0' },
      { name: 'B', percent: 12.5 },
      { name: 'C', percent: '40.95' },
    ],
  },
};

describe('mapAchievements', () => {
  it('counts total and achieved', () => {
    const result = mapAchievements(player, schema, global);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(3);
    expect(result!.achieved).toBe(1);
  });

  it('lists only the missing ones, most common first', () => {
    const result = mapAchievements(player, schema, global)!;
    expect(result.missing.map(a => a.apiname)).toEqual(['C', 'B']);
  });

  it('merges icon, hidden flag and global percent from the schema and percentages', () => {
    const c = mapAchievements(player, schema, global)!.missing[0];
    expect(c).toEqual({
      apiname: 'C',
      name: 'Tres',
      description: 'Tercero',
      icon: 'c_bw.jpg',
      hidden: true,
      percent: 41,
    });
  });

  it('returns null when the game has no stats', () => {
    const noStats: PlayerAchievementsRaw = { playerstats: { success: false, error: 'Requested app has no stats' } };
    expect(mapAchievements(noStats, null, null)).toBeNull();
  });

  it('returns null when the achievement list is empty', () => {
    expect(mapAchievements({ playerstats: { success: true, achievements: [] } }, null, null)).toBeNull();
  });

  it('works without schema or percentages', () => {
    const result = mapAchievements(player, null, null)!;
    expect(result.total).toBe(3);
    expect(result.missing.map(a => a.apiname)).toEqual(['B', 'C']);
    expect(result.missing[0]).toMatchObject({ icon: '', hidden: false, percent: null });
  });

  it('falls back to the schema text when the player response has none', () => {
    const bare: PlayerAchievementsRaw = {
      playerstats: { success: true, achievements: [{ apiname: 'B', achieved: 0 }] },
    };
    expect(mapAchievements(bare, schema, null)!.missing[0]).toMatchObject({ name: 'Dos', description: 'Segundo' });
  });

  it('uses the apiname when there is no name anywhere', () => {
    const bare: PlayerAchievementsRaw = {
      playerstats: { success: true, achievements: [{ apiname: 'X', achieved: 0 }] },
    };
    expect(mapAchievements(bare, null, null)!.missing[0].name).toBe('X');
  });

  it('reveals hidden descriptions from GetGameAchievements', () => {
    const hiddenPlayer: PlayerAchievementsRaw = {
      playerstats: { success: true, achievements: [{ apiname: 'C', achieved: 0, name: 'Tres', description: '' }] },
    };
    const game: GameAchievementsRaw = {
      response: { achievements: [{ internal_name: 'C', localized_desc: 'Tírale la lata al poli' }] },
    };
    expect(mapAchievements(hiddenPlayer, schema, global, game)!.missing[0]).toMatchObject({
      hidden: true,
      description: 'Tírale la lata al poli',
    });
  });

  it('prefers the player description over GetGameAchievements', () => {
    const game: GameAchievementsRaw = {
      response: { achievements: [{ internal_name: 'B', localized_desc: 'Otra' }] },
    };
    expect(mapAchievements(player, schema, global, game)!.missing.find(a => a.apiname === 'B')!.description).toBe('Segundo');
  });
});

describe('achievementPercent', () => {
  it('rounds down so 99.6% never shows as 100%', () => {
    expect(achievementPercent(249, 250)).toBe(99);
    expect(achievementPercent(250, 250)).toBe(100);
  });

  it('is 0 with no achievements', () => {
    expect(achievementPercent(0, 0)).toBe(0);
  });
});

describe('mapStoreExtras', () => {
  it('maps the short description and up to 8 screenshots', () => {
    const screenshots = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      path_thumbnail: `t${i}.jpg`,
      path_full: `f${i}.jpg`,
    }));
    const result = mapStoreExtras({ short_description: 'Hola &amp; adiós', screenshots });
    expect(result.description).toBe('Hola & adiós');
    expect(result.screenshots).toHaveLength(8);
    expect(result.screenshots[0]).toEqual({ thumb: 't0.jpg', full: 'f0.jpg' });
  });

  it('strips html tags from the description', () => {
    expect(mapStoreExtras({ short_description: '<b>Gran</b> juego<br>' }).description).toBe('Gran juego');
  });

  it('handles missing fields', () => {
    expect(mapStoreExtras({})).toEqual({ description: '', screenshots: [], header: '' });
  });

  it('keeps the hashed header_image url from the store', () => {
    const url = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3513350/fb96/header.jpg?t=1';
    expect(mapStoreExtras({ header_image: url }).header).toBe(url);
  });

  it('skips screenshots without urls', () => {
    const result = mapStoreExtras({ screenshots: [{ path_thumbnail: '', path_full: 'f.jpg' }] });
    expect(result.screenshots).toEqual([]);
  });
});

describe('steamHeaderCandidates', () => {
  const cdn = 'https://cdn.cloudflare.steamstatic.com/steam/apps/620';

  it('tries the legacy header, then the library hero, then the poster', () => {
    expect(steamHeaderCandidates(620, 'poster.jpg')).toEqual([
      `${cdn}/header.jpg`,
      `${cdn}/library_hero.jpg`,
      'poster.jpg',
    ]);
  });

  it('puts the store header first when it is known', () => {
    expect(steamHeaderCandidates(620, '', 'store.jpg')).toEqual([
      'store.jpg',
      `${cdn}/header.jpg`,
      `${cdn}/library_hero.jpg`,
    ]);
  });

  it('skips empty and duplicated sources', () => {
    expect(steamHeaderCandidates(620, `${cdn}/header.jpg`, '')).toEqual([
      `${cdn}/header.jpg`,
      `${cdn}/library_hero.jpg`,
    ]);
  });
});
