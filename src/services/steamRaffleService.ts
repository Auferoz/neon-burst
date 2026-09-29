/**
 * D1 CRUD for the Steam raffle lists (`steam_raffle_lists` +
 * `steam_raffle_list_items`). Items only store the `steam_cache.appid`; the
 * UI resolves names/posters from the library it already has loaded.
 */

export interface RaffleListRow {
  id: number;
  name: string;
  appids: number[];
}

export const RAFFLE_LIST_NAME_MAX = 60;

export const DUPLICATE_LIST_NAME_MESSAGE = 'Ya existe una lista con ese nombre';

/** Trimmed name of 1-60 chars, or null when invalid. */
export function validateListName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (name.length < 1 || name.length > RAFFLE_LIST_NAME_MAX) return null;
  return name;
}

/** True when a write hit the unique (name COLLATE NOCASE) index. */
export function isDuplicateListNameError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return message.includes('UNIQUE constraint failed');
}

export async function getRaffleLists(db: D1Database): Promise<RaffleListRow[]> {
  const [{ results: lists }, { results: items }] = await Promise.all([
    db.prepare('SELECT id, name FROM steam_raffle_lists ORDER BY name COLLATE NOCASE ASC')
      .all<{ id: number; name: string }>(),
    db.prepare('SELECT list_id, appid FROM steam_raffle_list_items ORDER BY added_at ASC, appid ASC')
      .all<{ list_id: number; appid: number }>(),
  ]);

  const byList = new Map<number, number[]>();
  for (const item of items ?? []) {
    const arr = byList.get(item.list_id);
    if (arr) arr.push(item.appid);
    else byList.set(item.list_id, [item.appid]);
  }

  return (lists ?? []).map(l => ({ id: l.id, name: l.name, appids: byList.get(l.id) ?? [] }));
}

async function getListById(db: D1Database, id: number): Promise<RaffleListRow | null> {
  const list = await db.prepare('SELECT id, name FROM steam_raffle_lists WHERE id = ?')
    .bind(id).first<{ id: number; name: string }>();
  if (!list) return null;
  const { results } = await db.prepare(
    'SELECT appid FROM steam_raffle_list_items WHERE list_id = ? ORDER BY added_at ASC, appid ASC'
  ).bind(id).all<{ appid: number }>();
  return { id: list.id, name: list.name, appids: (results ?? []).map(r => r.appid) };
}

/** Throws the UNIQUE constraint error on a duplicate name (see `isDuplicateListNameError`). */
export async function createList(db: D1Database, name: string): Promise<RaffleListRow> {
  const result = await db.prepare('INSERT INTO steam_raffle_lists (name) VALUES (?)')
    .bind(name).run();
  const id = result.meta.last_row_id as number;
  return { id, name, appids: [] };
}

/** Returns the updated list, or null when the id doesn't exist. Throws on duplicate name. */
export async function renameList(db: D1Database, id: number, name: string): Promise<RaffleListRow | null> {
  const result = await db.prepare('UPDATE steam_raffle_lists SET name = ? WHERE id = ?')
    .bind(name, id).run();
  if (!result.meta.changes) return null;
  return getListById(db, id);
}

/** Items are deleted explicitly: D1 foreign-key enforcement is not relied upon. */
export async function deleteList(db: D1Database, id: number): Promise<boolean> {
  const [, listResult] = await db.batch([
    db.prepare('DELETE FROM steam_raffle_list_items WHERE list_id = ?').bind(id),
    db.prepare('DELETE FROM steam_raffle_lists WHERE id = ?').bind(id),
  ]);
  return (listResult.meta.changes ?? 0) > 0;
}

export async function listExists(db: D1Database, id: number): Promise<boolean> {
  const row = await db.prepare('SELECT 1 AS ok FROM steam_raffle_lists WHERE id = ?')
    .bind(id).first<{ ok: number }>();
  return !!row;
}

export async function addItem(db: D1Database, listId: number, appid: number): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO steam_raffle_list_items (list_id, appid) VALUES (?, ?)')
    .bind(listId, appid).run();
}

export async function removeItem(db: D1Database, listId: number, appid: number): Promise<void> {
  await db.prepare('DELETE FROM steam_raffle_list_items WHERE list_id = ? AND appid = ?')
    .bind(listId, appid).run();
}

export async function steamGameExists(db: D1Database, appid: number): Promise<boolean> {
  const row = await db.prepare('SELECT 1 AS ok FROM steam_cache WHERE appid = ?')
    .bind(appid).first<{ ok: number }>();
  return !!row;
}
