import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { searchAll } from '../../services/searchService';
import { normalizeSearchQuery } from '../../utils/search';

export const prerender = false;

/**
 * GET /api/search?q=<texto>
 * Busca en todas las secciones públicas a la vez (juegos, biblioteca, Steam,
 * películas, series, manga). Nunca toca /streaming ni /myTodoist.
 */
export const GET: APIRoute = async ({ url }) => {
  const raw = url.searchParams.get('q');
  const query = normalizeSearchQuery(raw);

  if (!query) {
    return json({ error: 'La búsqueda necesita entre 2 y 100 caracteres' }, 400);
  }

  const results = await searchAll(env.DB, query);

  return new Response(JSON.stringify({ results }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
