import type { APIRoute } from 'astro';
import { lookupIgdbGame, parseIgdbQuery, IgdbRequestError } from '../../../services/igdbGame';

export const prerender = false;

/**
 * GET /api/igdb/lookup?q=<url|slug|id>
 * Devuelve los datos de un juego de IGDB ya mapeados a los campos de `games`,
 * para autocompletar el formulario de "Agregar juego".
 */
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q') || '';
  const parsed = parseIgdbQuery(q);

  if (!parsed) {
    return json({ error: 'Pega una URL de IGDB, un slug o un ID numérico' }, 400);
  }

  try {
    const game = await lookupIgdbGame(parsed);
    if (!game) {
      return json({ error: `No se encontró el juego "${q.trim()}" en IGDB` }, 404);
    }
    return json(game, 200);
  } catch (e) {
    const err = e as IgdbRequestError;
    return json({ error: err.message || 'Error consultando IGDB' }, 502);
  }
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
