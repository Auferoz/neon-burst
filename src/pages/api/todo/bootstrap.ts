import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getBootstrapData } from '../../../services/todoService';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async () => {
  const data = await getBootstrapData(env.DB);
  return json(data);
};
