/**
 * Pure route match used by src/middleware.ts. No astro/cloudflare imports so
 * it can run under plain Vitest.
 */
export function isTodoApiPath(pathname: string): boolean {
  return pathname === '/api/todo' || pathname.startsWith('/api/todo/');
}
