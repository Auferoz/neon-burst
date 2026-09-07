/**
 * Library service — D1 queries for the multi-store game library (Steam excluded).
 */
import { isStore } from '../data/stores';

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
  created_at: string;
  updated_at: string;
}

export type LibraryGameInput = Partial<Omit<LibraryGame, 'id' | 'created_at' | 'updated_at'>> & {
  title: string;
  store: string;
};

/** Columns an UPDATE is allowed to touch. Mirrors gamesService's whitelist approach. */
const UPDATABLE_COLUMNS = new Set([
  'title', 'store', 'igdb_id', 'poster', 'artworks', 'released', 'companie',
  'genre', 'description', 'trailer', 'store_url', 'owned_via', 'notes',
]);

export async function getAllLibraryGames(db: D1Database): Promise<LibraryGame[]> {
  const { results } = await db
    .prepare('SELECT * FROM library_games ORDER BY title COLLATE NOCASE ASC')
    .all<LibraryGame>();
  return results ?? [];
}

export async function getLibraryGameById(db: D1Database, id: number): Promise<LibraryGame | null> {
  return await db
    .prepare('SELECT * FROM library_games WHERE id = ?')
    .bind(id)
    .first<LibraryGame>();
}

export async function createLibraryGame(
  db: D1Database,
  data: LibraryGameInput,
): Promise<LibraryGame> {
  const result = await db
    .prepare(
      `INSERT INTO library_games
        (title, store, igdb_id, poster, artworks, released, companie, genre,
         description, trailer, store_url, owned_via, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.title,
      data.store,
      data.igdb_id ?? null,
      data.poster ?? '',
      data.artworks ?? '',
      data.released ?? '',
      data.companie ?? '',
      data.genre ?? '',
      data.description ?? '',
      data.trailer ?? '',
      data.store_url ?? '',
      data.owned_via ?? 'Compra',
      data.notes ?? '',
    )
    .run();

  const created = await getLibraryGameById(db, result.meta.last_row_id as number);
  if (!created) throw new Error('Failed to read back the created library game');
  return created;
}

export async function updateLibraryGame(
  db: D1Database,
  id: number,
  data: Partial<LibraryGameInput>,
): Promise<LibraryGame | null> {
  const entries = Object.entries(data).filter(
    ([key, value]) => UPDATABLE_COLUMNS.has(key) && value !== undefined,
  );

  if (entries.length > 0) {
    const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
    await db
      .prepare(`UPDATE library_games SET ${setClause}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...entries.map(([, value]) => value), id)
      .run();
  }

  return getLibraryGameById(db, id);
}

export async function deleteLibraryGame(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM library_games WHERE id = ?').bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Insert many rows in one D1 batch.
 *
 * Uses INSERT OR IGNORE so the unique (store, title) index silently absorbs rows
 * already in the library — re-running the same import is safe. `skipped` is the
 * difference between what was sent and what actually landed.
 */
export async function bulkInsertLibraryGames(
  db: D1Database,
  rows: LibraryGameInput[],
): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  const statement = db.prepare(
    `INSERT OR IGNORE INTO library_games
      (title, store, igdb_id, poster, artworks, released, companie, genre,
       description, trailer, store_url, owned_via, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const results = await db.batch(
    rows.map((row) =>
      statement.bind(
        row.title,
        row.store,
        row.igdb_id ?? null,
        row.poster ?? '',
        row.artworks ?? '',
        row.released ?? '',
        row.companie ?? '',
        row.genre ?? '',
        row.description ?? '',
        row.trailer ?? '',
        row.store_url ?? '',
        row.owned_via ?? 'Compra',
        row.notes ?? '',
      ),
    ),
  );

  const inserted = results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
  return { inserted, skipped: rows.length - inserted };
}

/**
 * Validates one incoming row. Shared by POST /api/library and the bulk import so
 * both reject the same shapes. Returns an error message, or null when usable.
 */
export function validateLibraryRow(row: unknown): string | null {
  if (typeof row !== 'object' || row === null) return 'Cada entrada debe ser un objeto';
  const { title, store } = row as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim()) return 'El campo "title" es obligatorio';
  if (typeof store !== 'string' || !store.trim()) return 'El campo "store" es obligatorio';
  if (!isStore(store)) return `Tienda desconocida: "${store}"`;
  return null;
}
