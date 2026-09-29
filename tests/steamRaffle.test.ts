import { describe, it, expect } from 'vitest';
import {
  defaultFilters,
  normalizeText,
  normalizeGenres,
  availableGenres,
  durationBucket,
  playState,
  parseCategories,
  matchesFilters,
  filterPool,
  pickWinnerIndex,
  buildReelSchedule,
  hasActiveFilters,
  sanitizeFilters,
  type RaffleGame,
  type RaffleFilters,
  type RaffleList,
} from '../src/utils/steamRaffle';

function game(over: Partial<RaffleGame> = {}): RaffleGame {
  return {
    appid: 1,
    name: 'Test Game',
    genres: 'Acción, Aventura',
    poster: '',
    playtime: 0,
    hltb_main: 10,
    controller_support: 'full',
    categories: '2,22',
    metacritic: 80,
    ...over,
  };
}

function filters(over: Partial<RaffleFilters> = {}): RaffleFilters {
  return { ...defaultFilters(), ...over };
}

describe('normalizeText', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeText('  ÁcciÓN  ')).toBe('accion');
  });
  it('handles empty input', () => {
    expect(normalizeText('')).toBe('');
  });
});

describe('normalizeGenres', () => {
  it('splits and trims', () => {
    expect(normalizeGenres('Acción, Aventura ,Indie')).toEqual(['Acción', 'Aventura', 'Indie']);
  });
  it('maps aliases', () => {
    expect(normalizeGenres('Role-playing (RPG), Adventure')).toEqual(['Rol', 'Aventura']);
  });
  it('drops junk genres', () => {
    expect(
      normalizeGenres('Animación y modelado, Diseño e ilustración, Edición fotográfica, Utilidades, Indie'),
    ).toEqual(['Indie']);
  });
  it('dedupes after aliasing', () => {
    expect(normalizeGenres('Aventura, Adventure')).toEqual(['Aventura']);
  });
  it('returns [] for empty or nullish text', () => {
    expect(normalizeGenres('')).toEqual([]);
    expect(normalizeGenres(null)).toEqual([]);
    expect(normalizeGenres(undefined)).toEqual([]);
  });
});

describe('availableGenres', () => {
  it('sorts by frequency then name and counts merged aliases', () => {
    const games = [
      game({ appid: 1, genres: 'Acción, Aventura' }),
      game({ appid: 2, genres: 'Acción, Adventure' }),
      game({ appid: 3, genres: 'Acción, Utilidades' }),
      game({ appid: 4, genres: 'Indie, Casual' }),
    ];
    expect(availableGenres(games)).toEqual([
      { name: 'Acción', count: 3 },
      { name: 'Aventura', count: 2 },
      { name: 'Casual', count: 1 },
      { name: 'Indie', count: 1 },
    ]);
  });
  it('is empty for no games', () => {
    expect(availableGenres([])).toEqual([]);
  });
});

describe('durationBucket', () => {
  it('uses half-open ranges [a, b)', () => {
    expect(durationBucket(0.5)).toBe('lt5');
    expect(durationBucket(4.99)).toBe('lt5');
    expect(durationBucket(5)).toBe('5-15');
    expect(durationBucket(14.99)).toBe('5-15');
    expect(durationBucket(15)).toBe('15-30');
    expect(durationBucket(29.99)).toBe('15-30');
    expect(durationBucket(30)).toBe('30-60');
    expect(durationBucket(59.99)).toBe('30-60');
    expect(durationBucket(60)).toBe('60plus');
    expect(durationBucket(400)).toBe('60plus');
  });
  it('returns null for unknown durations', () => {
    expect(durationBucket(null)).toBeNull();
    expect(durationBucket(0)).toBeNull();
    expect(durationBucket(Number.NaN)).toBeNull();
  });
});

describe('playState', () => {
  it('classifies by minutes played', () => {
    expect(playState(0)).toBe('unplayed');
    expect(playState(1)).toBe('tried');
    expect(playState(119)).toBe('tried');
    expect(playState(120)).toBe('played');
    expect(playState(5000)).toBe('played');
  });
});

describe('parseCategories', () => {
  it('parses comma separated ids', () => {
    expect(parseCategories('2,22, 28')).toEqual([2, 22, 28]);
  });
  it('ignores junk and empties', () => {
    expect(parseCategories('')).toEqual([]);
    expect(parseCategories(null)).toEqual([]);
    expect(parseCategories('2,,x,9')).toEqual([2, 9]);
  });
});

describe('matchesFilters', () => {
  it('matches everything with default filters', () => {
    expect(matchesFilters(game(), defaultFilters(), null)).toBe(true);
    expect(
      matchesFilters(
        game({ genres: '', hltb_main: null, controller_support: '', categories: '', metacritic: null }),
        defaultFilters(),
        null,
      ),
    ).toBe(true);
  });

  describe('genres (ANY-of)', () => {
    it('matches when the game has any selected genre', () => {
      const f = filters({ genres: ['Rol', 'Aventura'] });
      expect(matchesFilters(game({ genres: 'Acción, Aventura' }), f, null)).toBe(true);
      expect(matchesFilters(game({ genres: 'Acción' }), f, null)).toBe(false);
    });
    it('matches through aliases', () => {
      const f = filters({ genres: ['Rol'] });
      expect(matchesFilters(game({ genres: 'Role-playing (RPG)' }), f, null)).toBe(true);
    });
    it('does not match a game with no genres', () => {
      expect(matchesFilters(game({ genres: '' }), filters({ genres: ['Rol'] }), null)).toBe(false);
    });
  });

  describe('controls', () => {
    it('matches the selected control levels (ANY-of)', () => {
      const f = filters({ controls: ['full', 'partial'] });
      expect(matchesFilters(game({ controller_support: 'full' }), f, null)).toBe(true);
      expect(matchesFilters(game({ controller_support: 'partial' }), f, null)).toBe(true);
      expect(matchesFilters(game({ controller_support: 'none' }), f, null)).toBe(false);
    });
    it('unknown ("") only matches when no control chip is selected', () => {
      const unknown = game({ controller_support: '' });
      expect(matchesFilters(unknown, filters({ controls: [] }), null)).toBe(true);
      expect(matchesFilters(unknown, filters({ controls: ['none'] }), null)).toBe(false);
      expect(matchesFilters(unknown, filters({ controls: ['full'] }), null)).toBe(false);
    });
    it('"none" chip means keyboard and mouse', () => {
      expect(matchesFilters(game({ controller_support: 'none' }), filters({ controls: ['none'] }), null)).toBe(true);
    });
  });

  describe('modes (ANY-of)', () => {
    it('maps single / multi / coop to categories 2 / 1 / 9', () => {
      expect(matchesFilters(game({ categories: '2,22' }), filters({ modes: ['single'] }), null)).toBe(true);
      expect(matchesFilters(game({ categories: '1,22' }), filters({ modes: ['single'] }), null)).toBe(false);
      expect(matchesFilters(game({ categories: '1' }), filters({ modes: ['multi'] }), null)).toBe(true);
      expect(matchesFilters(game({ categories: '2,9' }), filters({ modes: ['coop'] }), null)).toBe(true);
      expect(matchesFilters(game({ categories: '2' }), filters({ modes: ['coop'] }), null)).toBe(false);
    });
    it('matches any of several selected modes', () => {
      const f = filters({ modes: ['multi', 'coop'] });
      expect(matchesFilters(game({ categories: '9' }), f, null)).toBe(true);
      expect(matchesFilters(game({ categories: '2' }), f, null)).toBe(false);
    });
    it('a game with unknown categories fails any mode chip', () => {
      expect(matchesFilters(game({ categories: '' }), filters({ modes: ['single'] }), null)).toBe(false);
    });
    it('does not confuse ids by substring (22 is not 2)', () => {
      expect(matchesFilters(game({ categories: '22,28' }), filters({ modes: ['single'] }), null)).toBe(false);
    });
  });

  describe('duration (hltb_main)', () => {
    it('respects half-open boundaries', () => {
      const f5 = filters({ durations: ['5-15'] });
      expect(matchesFilters(game({ hltb_main: 4.99 }), f5, null)).toBe(false);
      expect(matchesFilters(game({ hltb_main: 5 }), f5, null)).toBe(true);
      expect(matchesFilters(game({ hltb_main: 15 }), f5, null)).toBe(false);
      const f60 = filters({ durations: ['60plus'] });
      expect(matchesFilters(game({ hltb_main: 60 }), f60, null)).toBe(true);
      expect(matchesFilters(game({ hltb_main: 59.9 }), f60, null)).toBe(false);
    });
    it('is ANY-of across chips', () => {
      const f = filters({ durations: ['lt5', '30-60'] });
      expect(matchesFilters(game({ hltb_main: 3 }), f, null)).toBe(true);
      expect(matchesFilters(game({ hltb_main: 40 }), f, null)).toBe(true);
      expect(matchesFilters(game({ hltb_main: 20 }), f, null)).toBe(false);
    });
    it('NULL duration is included only when the toggle is on and a chip is selected', () => {
      const unknown = game({ hltb_main: null });
      expect(matchesFilters(unknown, filters({ durations: ['lt5'], includeUnknownDuration: true }), null)).toBe(true);
      expect(matchesFilters(unknown, filters({ durations: ['lt5'], includeUnknownDuration: false }), null)).toBe(false);
    });
    it('NULL duration always matches when no chip is selected', () => {
      const unknown = game({ hltb_main: null });
      expect(matchesFilters(unknown, filters({ durations: [], includeUnknownDuration: false }), null)).toBe(true);
    });
  });

  describe('play state', () => {
    it('matches the selected states (ANY-of)', () => {
      expect(matchesFilters(game({ playtime: 0 }), filters({ states: ['unplayed'] }), null)).toBe(true);
      expect(matchesFilters(game({ playtime: 30 }), filters({ states: ['unplayed'] }), null)).toBe(false);
      expect(matchesFilters(game({ playtime: 30 }), filters({ states: ['tried'] }), null)).toBe(true);
      expect(matchesFilters(game({ playtime: 120 }), filters({ states: ['tried'] }), null)).toBe(false);
      expect(matchesFilters(game({ playtime: 120 }), filters({ states: ['played', 'tried'] }), null)).toBe(true);
    });
  });

  describe('metacritic minimum', () => {
    it('keeps games at or above the minimum', () => {
      expect(matchesFilters(game({ metacritic: 80 }), filters({ minMetacritic: 80 }), null)).toBe(true);
      expect(matchesFilters(game({ metacritic: 79 }), filters({ minMetacritic: 80 }), null)).toBe(false);
    });
    it('a minimum excludes NULL metacritic; "any" keeps it', () => {
      expect(matchesFilters(game({ metacritic: null }), filters({ minMetacritic: 70 }), null)).toBe(false);
      expect(matchesFilters(game({ metacritic: null }), filters({ minMetacritic: 0 }), null)).toBe(true);
    });
  });

  describe('list membership', () => {
    it('requires the appid to be in the list when one is given', () => {
      const set = new Set([1, 2]);
      expect(matchesFilters(game({ appid: 1 }), defaultFilters(), set)).toBe(true);
      expect(matchesFilters(game({ appid: 3 }), defaultFilters(), set)).toBe(false);
    });
    it('null list means no restriction', () => {
      expect(matchesFilters(game({ appid: 3 }), defaultFilters(), null)).toBe(true);
    });
  });

  describe('name search', () => {
    it('is a case and accent insensitive contains', () => {
      const g = game({ name: 'Pokémon Legends: Arceus' });
      expect(matchesFilters(g, filters({ name: 'pokemon' }), null)).toBe(true);
      expect(matchesFilters(g, filters({ name: '  LEGENDS ' }), null)).toBe(true);
      expect(matchesFilters(g, filters({ name: 'zelda' }), null)).toBe(false);
    });
  });

  it('combines all filters with AND across groups', () => {
    const f = filters({ genres: ['Rol'], controls: ['full'], modes: ['single'], minMetacritic: 80 });
    const ok = game({ genres: 'Rol', controller_support: 'full', categories: '2', metacritic: 90 });
    expect(matchesFilters(ok, f, null)).toBe(true);
    expect(matchesFilters({ ...ok, metacritic: 70 }, f, null)).toBe(false);
    expect(matchesFilters({ ...ok, controller_support: 'none' }, f, null)).toBe(false);
  });
});

describe('filterPool', () => {
  const games = [
    game({ appid: 1, name: 'A', genres: 'Rol' }),
    game({ appid: 2, name: 'B', genres: 'Acción' }),
    game({ appid: 3, name: 'C', genres: 'Rol' }),
  ];
  const lists: RaffleList[] = [{ id: 10, name: 'Fin de semana', appids: [1, 2] }];

  it('applies filters preserving order', () => {
    expect(filterPool(games, filters({ genres: ['Rol'] }), lists, new Set()).map(g => g.appid)).toEqual([1, 3]);
  });
  it('applies the selected list', () => {
    expect(filterPool(games, filters({ listId: 10 }), lists, new Set()).map(g => g.appid)).toEqual([1, 2]);
  });
  it('ignores a list id that no longer exists', () => {
    expect(filterPool(games, filters({ listId: 99 }), lists, new Set()).map(g => g.appid)).toEqual([1, 2, 3]);
  });
  it('removes excluded games', () => {
    expect(filterPool(games, defaultFilters(), lists, new Set([2])).map(g => g.appid)).toEqual([1, 3]);
  });
  it('combines list, filters and exclusions', () => {
    expect(
      filterPool(games, filters({ listId: 10, genres: ['Rol'] }), lists, new Set([1])).map(g => g.appid),
    ).toEqual([]);
  });
});

describe('hasActiveFilters', () => {
  it('is false for defaults and true after any change', () => {
    expect(hasActiveFilters(defaultFilters())).toBe(false);
    expect(hasActiveFilters(filters({ genres: ['Rol'] }))).toBe(true);
    expect(hasActiveFilters(filters({ name: 'x' }))).toBe(true);
    expect(hasActiveFilters(filters({ minMetacritic: 70 }))).toBe(true);
    expect(hasActiveFilters(filters({ listId: 3 }))).toBe(true);
    expect(hasActiveFilters(filters({ includeUnknownDuration: false }))).toBe(true);
  });
});

describe('pickWinnerIndex', () => {
  it('maps a random uint32 into range', () => {
    expect(pickWinnerIndex(10, () => 7)).toBe(7);
    expect(pickWinnerIndex(10, () => 13)).toBe(3);
  });
  it('always returns 0 for a pool of one', () => {
    expect(pickWinnerIndex(1, () => 123456)).toBe(0);
  });
  it('rejects values in the biased tail and redraws', () => {
    // length 3: 2^32 % 3 === 1, so the only biased value is 2^32 - 1.
    const draws = [0xffffffff, 0xffffffff, 4];
    let calls = 0;
    const idx = pickWinnerIndex(3, () => draws[calls++]);
    expect(calls).toBe(3);
    expect(idx).toBe(1); // 4 % 3
  });
  it('accepts the largest unbiased value without redrawing', () => {
    let calls = 0;
    const idx = pickWinnerIndex(3, () => {
      calls++;
      return 0xfffffffe;
    });
    expect(calls).toBe(1);
    expect(idx).toBe(0xfffffffe % 3);
  });
  it('is uniform over a full sweep of a small range', () => {
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 5000; i++) counts[pickWinnerIndex(5, () => i)]++;
    expect(counts).toEqual([1000, 1000, 1000, 1000, 1000]);
  });
  it('throws on an empty pool', () => {
    expect(() => pickWinnerIndex(0, () => 1)).toThrow();
  });
});

describe('buildReelSchedule', () => {
  const opts = { ticks: 30, totalMs: 4000 };

  it('has exactly `ticks` steps and ends on the winner', () => {
    for (const [n, w] of [[10, 0], [10, 7], [100, 99], [3, 1], [50, 25]]) {
      const s = buildReelSchedule(n, w, opts);
      expect(s).toHaveLength(opts.ticks);
      expect(s[s.length - 1].index).toBe(w);
    }
  });
  it('steps through consecutive pool indexes (wrapping)', () => {
    const s = buildReelSchedule(5, 1, { ticks: 4, totalMs: 1000 });
    expect(s.map(x => x.index)).toEqual([3, 4, 0, 1]);
  });
  it('keeps every index inside the pool', () => {
    const s = buildReelSchedule(7, 3, opts);
    for (const step of s) {
      expect(step.index).toBeGreaterThanOrEqual(0);
      expect(step.index).toBeLessThan(7);
    }
  });
  it('has non-decreasing delays (ease-out)', () => {
    const s = buildReelSchedule(20, 4, opts);
    for (let i = 1; i < s.length; i++) {
      expect(s[i].delayMs).toBeGreaterThanOrEqual(s[i - 1].delayMs);
    }
    expect(s[s.length - 1].delayMs).toBeGreaterThan(s[0].delayMs);
  });
  it('sums to approximately totalMs', () => {
    const s = buildReelSchedule(20, 4, opts);
    const sum = s.reduce((acc, x) => acc + x.delayMs, 0);
    expect(Math.abs(sum - opts.totalMs)).toBeLessThan(1);
  });
  it('works for a pool of one', () => {
    const s = buildReelSchedule(1, 0, opts);
    expect(s).toHaveLength(opts.ticks);
    expect(s.every(x => x.index === 0)).toBe(true);
  });
  it('supports a single tick', () => {
    const s = buildReelSchedule(5, 2, { ticks: 1, totalMs: 500 });
    expect(s).toEqual([{ index: 2, delayMs: 500 }]);
  });
  it('rejects invalid arguments', () => {
    expect(() => buildReelSchedule(0, 0, opts)).toThrow();
    expect(() => buildReelSchedule(5, 5, opts)).toThrow();
    expect(() => buildReelSchedule(5, -1, opts)).toThrow();
    expect(() => buildReelSchedule(5, 1, { ticks: 0, totalMs: 100 })).toThrow();
  });
});

describe('sanitizeFilters', () => {
  it('returns defaults for non-objects', () => {
    expect(sanitizeFilters(null)).toEqual(defaultFilters());
    expect(sanitizeFilters('x')).toEqual(defaultFilters());
    expect(sanitizeFilters(42)).toEqual(defaultFilters());
  });
  it('keeps valid stored values', () => {
    const stored = filters({
      genres: ['Rol'],
      controls: ['full'],
      modes: ['coop'],
      durations: ['lt5'],
      includeUnknownDuration: false,
      states: ['played'],
      minMetacritic: 80,
      listId: 4,
      name: 'zel',
    });
    expect(sanitizeFilters(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });
  it('drops unknown chip values and wrong types', () => {
    const out = sanitizeFilters({
      genres: ['Rol', 5, null],
      controls: ['full', 'wireless'],
      modes: 'single',
      durations: ['lt5', '1000h'],
      includeUnknownDuration: 'yes',
      states: ['nope'],
      minMetacritic: 55,
      listId: 'abc',
      name: 123,
    });
    expect(out).toEqual(filters({ genres: ['Rol'], controls: ['full'], durations: ['lt5'] }));
  });
});
