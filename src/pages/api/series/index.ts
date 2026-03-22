import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAllSeries, createSeriesEntry } from '../../../services/seriesService';
import { syncSingleShow } from '../../../services/seriesSync';

export const prerender = false;

export const GET: APIRoute = async () => {
  const series = await getAllSeries(env.DB);
  return new Response(JSON.stringify(series), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();

  if (!data.trakt_slug || !data.season_number || !data.year_watched) {
    return new Response(JSON.stringify({ error: 'trakt_slug, season_number y year_watched son obligatorios' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if show is cached, if not fetch from Trakt
  const cached = await env.DB.prepare('SELECT trakt_slug FROM series_cache WHERE trakt_slug = ?')
    .bind(data.trakt_slug).first();

  if (!cached) {
    const synced = await syncSingleShow(env.DB, data.trakt_slug);
    if (!synced) {
      return new Response(JSON.stringify({ error: `No se encontró la serie "${data.trakt_slug}" en Trakt` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const entry = await createSeriesEntry(env.DB, data);
    return new Response(JSON.stringify(entry), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('UNIQUE')) {
      return new Response(JSON.stringify({ error: 'Ya existe una entrada para esta serie y temporada' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
