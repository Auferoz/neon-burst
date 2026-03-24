import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSeriesDetail } from '../../../../services/seriesService';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Slug is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const series = await getSeriesDetail(env.DB, slug);

  if (!series) {
    return new Response(JSON.stringify({ error: 'Series not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(series), {
    headers: { 'Content-Type': 'application/json' },
  });
};
