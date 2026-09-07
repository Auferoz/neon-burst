/** Search / store / data-completeness filtering and sorting over grouped library entries. */
import type { LibraryGroup } from './libraryGrouping';

export type SortBy = 'title' | 'released' | 'recent' | 'stores';
export type DataFilter = 'all' | 'incomplete' | 'complete';

export interface LibraryFilterState {
  search: string;
  store: string;
  data: DataFilter;
  sort: SortBy;
}

/** DD/MM/YYYY -> timestamp, 0 when empty or unparsable. Same convention as playedGames. */
export function parseFecha(fecha: string): number {
  if (!fecha) return 0;
  const [d, m, y] = fecha.split('/');
  const time = new Date(`${y}-${m}-${d}`).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** Matches against every owned copy, so a note written on the GOG entry is still findable. */
function matchesSearch(group: LibraryGroup, query: string): boolean {
  return group.entries.some(
    (e) =>
      e.title.toLowerCase().includes(query) ||
      e.companie.toLowerCase().includes(query) ||
      e.genre.toLowerCase().includes(query) ||
      e.notes.toLowerCase().includes(query),
  );
}

export function filterAndSortGroups(
  groups: LibraryGroup[],
  state: LibraryFilterState,
): LibraryGroup[] {
  let result = groups;

  const query = state.search.trim().toLowerCase();
  if (query) result = result.filter((g) => matchesSearch(g, query));

  if (state.store) result = result.filter((g) => g.stores.includes(state.store));

  if (state.data === 'incomplete') result = result.filter((g) => g.missing.length > 0);
  else if (state.data === 'complete') result = result.filter((g) => g.missing.length === 0);

  return [...result].sort((a, b) => {
    switch (state.sort) {
      case 'title':
        return a.primary.title.localeCompare(b.primary.title);
      case 'released':
        return parseFecha(b.primary.released) - parseFecha(a.primary.released);
      case 'stores':
        // Most-owned first, alphabetical inside each tier so the order is stable.
        return b.stores.length - a.stores.length || a.primary.title.localeCompare(b.primary.title);
      case 'recent':
        return Math.max(...b.entries.map((e) => e.id)) - Math.max(...a.entries.map((e) => e.id));
    }
  });
}
