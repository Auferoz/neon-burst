/**
 * Groups `library_games` rows so the same game owned on several stores renders
 * as one card carrying every store badge.
 *
 * Grouping happens at read time on purpose — the table keeps one row per
 * (store, title). Merging rows in D1 would destroy the per-store fields that
 * only make sense per store: `owned_via`, `store_url` and `notes`. A game can be
 * a gift on Epic and a purchase on GOG, with a different link each.
 */

export interface LibraryGame {
  id: number;
  title: string;
  store: string;
  igdb_id: number | null;
  poster: string;
  artworks: string;
  released: string;
  companie: string;
  genre: string;
  description: string;
  trailer: string;
  store_url: string;
  owned_via: string;
  notes: string;
}

export interface LibraryGroup {
  /** Stable key for `v-for`; derived from the grouping identity, never the row id. */
  key: string;
  /** The entry whose metadata represents the group (see `pickPrimary`). */
  primary: LibraryGame;
  /** Every owned copy, ordered by store name. */
  entries: LibraryGame[];
  /** Distinct stores, ordered, for the badge row. */
  stores: string[];
  /** Metadata fields this group could not fill from IGDB. */
  missing: MissingField[];
}

export type MissingField = 'igdb' | 'poster' | 'released' | 'companie' | 'genre';

/** Human labels for the incomplete-data badge. */
export const MISSING_LABELS: Record<MissingField, string> = {
  igdb: 'IGDB',
  poster: 'Portada',
  released: 'Lanzamiento',
  companie: 'Compañía',
  genre: 'Género',
};

/**
 * Folds away the punctuation noise that makes the same game look like two:
 * curly vs straight quotes, `&` vs `and`, `:` vs `-`, casing and double spaces.
 * Only used when a row has no `igdb_id` to group by.
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

/**
 * `igdb_id` is the real identity of a game and already groups every existing
 * duplicate correctly. The normalized title is the fallback for rows IGDB never
 * resolved — exactly the rows the "incomplete" filter surfaces.
 */
export function groupKey(game: LibraryGame): string {
  return game.igdb_id != null ? `igdb:${game.igdb_id}` : `title:${normalizeTitle(game.title)}`;
}

/** Fields IGDB left empty. Drives both the card warning and the filter. */
export function missingFields(game: LibraryGame): MissingField[] {
  const missing: MissingField[] = [];
  if (game.igdb_id == null) missing.push('igdb');
  if (!game.poster) missing.push('poster');
  if (!game.released) missing.push('released');
  if (!game.companie) missing.push('companie');
  if (!game.genre) missing.push('genre');
  return missing;
}

/**
 * The copy whose metadata the card shows. Richest wins, so a fully resolved Epic
 * entry represents the group even when the Xbox one came in as a bare title.
 */
function pickPrimary(entries: LibraryGame[]): LibraryGame {
  return entries.reduce((best, candidate) =>
    missingFields(candidate).length < missingFields(best).length ? candidate : best,
  );
}

export function buildGroups(games: LibraryGame[]): LibraryGroup[] {
  const buckets = new Map<string, LibraryGame[]>();

  for (const game of games) {
    const key = groupKey(game);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(game);
    else buckets.set(key, [game]);
  }

  const groups: LibraryGroup[] = [];
  for (const [key, entries] of buckets) {
    const ordered = [...entries].sort((a, b) => a.store.localeCompare(b.store));
    const primary = pickPrimary(ordered);
    groups.push({
      key,
      primary,
      entries: ordered,
      stores: [...new Set(ordered.map((e) => e.store))],
      missing: missingFields(primary),
    });
  }

  return groups;
}
