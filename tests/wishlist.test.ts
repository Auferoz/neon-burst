import { describe, it, expect } from 'vitest';
import {
  parseSteamAppQuery,
  steamAppidFromIgdb,
  steamUrlFromIgdb,
  mapPriceOverview,
  formatClp,
  wishlistSummary,
  sortWishlist,
  pickStoreSearchResult,
  parseWishlistLines,
  parseSteamReleaseLabel,
  releaseInfo,
  filterWishlist,
  defaultWishlistFilters,
  hasActiveWishlistFilters,
  wishlistReleaseYears,
  type WishlistFilters,
  type WishlistItem,
} from '../src/utils/wishlist';

describe('parseSteamAppQuery', () => {
  it('accepts a bare appid', () => {
    expect(parseSteamAppQuery(' 3357650 ')).toBe(3357650);
  });

  it('accepts store urls with or without slug and query', () => {
    expect(parseSteamAppQuery('https://store.steampowered.com/app/3357650/PRAGMATA/')).toBe(3357650);
    expect(parseSteamAppQuery('store.steampowered.com/app/620')).toBe(620);
    expect(parseSteamAppQuery('https://store.steampowered.com/app/620/?l=spanish')).toBe(620);
  });

  it('rejects anything else', () => {
    expect(parseSteamAppQuery('')).toBeNull();
    expect(parseSteamAppQuery('pragmata')).toBeNull();
    expect(parseSteamAppQuery('0')).toBeNull();
    expect(parseSteamAppQuery('https://example.com/app/620')).toBeNull();
  });
});

describe('steamAppidFromIgdb', () => {
  it('prefers external_games with source 1 (Steam)', () => {
    expect(steamAppidFromIgdb({
      external_games: [{ uid: 'B0G82NB8YY', external_game_source: 20 }, { uid: '3357650', external_game_source: 1 }],
      websites: [{ url: 'https://store.steampowered.com/app/999/', type: 13 }],
    })).toBe(3357650);
  });

  it('falls back to the Steam website (type 13)', () => {
    expect(steamAppidFromIgdb({
      websites: [{ url: 'https://store.steampowered.com/app/3357650/PRAGMATA/', type: 13 }],
    })).toBe(3357650);
  });

  it('is null when the game is not on Steam', () => {
    expect(steamAppidFromIgdb({ websites: [{ url: 'https://store.playstation.com/x', type: 23 }] })).toBeNull();
    expect(steamAppidFromIgdb({})).toBeNull();
  });
});

describe('steamUrlFromIgdb', () => {
  it('uses the Steam website when present', () => {
    expect(steamUrlFromIgdb({ websites: [{ url: 'https://store.steampowered.com/app/1/X/', type: 13 }] }))
      .toBe('https://store.steampowered.com/app/1/X/');
  });

  it('builds it from the appid otherwise', () => {
    expect(steamUrlFromIgdb({ external_games: [{ uid: '620', external_game_source: 1 }] }))
      .toBe('https://store.steampowered.com/app/620');
  });

  it('is empty when not on Steam', () => {
    expect(steamUrlFromIgdb({})).toBe('');
  });
});

describe('mapPriceOverview', () => {
  it('maps a discounted price', () => {
    expect(mapPriceOverview({
      success: true,
      data: { price_overview: { currency: 'CLP', initial: 4280000, final: 3424000, discount_percent: 20 } },
    })).toEqual({ initial: 4280000, final: 3424000, discount: 20 });
  });

  it('is null for free, unreleased or failed entries', () => {
    expect(mapPriceOverview({ success: true, data: [] })).toBeNull();
    expect(mapPriceOverview({ success: false })).toBeNull();
    expect(mapPriceOverview(undefined)).toBeNull();
  });
});

describe('formatClp', () => {
  it('formats Steam cents as Chilean pesos', () => {
    expect(formatClp(3424000)).toBe('$34.240');
    expect(formatClp(0)).toBe('$0');
  });
});

function item(over: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: 1,
    source: 'manual',
    igdb_id: null,
    steam_appid: 1,
    name: 'B',
    cover: '',
    image: '',
    release_date: 0,
    release_label: '',
    created_at: '2026-10-01 00:00:00',
    price: null,
    ...over,
  };
}

describe('wishlistSummary', () => {
  it('adds up final prices and counts deals', () => {
    const items = [
      item({ price: { initial: 4280000, final: 3424000, discount: 20 } }),
      item({ price: { initial: 1550000, final: 1550000, discount: 0 } }),
      item({ price: null }),
    ];
    expect(wishlistSummary(items)).toEqual({ total: 4974000, priced: 2, onSale: 1 });
  });
});

describe('sortWishlist', () => {
  const a = item({ id: 1, name: 'Alpha', created_at: '2026-10-01 00:00:00', price: { initial: 100, final: 100, discount: 0 } });
  const b = item({ id: 2, name: 'Beta', created_at: '2026-10-03 00:00:00', price: { initial: 200, final: 50, discount: 75 } });
  const c = item({ id: 3, name: 'Gamma', created_at: '2026-10-02 00:00:00', price: null });

  it('recent: newest first', () => {
    expect(sortWishlist([a, b, c], 'recent').map(i => i.id)).toEqual([2, 3, 1]);
  });

  it('discount: biggest discount first, unpriced last', () => {
    expect(sortWishlist([c, a, b], 'discount').map(i => i.id)).toEqual([2, 1, 3]);
  });

  it('price: cheapest first, unpriced last', () => {
    expect(sortWishlist([c, a, b], 'price').map(i => i.id)).toEqual([2, 1, 3]);
  });

  it('does not mutate the input', () => {
    const input = [a, b, c];
    sortWishlist(input, 'price');
    expect(input.map(i => i.id)).toEqual([1, 2, 3]);
  });
});

describe('pickStoreSearchResult', () => {
  const hades = { id: 1145350, name: 'Hades II' };
  const ost = { id: 2950840, name: 'Hades II Original Soundtrack' };
  const dlc = { id: 3859930, name: 'PRAGMATA: Pack variado Refugio' };
  const pragmata = { id: 3357650, name: 'PRAGMATA' };

  it('prefers an exact name match ignoring case and punctuation', () => {
    expect(pickStoreSearchResult('pragmata', [dlc, pragmata])).toBe(pragmata);
    expect(pickStoreSearchResult('Hollow Knight Silksong', [
      { id: 2, name: 'Hollow Knight: Silksong - Official Soundtrack' },
      { id: 1, name: 'Hollow Knight: Silksong' },
    ])!.id).toBe(1);
  });

  it('skips soundtracks, DLC and packs when there is no exact match', () => {
    expect(pickStoreSearchResult('hades 2', [ost, hades])).toBe(hades);
  });

  it('falls back to the first result', () => {
    expect(pickStoreSearchResult('hades 2', [ost])).toBe(ost);
  });

  it('is null with no results', () => {
    expect(pickStoreSearchResult('xyz', [])).toBeNull();
  });
});

describe('parseWishlistLines', () => {
  it('trims, drops empty lines and duplicates (case-insensitive)', () => {
    expect(parseWishlistLines(' Hades II \n\nhades ii\n620\r\nPragmata', 50)).toEqual(['Hades II', '620', 'Pragmata']);
  });

  it('caps the list', () => {
    expect(parseWishlistLines('a\nb\nc', 2)).toEqual(['a', 'b']);
  });
});

describe('parseSteamReleaseLabel', () => {
  it('parses the Spanish store format', () => {
    expect(parseSteamReleaseLabel('18 ABR 2011')).toEqual({ date: Date.UTC(2011, 3, 18) / 1000, year: 2011 });
    expect(parseSteamReleaseLabel('6 dic 2024')).toEqual({ date: Date.UTC(2024, 11, 6) / 1000, year: 2024 });
    expect(parseSteamReleaseLabel('4 SEPT 2025')!.year).toBe(2025);
  });

  it('keeps just the year when there is no full date', () => {
    expect(parseSteamReleaseLabel('2027')).toEqual({ date: 0, year: 2027 });
    expect(parseSteamReleaseLabel('T1 2027')).toEqual({ date: 0, year: 2027 });
  });

  it('is null for undated labels', () => {
    expect(parseSteamReleaseLabel('Próximamente')).toBeNull();
    expect(parseSteamReleaseLabel('')).toBeNull();
  });
});

describe('releaseInfo', () => {
  const now = Date.UTC(2026, 9, 27) / 1000;

  it('uses the IGDB unix date first', () => {
    expect(releaseInfo(item({ release_date: Date.UTC(2026, 3, 16) / 1000 }), now)).toEqual({ year: 2026, state: 'released' });
    expect(releaseInfo(item({ release_date: Date.UTC(2027, 0, 1) / 1000 }), now)).toEqual({ year: 2027, state: 'upcoming' });
  });

  it('falls back to the store label', () => {
    expect(releaseInfo(item({ release_label: '28 OCT 2026' }), now)).toEqual({ year: 2026, state: 'upcoming' });
    expect(releaseInfo(item({ release_label: '2025' }), now)).toEqual({ year: 2025, state: 'released' });
    expect(releaseInfo(item({ release_label: '2027' }), now)).toEqual({ year: 2027, state: 'upcoming' });
  });

  it('a year-only label in the current year is unknown, "Próximamente" is upcoming', () => {
    expect(releaseInfo(item({ release_label: '2026' }), now)).toEqual({ year: 2026, state: 'unknown' });
    expect(releaseInfo(item({ release_label: 'Próximamente' }), now)).toEqual({ year: null, state: 'upcoming' });
    expect(releaseInfo(item({}), now)).toEqual({ year: null, state: 'unknown' });
  });
});

describe('filterWishlist', () => {
  const now = Date.UTC(2026, 9, 27) / 1000;
  const cheap = item({ id: 1, name: 'Hades II', release_label: '25 SEP 2025', price: { initial: 1550000, final: 1550000, discount: 0 } });
  const sale = item({ id: 2, name: 'PRAGMATA', release_date: Date.UTC(2026, 3, 16) / 1000, price: { initial: 4280000, final: 3424000, discount: 20 } });
  const soon = item({ id: 3, name: 'Futuro', release_label: '2027', price: null });
  const all = [cheap, sale, soon];
  const ids = (f: Partial<WishlistFilters>) => filterWishlist(all, { ...defaultWishlistFilters(), ...f }, now).map(i => i.id);

  it('passes everything with the defaults', () => {
    expect(ids({})).toEqual([1, 2, 3]);
  });

  it('by name, ignoring case and accents', () => {
    expect(ids({ query: 'pragmáta' })).toEqual([2]);
  });

  it('by price bucket', () => {
    expect(ids({ price: '5-15' })).toEqual([]);
    expect(ids({ price: '15-30' })).toEqual([1]);
    expect(ids({ price: '30+' })).toEqual([2]);
    expect(ids({ price: 'none' })).toEqual([3]);
  });

  it('only on sale', () => {
    expect(ids({ onSale: true })).toEqual([2]);
  });

  it('by release', () => {
    expect(ids({ release: 'released' })).toEqual([1, 2]);
    expect(ids({ release: 'upcoming' })).toEqual([3]);
    expect(ids({ release: '2026' })).toEqual([2]);
  });

  it('combines filters', () => {
    expect(ids({ release: 'released', onSale: true })).toEqual([2]);
  });

  it('lists the release years present, newest first', () => {
    expect(wishlistReleaseYears(all, now)).toEqual([2027, 2026, 2025]);
  });

  it('knows when a filter is active', () => {
    expect(hasActiveWishlistFilters(defaultWishlistFilters())).toBe(false);
    expect(hasActiveWishlistFilters({ ...defaultWishlistFilters(), onSale: true })).toBe(true);
  });
});
