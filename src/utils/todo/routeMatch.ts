/**
 * Pure route match used by src/middleware.ts. No astro/cloudflare imports so
 * it can run under plain Vitest.
 */
export function isTodoApiPath(pathname: string): boolean {
  return pathname === '/api/todo' || pathname.startsWith('/api/todo/');
}

export function isMangaApiPath(pathname: string): boolean {
  return pathname === '/api/manga' || pathname.startsWith('/api/manga/');
}

/** API routes that require the shared PIN session (same cookie as /streaming). */
export function isPrivateApiPath(pathname: string): boolean {
  return isTodoApiPath(pathname) || isMangaApiPath(pathname);
}
