/**
 * Astro integration — injects a `scheduled` handler into the
 * Cloudflare Worker output so cron triggers work alongside Astro.
 */
import type { AstroIntegration } from 'astro';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CRON_SECRET = 'neon-burst-cron-2026';
const SYNC_URL = 'https://neon-burst.adesigns7.workers.dev/api/steam/sync';

export default function cloudflareCron(): AstroIntegration {
  return {
    name: 'cloudflare-cron',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        // Astro Cloudflare adapter outputs to dist/server/entry.mjs
        // dir points to dist/client/, so go up one level
        const rawPath = dir.pathname.replace(/^\/([A-Z]:)/, '$1');
        const distRoot = join(rawPath, '..');
        const entryPath = join(distRoot, 'server', 'entry.mjs');

        if (!existsSync(entryPath)) {
          console.warn('[cloudflare-cron] entry.mjs not found at', entryPath);
          return;
        }

        let code = readFileSync(entryPath, 'utf-8');

        // Pattern: export { _ as default }
        // Replace with a wrapper that adds scheduled
        if (code.includes('export {')) {
          code = code.replace(
            /export\s*\{\s*(\w+)\s+as\s+default\s*\};?/,
            (_, varName) => `
// --- Cloudflare Cron Trigger (injected by cloudflare-cron integration) ---
const _cronWrapped = {
  ...${varName},
  async scheduled(controller, env, ctx) {
    const request = new Request('${SYNC_URL}', {
      headers: { 'x-cron-secret': '${CRON_SECRET}' },
    });
    ctx.waitUntil(${varName}.fetch(request, env, ctx));
  },
};
export { _cronWrapped as default };`
          );

          writeFileSync(entryPath, code, 'utf-8');
          console.log('[cloudflare-cron] Scheduled handler injected into entry.mjs');
        } else {
          console.warn('[cloudflare-cron] Could not find export pattern in entry.mjs');
        }
      },
    },
  };
}
