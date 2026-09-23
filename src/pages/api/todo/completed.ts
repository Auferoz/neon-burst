import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getCompletedHistory } from '../../../services/todoService';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async ({ url }) => {
  const before = url.searchParams.get('before') ?? undefined;
  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 200 ? limitParam : 50;

  const page = await getCompletedHistory(env.DB, before, limit);
  return json(page);
};
