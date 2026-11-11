/**
 * HowLongToBeat helpers for the Steam library cards (`SteamLibraryMain.vue`):
 * short time format and sorting by any of the three times.
 *
 * Pure module (no `cloudflare:workers`) so Vitest runs it in plain Node.
 */

export type HltbField = 'hltb_main' | 'hltb_extra' | 'hltb_completionist';
export type SortDir = 'asc' | 'desc';
export type HltbSortKey = `${HltbField}:${SortDir}`;

export type HltbTimes = Record<HltbField, number | null>;

export const HLTB_FIELDS: readonly HltbField[] = ['hltb_main', 'hltb_extra', 'hltb_completionist'];

function known(hours: number | null | undefined): hours is number {
  return typeof hours === 'number' && Number.isFinite(hours) && hours > 0;
}

/** Decimal hours → "12h 30m" / "45m"; no data → "—". */
export function formatHltbShort(hours: number | null | undefined): string {
  if (!known(hours)) return '—';
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function hasHltb(game: HltbTimes): boolean {
  return HLTB_FIELDS.some(f => known(game[f]));
}

/** Comparator by one HLTB time. Games without data always go last. */
export function compareHltb(a: HltbTimes, b: HltbTimes, field: HltbField, dir: SortDir): number {
  const va = a[field];
  const vb = b[field];
  const ka = known(va);
  const kb = known(vb);
  if (!ka && !kb) return 0;
  if (!ka) return 1;
  if (!kb) return -1;
  return dir === 'asc' ? va - vb : vb - va;
}

/** `"hltb_extra:desc"` → `{ field, dir }`; anything else → null. */
export function parseHltbSort(key: string): { field: HltbField; dir: SortDir } | null {
  const [field, dir] = key.split(':');
  if (!(HLTB_FIELDS as readonly string[]).includes(field)) return null;
  if (dir !== 'asc' && dir !== 'desc') return null;
  return { field: field as HltbField, dir };
}
