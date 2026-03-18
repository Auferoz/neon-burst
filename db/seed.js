/**
 * Seed script — Genera seed.sql a partir de gamesDB.js
 * Uso: node db/seed.js
 */
import { ListGames } from '../src/data/gamesDB.js';
import { writeFileSync } from 'node:fs';

const escape = (str) => str ? str.replace(/'/g, "''") : '';

const lines = [];

for (const game of ListGames) {
  const title = escape(game.title);
  const released = escape(game.released);
  const companie = escape(game.companie);
  const poster = escape(game.poster);
  const trailer = escape(game.trailer);
  const artworks = escape(game.artworks);
  const genre = escape(game.genre);
  const estado = escape(game.estado);
  const logrosObt = game.logros_obt ?? 0;
  const logrosTotal = game.logros_total ?? 0;
  const consolePc = escape(game.console_pc);
  const igdbId = game.igdbId ?? 'NULL';
  const firstYear = game.first_year_played ?? 'NULL';
  const description = escape(game.description || '');

  lines.push(
    `INSERT OR IGNORE INTO games (title, released, companie, poster, trailer, artworks, genre, estado, logros_obt, logros_total, console_pc, igdb_id, first_year_played, description) VALUES ('${title}', '${released}', '${companie}', '${poster}', '${trailer}', '${artworks}', '${genre}', '${estado}', ${logrosObt}, ${logrosTotal}, '${consolePc}', ${igdbId}, ${firstYear}, '${description}');`
  );

  // Insert dates_played entries (only years with actual data)
  if (game.dates_played) {
    for (const [yearKey, data] of Object.entries(game.dates_played)) {
      const year = parseInt(yearKey.replace('y', ''));
      if (data.fecha_inicio || data.fecha_final || (data.horas && data.horas !== '')) {
        const fi = escape(data.fecha_inicio);
        const ff = escape(data.fecha_final);
        const h = parseFloat(data.horas) || 0;
        lines.push(
          `INSERT OR IGNORE INTO dates_played (game_id, year, fecha_inicio, fecha_final, horas) VALUES ((SELECT id FROM games WHERE title = '${title}'), ${year}, '${fi}', '${ff}', ${h});`
        );
      }
    }
  }
}

const sql = lines.join('\n');
writeFileSync(new URL('./seed.sql', import.meta.url), sql, 'utf-8');
console.log(`Generated seed.sql with ${lines.length} statements for ${ListGames.length} games.`);
