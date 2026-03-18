/**
 * Games service — D1 database queries
 */

export interface Game {
  id: number;
  title: string;
  released: string;
  companie: string;
  poster: string;
  trailer: string;
  artworks: string;
  genre: string;
  estado: string;
  horas_total: number;
  logros_obt: number;
  logros_total: number;
  console_pc: string;
  igdb_id: number | null;
  first_year_played: number | null;
  description: string;
  rating_metacritic: number | null;
  rating_rawg: number | null;
  created_at: string;
  updated_at: string;
}

export interface DatePlayed {
  id: number;
  game_id: number;
  year: number;
  fecha_inicio: string;
  fecha_final: string;
  horas: number;
}

export interface GameWithYears extends Game {
  years_played: number[];
}

export interface GameWithDates extends Game {
  dates_played: DatePlayed[];
}

export async function getAllGames(db: D1Database): Promise<GameWithYears[]> {
  const { results: games } = await db.prepare(
    'SELECT * FROM games ORDER BY title ASC'
  ).all<Game>();

  const { results: yearRows } = await db.prepare(
    'SELECT game_id, year FROM dates_played ORDER BY year DESC'
  ).all<{ game_id: number; year: number }>();

  const yearsByGame = new Map<number, number[]>();
  for (const row of yearRows) {
    const arr = yearsByGame.get(row.game_id) || [];
    arr.push(row.year);
    yearsByGame.set(row.game_id, arr);
  }

  return games.map(g => ({
    ...g,
    years_played: yearsByGame.get(g.id) || [],
  }));
}

export async function getGameById(db: D1Database, id: number): Promise<GameWithDates | null> {
  const game = await db.prepare(
    'SELECT * FROM games WHERE id = ?'
  ).bind(id).first<Game>();

  if (!game) return null;

  const { results: dates } = await db.prepare(
    'SELECT * FROM dates_played WHERE game_id = ? ORDER BY year DESC'
  ).bind(id).all<DatePlayed>();

  return { ...game, dates_played: dates };
}

export async function createGame(
  db: D1Database,
  data: Partial<Omit<Game, 'id' | 'created_at' | 'updated_at'>> & { title: string; estado: string; dates_played?: Omit<DatePlayed, 'id' | 'game_id'>[] }
): Promise<GameWithDates> {
  const result = await db.prepare(`
    INSERT INTO games (title, released, companie, poster, trailer, artworks, genre, estado, horas_total, logros_obt, logros_total, console_pc, igdb_id, first_year_played, description, rating_metacritic, rating_rawg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.title, data.released || '', data.companie || '', data.poster || '', data.trailer || '',
    data.artworks || '', data.genre || '', data.estado, data.horas_total || 0, data.logros_obt || 0,
    data.logros_total || 0, data.console_pc || '', data.igdb_id || null, data.first_year_played || null,
    data.description || '', data.rating_metacritic || null, data.rating_rawg || null
  ).run();

  const gameId = result.meta.last_row_id;

  if (data.dates_played?.length) {
    for (const d of data.dates_played) {
      await db.prepare(
        'INSERT OR IGNORE INTO dates_played (game_id, year, fecha_inicio, fecha_final, horas) VALUES (?, ?, ?, ?, ?)'
      ).bind(gameId, d.year, d.fecha_inicio || '', d.fecha_final || '', d.horas || 0).run();
    }
  }

  return (await getGameById(db, gameId as number))!;
}

export async function updateGame(
  db: D1Database,
  id: number,
  data: Partial<Omit<Game, 'id' | 'created_at' | 'updated_at'>> & { dates_played?: Omit<DatePlayed, 'id' | 'game_id'>[] }
): Promise<GameWithDates | null> {
  const { dates_played, ...gameData } = data;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(gameData)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(id);
    await db.prepare(
      `UPDATE games SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();
  }

  if (dates_played !== undefined) {
    await db.prepare('DELETE FROM dates_played WHERE game_id = ?').bind(id).run();
    for (const d of dates_played) {
      await db.prepare(
        'INSERT INTO dates_played (game_id, year, fecha_inicio, fecha_final, horas) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, d.year, d.fecha_inicio || '', d.fecha_final || '', d.horas || 0).run();
    }
  }

  return getGameById(db, id);
}

export async function deleteGame(db: D1Database, id: number): Promise<boolean> {
  await db.prepare('DELETE FROM dates_played WHERE game_id = ?').bind(id).run();
  const result = await db.prepare('DELETE FROM games WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}
