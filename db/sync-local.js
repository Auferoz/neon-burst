/**
 * Sync local D1 database from remote
 * Exports remote DB and imports it locally
 * Usage: npm run sync-local
 *
 * Every user table is dropped before the import — the list is read from the
 * local schema instead of being hardcoded, so a table added later is dropped
 * too. A stale list leaves old tables behind and the import fails on their
 * CREATE TABLE statements.
 *
 * Rows too large for a single local statement are split into an INSERT plus
 * chunked UPDATEs (see sqlDumpSplit.js). The split runs before anything is
 * dropped, so a dump it cannot handle leaves the local database untouched.
 *
 * This is a one-way overwrite: local data that is not in remote is lost.
 */

import { execSync as exec } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { splitOversizedStatements } from './sqlDumpSplit.js';

const BACKUP_FILE = 'db/backup.sql';
const DEFERRED_FILE = 'db/backup-deferred.sql';
// Local D1 rejects statements over ~100 KB; stay well under it.
const STATEMENT_LIMIT = 90_000;
const APPEND_CHUNK = 25_000;
const DB_NAME = 'neon-burst-db';

/** User tables in the local database, excluding SQLite and D1 internals. */
function localTables() {
  const output = exec(
    `npx wrangler d1 execute ${DB_NAME} --local --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\';" --json`,
    { encoding: 'utf-8', cwd: process.cwd() }
  );

  return JSON.parse(output)[0].results.map(r => r.name);
}

try {
  console.log('⬇ Exportando base de datos remota...');
  exec(`npx wrangler d1 export ${DB_NAME} --remote --output=${BACKUP_FILE}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  const { main, deferred } = splitOversizedStatements(
    readFileSync(BACKUP_FILE, 'utf-8').split('\n'),
    { limit: STATEMENT_LIMIT, chunk: APPEND_CHUNK }
  );
  writeFileSync(BACKUP_FILE, main.join('\n'));
  if (deferred.length > 0) {
    writeFileSync(DEFERRED_FILE, deferred.join('\n') + '\n');
    console.log(`\n✂ ${deferred.length} sentencias para filas demasiado grandes, van aparte.`);
  }

  const tables = localTables();

  if (tables.length === 0) {
    console.log('\n🗑 Base local vacía, nada que limpiar.');
  } else {
    console.log(`\n🗑 Limpiando base de datos local (${tables.length} tablas)...`);
    console.log(`   ${tables.join(', ')}`);
    // Reverse creation order drops child tables before the tables their foreign
    // keys point at; parent-first fails on the todo_* tables and aborts the batch.
    const drops = [...tables].reverse().map(t => `DROP TABLE IF EXISTS ${t};`).join(' ');
    exec(`npx wrangler d1 execute ${DB_NAME} --local --command "${drops}"`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  }

  console.log('\n⬆ Importando datos en local...');
  exec(`npx wrangler d1 execute ${DB_NAME} --local --file=${BACKUP_FILE}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  if (deferred.length > 0) {
    exec(`npx wrangler d1 execute ${DB_NAME} --local --file=${DEFERRED_FILE}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  }

  // Cleanup
  for (const file of [BACKUP_FILE, DEFERRED_FILE]) {
    if (existsSync(file)) unlinkSync(file);
  }

  console.log('\n✓ Base de datos local sincronizada con remoto.');
} catch (e) {
  console.error('\n✗ Error al sincronizar:', e.message);
  process.exit(1);
}
