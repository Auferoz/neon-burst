/**
 * Guards /api/todo/** behind the same PIN session as /streaming. Every other
 * route passes through untouched.
 *
 * 403 and not 401 on purpose: the Astro dev server with the Cloudflare
 * adapter turns a 401 on a POST into a 500 when proxying it (see CLAUDE.md).
 */
import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, isValidSessionToken } from './services/streamingAuth';
import { isTodoApiPath } from './utils/todo/routeMatch';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies } = context;

  if (!isTodoApiPath(url.pathname)) return next();

  const valid = await isValidSessionToken(cookies.get(SESSION_COOKIE)?.value);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Sesión requerida' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  return next();
});
