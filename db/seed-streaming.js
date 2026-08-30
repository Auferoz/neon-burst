/**
 * Seed streaming_accounts desde src/data/SSAccounts.js.
 *
 * Usage: node db/seed-streaming.js [--local | --remote]
 * Default: --local
 *
 * Escribe el SQL a un fichero temporal y lo pasa con `--file` en vez de
 * `--command`: las contraseñas llevan caracteres (#, -, _) que el shell de
 * Windows interpreta, y así tampoco acaban en los argumentos del proceso.
 *
 * Cuando termines, borra src/data/SSAccounts.js — D1 pasa a ser la fuente.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TARGET = process.argv.includes('--remote') ? '--remote' : '--local';

const esc = (str) => String(str ?? '').replace(/'/g, "''");

let accounts;
try {
  ({ StreamingServiceAccounts: accounts } = await import('../src/data/SSAccounts.js'));
} catch {
  console.error('No se pudo leer src/data/SSAccounts.js.');
  console.error('Si ya lo borraste, las cuentas viven en D1 y este seed no hace falta.');
  process.exit(1);
}

if (!Array.isArray(accounts) || accounts.length === 0) {
  console.error('SSAccounts.js no exporta ninguna cuenta.');
  process.exit(1);
}

const statements = accounts.map((account, index) => `
INSERT INTO streaming_accounts (name, url, logo, email, password, plan, sort_order)
VALUES ('${esc(account.name)}', '${esc(account.url)}', '${esc(account.logo)}', '${esc(account.email)}', '${esc(account.password)}', '${esc(account.plan)}', ${index})
ON CONFLICT(name) DO UPDATE SET
  url = excluded.url,
  logo = excluded.logo,
  email = excluded.email,
  password = excluded.password,
  plan = excluded.plan,
  sort_order = excluded.sort_order,
  updated_at = datetime('now');`.trim());

const tmpFile = join(tmpdir(), `nb-seed-streaming-${Date.now()}.sql`);
writeFileSync(tmpFile, statements.join('\n\n'), 'utf-8');

console.log(`Sembrando ${accounts.length} cuentas en D1 (${TARGET})...`);

try {
  execSync(
    `npx wrangler d1 execute neon-burst-db ${TARGET} --file "${tmpFile}"`,
    { encoding: 'utf-8', stdio: 'inherit' },
  );
  console.log(`\nListo. ${accounts.length} cuentas en streaming_accounts.`);
  console.log('Ahora puedes borrar src/data/SSAccounts.js.');
} catch (e) {
  console.error(`D1 error: ${e.message?.slice(0, 300)}`);
  process.exitCode = 1;
} finally {
  try { unlinkSync(tmpFile); } catch { /* ya no está */ }
}
