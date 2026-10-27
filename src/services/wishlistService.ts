/**
 * D1 de la lista "Por comprar" (`wishlist`) + precios en vivo de la tienda de Steam.
 * Reglas puras (parseo, precios, orden) en `src/utils/wishlist.ts`.
 */

import {
  mapPriceOverview,
  parseSteamAppQuery,
  pickStoreSearchResult,
  STEAM_PRICE_CC,
  type PriceEntryRaw,
  type WishlistItem,
  type WishlistPrice,
} from '../utils/wishlist';

type WishlistRow = Omit<WishlistItem, 'price'>;

const COLUMNS = 'id, source, igdb_id, steam_appid, name, cover, image, release_date, release_label, created_at';

/** appdetails acepta varios appids solo con `filters=price_overview`; se pide en tandas. */
const PRICE_CHUNK = 50;

export async function fetchSteamPrices(appids: number[]): Promise<Map<number, WishlistPrice>> {
  const prices = new Map<number, WishlistPrice>();
  const chunks: number[][] = [];
  for (let i = 0; i < appids.length; i += PRICE_CHUNK) chunks.push(appids.slice(i, i + PRICE_CHUNK));

  await Promise.all(chunks.map(async chunk => {
    try {
      const res = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${chunk.join(',')}&cc=${STEAM_PRICE_CC}&filters=price_overview`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, PriceEntryRaw>;
      for (const appid of chunk) {
        const price = mapPriceOverview(data[appid]);
        if (price) prices.set(appid, price);
      }
    } catch {
      // Sin precio para esta tanda: las cards muestran "Sin precio".
    }
  }));

  return prices;
}

export async function listWishlist(db: D1Database): Promise<WishlistItem[]> {
  const { results } = await db.prepare(`SELECT ${COLUMNS} FROM wishlist`).all<WishlistRow>();
  const rows = results ?? [];
  const prices = await fetchSteamPrices(rows.flatMap(r => (r.steam_appid ? [r.steam_appid] : [])));
  return rows.map(r => ({ ...r, price: r.steam_appid ? prices.get(r.steam_appid) ?? null : null }));
}

/**
 * Copia un próximo juego recién destacado a la lista. OR IGNORE: si ya estaba
 * (como manual, por el mismo appid) no se duplica.
 */
export async function addFeaturedToWishlist(db: D1Database, igdbId: number): Promise<void> {
  await db.prepare(`
    INSERT OR IGNORE INTO wishlist (source, igdb_id, steam_appid, name, cover, release_date)
    SELECT 'featured', igdb_id, steam_appid, name, COALESCE(cover, ''), COALESCE(release_date, 0)
    FROM next_games_cache WHERE igdb_id = ?
  `).bind(igdbId).run();
}

/** Solo borra la copia del destacado: si además se agregó a mano, se queda. */
export async function removeFeaturedFromWishlist(db: D1Database, igdbId: number): Promise<void> {
  await db.prepare("DELETE FROM wishlist WHERE igdb_id = ? AND source = 'featured'").bind(igdbId).run();
}

/**
 * Tras el sync de IGDB: completa el appid de los destacados que no lo tenían.
 * Se saltea un appid que ya esté en la lista (agregado a mano) para no romper el UNIQUE.
 */
export async function backfillWishlistAppids(db: D1Database): Promise<void> {
  await db.prepare(`
    UPDATE wishlist
    SET steam_appid = (SELECT c.steam_appid FROM next_games_cache c WHERE c.igdb_id = wishlist.igdb_id)
    WHERE steam_appid IS NULL AND igdb_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM next_games_cache c
        WHERE c.igdb_id = wishlist.igdb_id AND c.steam_appid IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM wishlist w2 WHERE w2.steam_appid = c.steam_appid)
      )
  `).run();
}

export class WishlistDuplicateError extends Error {
  constructor() {
    super('Ese juego ya está en la lista');
  }
}

interface StoreAppRaw {
  success?: boolean;
  data?: {
    name?: string;
    header_image?: string;
    release_date?: { coming_soon?: boolean; date?: string };
    price_overview?: { initial: number; final: number; discount_percent: number };
  };
}

/** Lo que se guarda de un juego de la tienda en un alta manual. */
export interface SteamAppCandidate {
  steam_appid: number;
  name: string;
  image: string;
  release_label: string;
  price: WishlistPrice | null;
}

async function fetchStoreApp(appid: number): Promise<SteamAppCandidate | null> {
  const res = await fetch(
    `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=${STEAM_PRICE_CC}&l=spanish`,
  );
  const entry = ((await res.json()) as Record<string, StoreAppRaw>)[appid];
  if (!entry?.success || !entry.data?.name) return null;

  const d = entry.data;
  return {
    steam_appid: appid,
    name: d.name!,
    image: d.header_image ?? '',
    release_label: d.release_date?.date || (d.release_date?.coming_soon ? 'Próximamente' : ''),
    price: mapPriceOverview({ success: true, data: d }),
  };
}

interface StoreSearchRaw {
  items?: { id: number; name: string; tiny_image?: string; price?: { initial: number; final: number } }[];
}

async function searchStoreByTitle(term: string): Promise<SteamAppCandidate | null> {
  const res = await fetch(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&cc=${STEAM_PRICE_CC}&l=spanish`,
  );
  if (!res.ok) return null;
  const hit = pickStoreSearchResult(term, ((await res.json()) as StoreSearchRaw).items ?? []);
  if (!hit) return null;

  // La búsqueda no trae la fecha de salida (la usan los filtros): se completa con la ficha.
  const full = await fetchStoreApp(hit.id).catch(() => null);
  if (full) return full;

  const p = hit.price;
  return {
    steam_appid: hit.id,
    name: hit.name,
    image: hit.tiny_image ?? '',
    release_label: '',
    price: p ? { initial: p.initial, final: p.final, discount: p.initial > p.final ? Math.round((1 - p.final / p.initial) * 100) : 0 } : null,
  };
}

/**
 * Resuelve una línea del "Agregar lista": URL de la tienda o appid → appdetails;
 * cualquier otro texto → búsqueda por título. null si Steam no da nada.
 */
export async function lookupSteamApp(db: D1Database, query: string): Promise<(SteamAppCandidate & { already_added: boolean }) | null> {
  const appid = parseSteamAppQuery(query);
  const candidate = appid ? await fetchStoreApp(appid) : await searchStoreByTitle(query);
  if (!candidate) return null;

  const exists = await db.prepare('SELECT 1 FROM wishlist WHERE steam_appid = ?').bind(candidate.steam_appid).first();
  return { ...candidate, already_added: !!exists };
}

/** Alta manual por appid: trae nombre, imagen y fecha de la tienda. null si Steam no conoce el appid. */
export async function addManualToWishlist(db: D1Database, appid: number): Promise<WishlistItem | null> {
  const exists = await db.prepare('SELECT 1 FROM wishlist WHERE steam_appid = ?').bind(appid).first();
  if (exists) throw new WishlistDuplicateError();

  const app = await fetchStoreApp(appid);
  if (!app) return null;

  const row = await db.prepare(`
    INSERT INTO wishlist (source, steam_appid, name, image, release_label)
    VALUES ('manual', ?, ?, ?, ?)
    RETURNING ${COLUMNS}
  `).bind(appid, app.name, app.image, app.release_label).first<WishlistRow>();
  if (!row) return null;

  return { ...row, price: app.price };
}

export const WISHLIST_BULK_MAX = 100;

/**
 * Alta masiva del "Agregar lista". Recibe lo que el navegador ya resolvió con
 * `/api/wishlist/lookup` (resolver acá rompería el límite de subrequests del
 * Worker con listas largas). OR IGNORE: los que ya están se saltan.
 */
export async function addManyToWishlist(
  db: D1Database,
  games: Omit<SteamAppCandidate, 'price'>[],
): Promise<{ added: number; skipped: number }> {
  if (games.length === 0) return { added: 0, skipped: 0 };
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO wishlist (source, steam_appid, name, image, release_label) VALUES ('manual', ?, ?, ?, ?)",
  );
  const results = await db.batch(games.map(g => stmt.bind(g.steam_appid, g.name, g.image, g.release_label)));
  const added = results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
  return { added, skipped: games.length - added };
}

/**
 * Borra una entrada. Si era un destacado, también lo desmarca en
 * `next_games_featured` para que las dos vistas no se contradigan.
 */
export async function deleteWishlistItem(db: D1Database, id: number): Promise<{ igdb_id: number | null } | null> {
  const row = await db.prepare('SELECT source, igdb_id FROM wishlist WHERE id = ?')
    .bind(id).first<{ source: string; igdb_id: number | null }>();
  if (!row) return null;

  const ops = [db.prepare('DELETE FROM wishlist WHERE id = ?').bind(id)];
  if (row.source === 'featured' && row.igdb_id) {
    ops.push(db.prepare('DELETE FROM next_games_featured WHERE igdb_id = ?').bind(row.igdb_id));
  }
  await db.batch(ops);

  return { igdb_id: row.source === 'featured' ? row.igdb_id : null };
}
