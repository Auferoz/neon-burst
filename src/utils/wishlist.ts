/**
 * Lista "Por comprar" de `/nextGames` (tabla `wishlist`).
 *
 * Módulo puro (sin `cloudflare:workers`) para que Vitest lo corra en Node. Lo
 * usan el sync de IGDB (`nextGamesSync.ts`), los endpoints de `/api/wishlist`
 * y los componentes de la pestaña.
 */

export type WishlistSource = 'featured' | 'manual';
export type WishlistSort = 'recent' | 'discount' | 'price';

/** Precio de Steam en centavos de la moneda de `STEAM_PRICE_CC` (CLP$ 34.240 → 3424000). */
export interface WishlistPrice {
  initial: number;
  final: number;
  discount: number;
}

export interface WishlistItem {
  id: number;
  source: WishlistSource;
  igdb_id: number | null;
  /** null mientras no se conozca (destacado que IGDB no vincula a Steam). */
  steam_appid: number | null;
  name: string;
  /** Portada vertical de IGDB (destacados); '' en los manuales. */
  cover: string;
  /** `header_image` de la tienda (manuales); '' en los destacados. */
  image: string;
  /** Unix de IGDB (destacados); 0 si no se conoce. */
  release_date: number;
  /** Texto de la tienda (manuales): "15 OCT 2026", "Próximamente"… */
  release_label: string;
  created_at: string;
  price: WishlistPrice | null;
}

/** País de la tienda para los precios. */
export const STEAM_PRICE_CC = 'cl';

const STEAM_SOURCE = 1;
const STEAM_WEBSITE_TYPE = 13;
const STORE_APP_RE = /^(?:https?:\/\/)?store\.steampowered\.com\/app\/(\d+)/i;

function positiveInt(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Appid pelado o URL de la tienda de Steam → appid. */
export function parseSteamAppQuery(query: string): number | null {
  const q = query.trim();
  if (/^\d+$/.test(q)) return positiveInt(q);
  return positiveInt(q.match(STORE_APP_RE)?.[1]);
}

/**
 * Campos de IGDB que vinculan un juego con Steam. Ojo: IGDB renombró
 * `websites.category` a `websites.type`; el viejo ya no viene.
 */
export interface IgdbSteamFields {
  external_games?: { uid?: string; external_game_source?: number }[];
  websites?: { url: string; type?: number }[];
}

function steamWebsite(game: IgdbSteamFields): string {
  return game.websites?.find(w => w.type === STEAM_WEBSITE_TYPE)?.url ?? '';
}

export function steamAppidFromIgdb(game: IgdbSteamFields): number | null {
  const external = game.external_games?.find(e => e.external_game_source === STEAM_SOURCE);
  return positiveInt(external?.uid) ?? parseSteamAppQuery(steamWebsite(game));
}

export function steamUrlFromIgdb(game: IgdbSteamFields): string {
  const site = steamWebsite(game);
  if (site) return site;
  const appid = steamAppidFromIgdb(game);
  return appid ? `https://store.steampowered.com/app/${appid}` : '';
}

/** Una entrada de `appdetails?filters=price_overview`. Sin precio (gratis, sin lanzar) llega `data: []`. */
export interface PriceEntryRaw {
  success?: boolean;
  data?: { price_overview?: { initial: number; final: number; discount_percent: number } } | unknown[];
}

export function mapPriceOverview(entry: PriceEntryRaw | undefined): WishlistPrice | null {
  if (!entry?.success || !entry.data || Array.isArray(entry.data)) return null;
  const p = entry.data.price_overview;
  if (!p) return null;
  return { initial: p.initial, final: p.final, discount: p.discount_percent };
}

const normalizeName = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const EXTRA_CONTENT_RE = /\b(soundtrack|ost|dlc|pack|season pass|artbook|bundle)\b/i;

/**
 * Elige el juego de una búsqueda por título en la tienda (`storesearch`): el de
 * nombre exacto; si no hay, el primero que no sea soundtrack/DLC/pack; si no,
 * el primero. Steam suele poner el juego primero, pero no siempre.
 */
export function pickStoreSearchResult<T extends { id: number; name: string }>(term: string, items: T[]): T | null {
  const target = normalizeName(term);
  return items.find(i => normalizeName(i.name) === target)
    ?? items.find(i => !EXTRA_CONTENT_RE.test(i.name))
    ?? items[0]
    ?? null;
}

/** Texto pegado (un juego por línea) → líneas limpias, sin repetidas, como mucho `max`. */
export function parseWishlistLines(raw: string, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const value = line.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length === max) break;
  }
  return out;
}

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

/** Centavos de Steam → "$34.240". */
export function formatClp(cents: number): string {
  return clp.format(Math.round(cents / 100));
}

export function wishlistSummary(items: WishlistItem[]): { total: number; priced: number; onSale: number } {
  let total = 0, priced = 0, onSale = 0;
  for (const i of items) {
    if (!i.price) continue;
    total += i.price.final;
    priced++;
    if (i.price.discount > 0) onSale++;
  }
  return { total, priced, onSale };
}

export function sortWishlist(items: WishlistItem[], sort: WishlistSort): WishlistItem[] {
  const out = [...items];
  if (sort === 'recent') return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  // Sin precio siempre al final.
  const key = (i: WishlistItem) =>
    !i.price ? Infinity : sort === 'discount' ? -i.price.discount : i.price.final;
  return out.sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name, 'es'));
}

// ── Filtros de la pestaña ──

const STEAM_MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11,
};

/**
 * Fecha de la tienda en español ("18 ABR 2011") → unix UTC + año. Sin fecha
 * completa ("2027", "T1 2027") queda solo el año (`date: 0`); sin año
 * ("Próximamente"), null.
 */
export function parseSteamReleaseLabel(label: string): { date: number; year: number } | null {
  const full = label.trim().match(/^(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4})$/i);
  if (full) {
    const month = STEAM_MONTHS[full[2].toLowerCase()];
    const year = Number(full[3]);
    if (month !== undefined) return { date: Date.UTC(year, month, Number(full[1])) / 1000, year };
  }
  const year = label.match(/\b(\d{4})\b/);
  return year ? { date: 0, year: Number(year[1]) } : null;
}

export type ReleaseState = 'released' | 'upcoming' | 'unknown';

/**
 * Año y estado de salida de un juego de la lista: primero la fecha de IGDB
 * (destacados), si no el texto de la tienda (manuales). Con solo el año, el
 * año en curso no alcanza para saber si ya salió.
 */
export function releaseInfo(item: WishlistItem, now: number): { year: number | null; state: ReleaseState } {
  const parsed = item.release_date
    ? { date: item.release_date, year: new Date(item.release_date * 1000).getUTCFullYear() }
    : parseSteamReleaseLabel(item.release_label);

  if (!parsed) return { year: null, state: item.release_label ? 'upcoming' : 'unknown' };
  if (parsed.date) return { year: parsed.year, state: parsed.date <= now ? 'released' : 'upcoming' };

  const currentYear = new Date(now * 1000).getUTCFullYear();
  const state = parsed.year < currentYear ? 'released' : parsed.year > currentYear ? 'upcoming' : 'unknown';
  return { year: parsed.year, state };
}

/** Rangos de precio en pesos (los precios vienen en centavos). */
export const PRICE_BUCKETS = [
  { value: '0-5', label: 'Hasta $5.000', min: 0, max: 5000 },
  { value: '5-15', label: '$5.000 – $15.000', min: 5000, max: 15000 },
  { value: '15-30', label: '$15.000 – $30.000', min: 15000, max: 30000 },
  { value: '30+', label: 'Más de $30.000', min: 30000, max: Infinity },
] as const;

export type PriceFilter = '' | 'none' | (typeof PRICE_BUCKETS)[number]['value'];

export interface WishlistFilters {
  query: string;
  price: PriceFilter;
  onSale: boolean;
  /** '' todos, 'released', 'upcoming' o un año ("2026"). */
  release: string;
}

export function defaultWishlistFilters(): WishlistFilters {
  return { query: '', price: '', onSale: false, release: '' };
}

export function hasActiveWishlistFilters(f: WishlistFilters): boolean {
  return f.query.trim() !== '' || f.price !== '' || f.onSale || f.release !== '';
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function matchesPrice(item: WishlistItem, price: PriceFilter): boolean {
  if (!price) return true;
  if (price === 'none') return !item.price;
  if (!item.price) return false;
  const bucket = PRICE_BUCKETS.find(b => b.value === price)!;
  const pesos = item.price.final / 100;
  return pesos >= bucket.min && pesos < bucket.max;
}

export function filterWishlist(items: WishlistItem[], f: WishlistFilters, now: number): WishlistItem[] {
  const q = fold(f.query.trim());
  return items.filter(item => {
    if (q && !fold(item.name).includes(q)) return false;
    if (!matchesPrice(item, f.price)) return false;
    if (f.onSale && !(item.price && item.price.discount > 0)) return false;
    if (f.release) {
      const info = releaseInfo(item, now);
      if (f.release === 'released' || f.release === 'upcoming') return info.state === f.release;
      return info.year === Number(f.release);
    }
    return true;
  });
}

/** Años de salida presentes en la lista, del más nuevo al más viejo. */
export function wishlistReleaseYears(items: WishlistItem[], now: number): number[] {
  const years = new Set<number>();
  for (const item of items) {
    const { year } = releaseInfo(item, now);
    if (year) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}
