/**
 * Steam raffle ("Sortear") — pure logic. No `cloudflare:workers`, no DOM, so
 * Vitest can exercise it directly (same pattern as `search.ts`).
 *
 * The components own state and rendering; everything decidable lives here:
 * filter semantics, genre normalization, the unbiased winner pick and the
 * reel's tick schedule.
 */

export interface RaffleGame {
  appid: number;
  name: string;
  /** Comma + space separated store genres (Spanish). */
  genres: string;
  poster: string;
  /** Minutes. */
  playtime: number;
  hltb_main: number | null;
  /** 'full' | 'partial' | 'none' | '' (unknown). */
  controller_support: string;
  /** Comma-separated Steam category ids. */
  categories: string;
  metacritic: number | null;
}

export interface RaffleList {
  id: number;
  name: string;
  appids: number[];
}

export type ControlKey = 'full' | 'partial' | 'none';
export type ModeKey = 'single' | 'multi' | 'coop';
export type DurationKey = 'lt5' | '5-15' | '15-30' | '30-60' | '60plus';
export type PlayStateKey = 'unplayed' | 'tried' | 'played';
export type MetacriticMin = 0 | 70 | 80 | 90;

export interface RaffleFilters {
  genres: string[];
  controls: ControlKey[];
  modes: ModeKey[];
  durations: DurationKey[];
  /** Only relevant while at least one duration chip is selected. */
  includeUnknownDuration: boolean;
  states: PlayStateKey[];
  minMetacritic: MetacriticMin;
  /** Selected list id, or null for the whole library. */
  listId: number | null;
  name: string;
}

export function defaultFilters(): RaffleFilters {
  return {
    genres: [],
    controls: [],
    modes: [],
    durations: [],
    includeUnknownDuration: true,
    states: [],
    minMetacritic: 0,
    listId: null,
    name: '',
  };
}

export function hasActiveFilters(f: RaffleFilters): boolean {
  const d = defaultFilters();
  return (
    f.genres.length > 0 ||
    f.controls.length > 0 ||
    f.modes.length > 0 ||
    f.durations.length > 0 ||
    f.states.length > 0 ||
    f.includeUnknownDuration !== d.includeUnknownDuration ||
    f.minMetacritic !== d.minMetacritic ||
    f.listId !== d.listId ||
    f.name.trim() !== ''
  );
}

const CONTROL_KEYS: readonly ControlKey[] = ['full', 'partial', 'none'];
const MODE_KEYS: readonly ModeKey[] = ['single', 'multi', 'coop'];
const DURATION_KEYS: readonly DurationKey[] = ['lt5', '5-15', '15-30', '30-60', '60plus'];
const STATE_KEYS: readonly PlayStateKey[] = ['unplayed', 'tried', 'played'];
const METACRITIC_MINS: readonly MetacriticMin[] = [0, 70, 80, 90];

function pickKnown<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return allowed.filter(k => value.includes(k));
}

/** Rebuilds filters read from localStorage: anything unexpected falls back to the default. */
export function sanitizeFilters(raw: unknown): RaffleFilters {
  const d = defaultFilters();
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  return {
    genres: Array.isArray(r.genres) ? r.genres.filter((g): g is string => typeof g === 'string') : [],
    controls: pickKnown(r.controls, CONTROL_KEYS),
    modes: pickKnown(r.modes, MODE_KEYS),
    durations: pickKnown(r.durations, DURATION_KEYS),
    includeUnknownDuration:
      typeof r.includeUnknownDuration === 'boolean' ? r.includeUnknownDuration : d.includeUnknownDuration,
    states: pickKnown(r.states, STATE_KEYS),
    minMetacritic: METACRITIC_MINS.includes(r.minMetacritic as MetacriticMin)
      ? (r.minMetacritic as MetacriticMin)
      : d.minMetacritic,
    listId: typeof r.listId === 'number' && Number.isInteger(r.listId) ? r.listId : null,
    name: typeof r.name === 'string' ? r.name : '',
  };
}

// ── Text ──

/** Lowercase, accent-insensitive, trimmed. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// ── Genres ──

const GENRE_ALIASES: Record<string, string> = {
  'role-playing (rpg)': 'Rol',
  adventure: 'Aventura',
};

/** Store categories that are software, not games: never offered as a genre. */
const JUNK_GENRES = new Set(
  ['Animación y modelado', 'Diseño e ilustración', 'Edición fotográfica', 'Utilidades'].map(normalizeText),
);

export function normalizeGenres(genresText: string | null | undefined): string[] {
  if (!genresText) return [];
  const out: string[] = [];
  for (const raw of genresText.split(',')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = normalizeText(trimmed);
    if (JUNK_GENRES.has(key)) continue;
    const genre = GENRE_ALIASES[key] ?? trimmed;
    if (!out.includes(genre)) out.push(genre);
  }
  return out;
}

export interface GenreCount {
  name: string;
  count: number;
}

/** Normalized genres present in the library, most frequent first (ties by name). */
export function availableGenres(games: readonly Pick<RaffleGame, 'genres'>[]): GenreCount[] {
  const counts = new Map<string, number>();
  for (const g of games) {
    for (const name of normalizeGenres(g.genres)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
}

// ── Buckets ──

export const DURATION_RANGES: Record<DurationKey, { min: number; max: number }> = {
  lt5: { min: 0, max: 5 },
  '5-15': { min: 5, max: 15 },
  '15-30': { min: 15, max: 30 },
  '30-60': { min: 30, max: 60 },
  '60plus': { min: 60, max: Infinity },
};

/** Half-open ranges [min, max). Null when the duration is unknown. */
export function durationBucket(hours: number | null | undefined): DurationKey | null {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null;
  for (const key of Object.keys(DURATION_RANGES) as DurationKey[]) {
    const { min, max } = DURATION_RANGES[key];
    if (hours >= min && hours < max) return key;
  }
  return null;
}

export const TRIED_LIMIT_MINUTES = 120;

export function playState(playtimeMinutes: number): PlayStateKey {
  if (playtimeMinutes <= 0) return 'unplayed';
  if (playtimeMinutes < TRIED_LIMIT_MINUTES) return 'tried';
  return 'played';
}

export function parseCategories(text: string | null | undefined): number[] {
  if (!text) return [];
  return text
    .split(',')
    .map(s => s.trim())
    .filter(s => /^\d+$/.test(s))
    .map(Number);
}

/** Steam category ids behind each mode chip. */
export const MODE_CATEGORY: Record<ModeKey, number> = {
  single: 2,
  multi: 1,
  coop: 9,
};

// ── Filtering ──

export function matchesFilters(
  game: RaffleGame,
  f: RaffleFilters,
  listAppids: ReadonlySet<number> | null,
): boolean {
  if (listAppids && !listAppids.has(game.appid)) return false;

  const query = normalizeText(f.name);
  if (query && !normalizeText(game.name).includes(query)) return false;

  if (f.genres.length > 0) {
    const own = normalizeGenres(game.genres);
    if (!f.genres.some(g => own.includes(g))) return false;
  }

  if (f.controls.length > 0) {
    if (!(f.controls as string[]).includes(game.controller_support)) return false;
  }

  if (f.modes.length > 0) {
    const cats = parseCategories(game.categories);
    if (!f.modes.some(m => cats.includes(MODE_CATEGORY[m]))) return false;
  }

  if (f.durations.length > 0) {
    const bucket = durationBucket(game.hltb_main);
    if (bucket === null) {
      if (!f.includeUnknownDuration) return false;
    } else if (!f.durations.includes(bucket)) {
      return false;
    }
  }

  if (f.states.length > 0 && !f.states.includes(playState(game.playtime))) return false;

  if (f.minMetacritic > 0) {
    if (game.metacritic == null || game.metacritic < f.minMetacritic) return false;
  }

  return true;
}

export function filterPool(
  games: readonly RaffleGame[],
  f: RaffleFilters,
  lists: readonly RaffleList[],
  excluded: ReadonlySet<number>,
): RaffleGame[] {
  // A stale list id (deleted list) falls back to the whole library.
  const list = f.listId == null ? undefined : lists.find(l => l.id === f.listId);
  const listAppids = list ? new Set(list.appids) : null;
  return games.filter(g => !excluded.has(g.appid) && matchesFilters(g, f, listAppids));
}

// ── Winner + reel ──

const UINT32_RANGE = 0x100000000;

/**
 * Unbiased index in [0, length) from a uint32 source. Values in the incomplete
 * tail block (which would over-represent low indexes) are rejected and redrawn.
 */
export function pickWinnerIndex(length: number, randomUint32: () => number): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('pickWinnerIndex: length must be a positive integer');
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % length);
  let r = randomUint32();
  while (r >= limit) r = randomUint32();
  return r % length;
}

/** Production RNG for `pickWinnerIndex`. */
export function cryptoUint32(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

export interface ReelStep {
  index: number;
  delayMs: number;
}

/**
 * Tick schedule for the reel: `ticks` consecutive pool indexes (wrapping)
 * ending exactly on `winnerIndex`, with non-decreasing delays (ease-out)
 * that add up to `totalMs`.
 */
export function buildReelSchedule(
  poolLength: number,
  winnerIndex: number,
  opts: { ticks: number; totalMs: number },
): ReelStep[] {
  const { ticks, totalMs } = opts;
  if (!Number.isInteger(poolLength) || poolLength <= 0) throw new Error('buildReelSchedule: empty pool');
  if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= poolLength) {
    throw new Error('buildReelSchedule: winner outside the pool');
  }
  if (!Number.isInteger(ticks) || ticks < 1) throw new Error('buildReelSchedule: ticks must be >= 1');

  // Quadratic growth: fast at the start, slow enough at the end to build tension.
  const weights: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const t = ticks === 1 ? 0 : i / (ticks - 1);
    weights.push(1 + 11 * t * t);
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);

  return weights.map((w, i) => ({
    index: (((winnerIndex - (ticks - 1 - i)) % poolLength) + poolLength) % poolLength,
    delayMs: (w / weightSum) * totalMs,
  }));
}

// ── Labels (shared by the raffle components) ──

export const CONTROL_LABELS: Record<ControlKey, string> = {
  full: 'Mando completo',
  partial: 'Mando parcial',
  none: 'Mouse y teclado',
};

export function controllerLabel(support: string): string {
  return (CONTROL_LABELS as Record<string, string>)[support] ?? 'Sin dato de control';
}
