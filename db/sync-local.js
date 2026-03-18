/**
 * Sync local D1 database from remote
 * Exports remote DB and imports it locally
 * Usage: node db/sync-local.js
 */

import { execSync as exec } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';

const BACKUP_FILE = 'db/backup.sql';
const DB_NAME = 'neon-burst-db';

try {
  console.log('⬇ Exportando base de datos remota...');
  exec(`npx wrangler d1 export ${DB_NAME} --remote --output=${BACKUP_FILE}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('\n🗑 Limpiando base de datos local...');
  exec(
    `npx wrangler d1 execute ${DB_NAME} --local --command "DROP TABLE IF EXISTS dates_played; DROP TABLE IF EXISTS games;"`,
    { stdio: 'inherit', cwd: process.cwd() }
  );

  console.log('\n⬆ Importando datos en local...');
  exec(`npx wrangler d1 execute ${DB_NAME} --local --file=${BACKUP_FILE}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  // Cleanup
  if (existsSync(BACKUP_FILE)) {
    unlinkSync(BACKUP_FILE);
  }

  console.log('\n✓ Base de datos local sincronizada con remoto.');
} catch (e) {
  console.error('\n✗ Error al sincronizar:', e.message);
  process.exit(1);
}
