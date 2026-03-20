# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neon Burst is a personal gaming tracker/catalog built with Astro 6, Vue 3, and Tailwind CSS 4. It tracks played games, Steam library, and upcoming games. The site is in Spanish. Visual style is neon/cyberpunk dark mode with a terminal aesthetic.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (outputs to `dist/`)
- `npm run preview` — Preview production build locally
- `npm run generate-types` — Generate Cloudflare Worker types via Wrangler
- `npm run sync-local` — Sync local D1 database
- `npm run fetch-ratings` — Fetch game ratings from external sources
- `npm run sync-steam` — Run Steam library sync locally
- `npm run sync-steam:remote` — Trigger Steam sync on remote worker

No test framework is configured.

## Architecture

- **Astro 6** with SSR via `@astrojs/cloudflare` adapter, deployed to Cloudflare Workers/Pages
- **Vue 3** integration for interactive components (`@astrojs/vue`, using `client:load`)
- **Tailwind CSS 4** via Vite plugin (imported in `src/styles/global.css`)
- **Cloudflare D1** as database (binding name: `DB`, database: `neon-burst-db`)
- **TypeScript** with strict config extending `astro/tsconfigs/strict`
- **Cloudflare Cron** — Daily sync at 1 AM UTC via custom integration (`integrations/cloudflare-cron.ts`)

### Directory Structure

```
src/
├── components/
│   ├── Astro/       — PageHeader, EmptyState, FloatingNav, NavCard
│   ├── Vue/         — Interactive components (PlayedGames*, NextGames*, SteamLibrary*)
│   └── Icons/       — SVG icon components (Vue + Astro, Lucide-style, stroke 1.5px)
├── pages/
│   ├── index.astro
│   ├── playedGames/ — index.astro, [id].astro (detail page)
│   ├── mySteamGames.astro
│   ├── nextGames.astro
│   ├── ListMovies.astro, ListSeries.astro (under construction)
│   └── api/         — REST endpoints (games/, steam/, next-games/)
├── services/        — Business logic (gamesService.ts, steamSync.ts, nextGamesSync.ts)
├── layouts/         — Layout.astro (base HTML, nav, transitions)
├── styles/          — global.css (Tailwind theme + neon tokens)
└── assets/          — Static SVGs
db/                  — SQL schema, seed scripts, local sync utilities
integrations/        — cloudflare-cron.ts (injects scheduled handler post-build)
```

### API Endpoints

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/games` | GET, POST | List all games / Create game |
| `/api/games/[id]` | GET, PUT, DELETE | Game CRUD by ID |
| `/api/steam` | GET | Steam library cache (5min cache) |
| `/api/steam/sync` | GET | Trigger Steam sync (requires `x-cron-secret` header or `?secret=`) |
| `/api/next-games` | GET | Upcoming games cache (5min cache) |
| `/api/next-games/sync` | GET | Trigger IGDB sync (same auth) |
| `/api/next-games/featured` | GET, POST | List/toggle featured games |

### Database Schema (Cloudflare D1)

Five tables defined in `db/schema.sql`:

- **games** — Main game tracking (title, estado, poster, trailer, artworks, genre, ratings, achievements, etc.)
- **dates_played** — Play sessions per year (game_id FK, year, fecha_inicio, fecha_final, horas)
- **steam_cache** — Cached Steam library (appid PK, playtime, HLTB times, metadata)
- **next_games_cache** — Cached upcoming IGDB games (igdb_id PK, cover, platforms, hypes/follows)
- **next_games_featured** — Featured game toggles (igdb_id PK)

### Services

- `src/services/gamesService.ts` — D1 CRUD for games + dates_played (uses prepared statements)
- `src/services/steamSync.ts` — Fetches Steam API → store details → HLTB times → upserts steam_cache
- `src/services/nextGamesSync.ts` — Queries IGDB for upcoming games with community interest → batch upserts

### Design System

- **Accent colors**: neon-blue `#1e90ff` (primary), neon-cyan `#00e5ff`, neon-pink `#ff2d95`, plus purple, yellow, green, emerald, indigo
- **Surfaces**: surface-0 `#06060a` through surface-4 `#222236`
- **Font**: Fira Code (monospace, Google Fonts) — terminal aesthetic
- **Neon glow classes**: `neon-glow-blue`, `neon-glow-cyan`, `neon-glow-pink` (defined in global.css)
- **Neon border classes**: `neon-border-blue`, `neon-border-cyan`, etc.
- **CRT scanline overlay**: subtle 2px repeating gradient
- **Per-section accent colors**: blue (played games), cyan (Steam), pink (next games), emerald (movies), indigo (series)
- **Estado colors**: green (Completado), pink (Abandonado), blue (Jugando), yellow (Pausado)
- Floating bottom nav: icon-only on mobile, icons+labels on desktop
- Reduced motion support via `prefers-reduced-motion`

### Deployment

GitHub push triggers automatic deploy to Cloudflare Pages/Workers. `wrangler.jsonc` configures:
- Main entry: `@astrojs/cloudflare/entrypoints/server`
- Static assets: `./dist`
- D1 binding: `DB` → `neon-burst-db`
- Cron trigger: `0 1 * * *` (daily 1 AM UTC — runs Steam + IGDB sync)
- Observability: enabled

### Environment Variables

Required in `.env` (no `.env.example` exists):

- `STEAM_API_KEY` — Steam Web API key
- `STEAM_ID` — Steam user ID to sync
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` — For IGDB API access (via Twitch OAuth)
- `RAWG_API_KEY` — RAWG API key (for ratings)
- `CRON_SECRET` — Authenticates cron/sync requests
- `STEAM_SYNC_URL` / `NEXT_GAMES_SYNC_URL` — Remote worker sync endpoint URLs

## Conventions

- **Language**: Spanish throughout — UI text, field names (`estado`, `horasTotal`, `logros_obt`, `fecha_inicio`), status enums (`Jugando`, `Completado`, `Abandonado`, `Pausado`)
- **Node.js** >=22.12.0 required
- **ESM** (`"type": "module"` in package.json)
- **Components** always go in their respective subfolder (`Astro/`, `Vue/`, `Icons/`), never directly in `src/components/`
- **Vue components** use `client:load` directive for hydration
- **Date format**: DD/MM/YYYY (Spanish convention)
- **SQL**: Prepared statements with `.bind()` for all D1 queries (SQL injection prevention)
- **Caching**: 5-minute `Cache-Control` on read-only sync endpoints; no cache on CRUD endpoints
- **Astro Transitions**: Uses `ClientRouter` and `view-transition-name` for smooth navigation
- **Accessibility**: Skip link, semantic HTML, ARIA labels, focus outlines, reduced motion support
