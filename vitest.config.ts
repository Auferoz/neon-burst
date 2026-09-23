import { defineConfig } from 'vitest/config';

// Independent of astro.config.mjs on purpose: it only tests pure functions in
// src/services (e.g. anilist.ts) that don't import 'cloudflare:workers', so
// they can run in plain Node without the Astro/Cloudflare toolchain.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
