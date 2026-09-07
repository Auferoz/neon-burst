import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  getAllLibraryGames,
  createLibraryGame,
  validateLibraryRow,
} from '../../../services/libraryService';

export const prerender = false;

function json(body: unknown, status = 200, cache?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cache) headers['Cache-Control'] = cache;
  return new Response(JSON.stringify(body), { status, headers });
}

export const GET: APIRoute = async () => {
  try {
    const games = await getAllLibraryGames(env.DB);
    return json(games, 200, 'public, max-age=300');
  } catch (e) {
    console.error('[api/library] GET error:', e);
    return json({ error: 'No se pudo leer la biblioteca' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body JSON inválido' }, 400);
  }

  const invalid = validateLibraryRow(body);
  if (invalid) return json({ error: invalid }, 400);

  try {
    const created = await createLibraryGame(env.DB, body as any);
    return json(created, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // The unique (store, title) index is the expected failure here.
    if (message.includes('UNIQUE')) {
      return json({ error: 'Ese juego ya está en la biblioteca para esa tienda' }, 409);
    }
    console.error('[api/library] POST error:', e);
    return json({ error: 'No se pudo crear el juego', detail: message }, 500);
  }
};
