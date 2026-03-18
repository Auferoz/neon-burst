# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neon Burst is a personal gaming tracker/catalog built with Astro 6, Vue 3, and Tailwind CSS 4. It tracks played games, Steam library, and upcoming games. The site is in Spanish.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (outputs to `dist/`)
- `npm run preview` — Preview production build locally
- `npm run generate-types` — Generate Cloudflare Worker types via Wrangler

No test framework is configured.

## Architecture

- **Astro 6** with SSR via `@astrojs/cloudflare` adapter, deployed to Cloudflare Workers/Pages
- **Vue 3** integration for interactive components (`@astrojs/vue`)
- **Tailwind CSS 4** via Vite plugin (imported in `src/styles/global.css`)
- **TypeScript** with strict config extending `astro/tsconfigs/strict`

### Key Files

- `src/layouts/Layout.astro` — Base HTML layout with CSS reset, uses `<slot />` for content
- `src/pages/` — File-based routing (Astro pages)
- `src/data/gamesDB.js` — Large local game database (`ListGames` array). Each game entry has fields like `title`, `released`, `companie`, `poster`, `trailer`, `genre`, `estado` (Completado/Abandonado/Jugando), `console_pc`, `dates_played`, etc.
- `src/styles/global.css` — Tailwind import entry point
- `wrangler.jsonc` — Cloudflare Workers config

### Deployment

Cloudflare Workers via Wrangler. The `wrangler.jsonc` points to `@astrojs/cloudflare/entrypoints/server` as the main entry and `./dist` for static assets.

## Conventions

- Language: Spanish (UI text, comments, field names like `estado`, `horasTotal`, `logros_obt`)
- Node.js >=22.12.0 required
- ESM (`"type": "module"` in package.json)
