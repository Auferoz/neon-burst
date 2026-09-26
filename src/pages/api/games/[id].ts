import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getGameById, updateGame, deleteGame, isDuplicateTitleError, DUPLICATE_TITLE_MESSAGE } from '../../../services/gamesService';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const game = await getGameById(env.DB, id);

  if (!game) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(game), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const data = await request.json();
  let game;
  try {
    game = await updateGame(env.DB, id, data);
  } catch (e) {
    if (!isDuplicateTitleError(e)) throw e;
    return new Response(JSON.stringify({ error: DUPLICATE_TITLE_MESSAGE }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!game) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(game), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const deleted = await deleteGame(env.DB, id);

  if (!deleted) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
