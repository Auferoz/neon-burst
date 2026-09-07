import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { bulkInsertLibraryGames, validateLibraryRow } from '../../../services/libraryService';

export const prerender = false;

/** Keeps one request well under D1's statement limits for a single batch. */
const MAX_ROWS = 200;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Accepts rows already resolved against IGDB by the client and inserts them in
 * one batch. Resolution stays client-side on purpose: a Worker has a per-request
 * subrequest cap, so looking up 100 titles server-side would blow it.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body JSON inválido' }, 400);
  }

  const rows = (body as { games?: unknown }).games;
  if (!Array.isArray(rows)) {
    return json({ error: 'Se espera { games: [...] }' }, 400);
  }
  if (rows.length === 0) {
    return json({ error: 'La lista está vacía' }, 400);
  }
  if (rows.length > MAX_ROWS) {
    return json({ error: `Máximo ${MAX_ROWS} juegos por importación` }, 400);
  }

  for (let i = 0; i < rows.length; i++) {
    const invalid = validateLibraryRow(rows[i]);
    if (invalid) return json({ error: `Fila ${i + 1}: ${invalid}` }, 400);
  }

  try {
    const result = await bulkInsertLibraryGames(env.DB, rows as any);
    return json({
      ...result,
      message: `${result.inserted} añadidos, ${result.skipped} ya estaban`,
    }, 201);
  } catch (e) {
    console.error('[api/library/bulk] error:', e);
    return json({
      error: 'No se pudo importar',
      detail: e instanceof Error ? e.message : String(e),
    }, 500);
  }
};
