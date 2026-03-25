# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neon Burst is a personal entertainment tracker/catalog built with Astro 6, Vue 3, and Tailwind CSS 4. It tracks played games, Steam library, upcoming games, movies watched by year, and TV series. The site is in Spanish. Visual style is neon/cyberpunk dark mode with a terminal aesthetic.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (outputs to `dist/`)
- `npm run preview` — Preview production build locally
- `npm run generate-types` — Generate Cloudflare Worker types via Wrangler
- `npm run sync-local` — Sync local D1 database
- `npm run fetch-ratings` — Fetch game ratings from external sources
- `npm run sync-steam` — Run Steam library sync locally
- `npm run sync-steam:remote` — Trigger Steam sync on remote worker
- `npm run sync-movies` — Sync movies from Trakt locally
- `npm run sync-movies:remote` — Sync movies from Trakt on remote D1
- `npm run seed-series` — Seed series watched data + sync cache locally
- `npm run seed-series:remote` — Seed series on remote D1
- `npm run sync-series` — Refresh series cache from Trakt locally
- `npm run sync-series:remote` — Refresh series cache on remote D1

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
│   ├── Vue/         — Interactive components (see Vue Components section)
│   └── Icons/       — SVG icon components (Vue + Astro, Lucide-style, stroke 1.5px)
├── pages/
│   ├── index.astro
│   ├── playedGames/ — index.astro, [id].astro (detail page)
│   ├── mySteamGames.astro
│   ├── nextGames.astro
│   ├── ListMovies.astro — Movies list page
│   ├── movies/[id].astro — Movie detail (cast, trailer, fanart, videos)
│   ├── ListSeries.astro — Series list page
│   ├── series/[slug].astro — Series detail (cast, seasons, episodes, trailer)
│   └── api/         — REST endpoints (games/, steam/, next-games/, movies/, series/)
├── services/        — Business logic (see Services section)
├── layouts/         — Layout.astro (base HTML, nav, transitions)
├── styles/          — global.css (Tailwind theme + neon tokens)
└── assets/          — Static SVGs
db/                  — SQL schema, seed scripts, sync scripts, migrations
integrations/        — cloudflare-cron.ts (injects scheduled handler post-build)
```

### Vue Components

| Component | Purpose |
|---|---|
| `PlayedGamesMain.vue` | Played games container with filters and dashboard |
| `PlayedGamesDashboard.vue` | Stats/dashboard display |
| `PlayedGamesCard.vue` | Individual game card |
| `PlayedGamesFilter.vue` | Filter controls |
| `PlayedGamesEditButton.vue` | Edit button |
| `PlayedGamesFormModal.vue` | Create/edit game modal |
| `SteamLibraryMain.vue` | Steam games display |
| `NextGamesMain.vue` | Upcoming games container |
| `NextGamesCard.vue` | Individual upcoming game card |
| `MoviesMain.vue` | Movies container with year tabs |
| `MoviesCard.vue` | Individual movie card |
| `SeriesMain.vue` | Series container with year tabs |
| `SeriesCard.vue` | Individual series card |
| `SeriesFormModal.vue` | Create/edit series entry modal |
| `SeriesSeasons.vue` | Expandable seasons/episodes accordion |

### API Endpoints

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/games` | GET, POST | List all games / Create game |
| `/api/games/[id]` | GET, PUT, DELETE | Game CRUD by ID |
| `/api/steam` | GET | Steam library cache (5min cache) |
| `/api/steam/sync` | GET | Trigger Steam sync (requires `x-cron-secret` or `?secret=`) |
| `/api/next-games` | GET | Upcoming games cache (5min cache) |
| `/api/next-games/sync` | GET | Trigger IGDB sync (same auth) |
| `/api/next-games/featured` | GET, POST | List/toggle featured games |
| `/api/movies` | GET, POST | List all movies / Create movie |
| `/api/movies/[id]` | GET, PUT, DELETE | Movie CRUD by ID |
| `/api/movies/sync` | GET | Trigger Trakt movies sync (requires auth) |
| `/api/movies/lists` | GET | Movie lists metadata |
| `/api/series` | GET, POST | List all series / Create series entry |
| `/api/series/[id]` | GET, PUT, DELETE | Series entry CRUD by ID |
| `/api/series/sync` | GET | Trigger Trakt series sync (requires auth) |
| `/api/series/detail/[slug]` | GET | Series full detail (on-demand fetch) |

### Database Schema (Cloudflare D1)

**Games tables** (defined in `db/schema.sql`):
- **games** — Main game tracking (title, estado, poster, trailer, artworks, genre, ratings, achievements, etc.)
- **dates_played** — Play sessions per year (game_id FK, year, fecha_inicio, fecha_final, horas)

**Steam/IGDB cache tables**:
- **steam_cache** — Cached Steam library (appid PK, playtime, HLTB times, metadata)
- **next_games_cache** — Cached upcoming IGDB games (igdb_id PK, cover, platforms, hypes/follows)
- **next_games_featured** — Featured game toggles (igdb_id PK)

**Movies tables**:
- **movies_cache** — Cached movie data from Trakt (trakt_id PK, poster, thumb, genres, rating, plus detail columns: tagline, certification, cast_json, videos_json, images_json, detail_fetched_at)
- **movies_lists** — Movie list metadata (slug PK, description, item_count)

**Series tables**:
- **series_cache** — Cached series data from Trakt (trakt_slug PK, poster, thumb, genres, rating, plus detail columns: tagline, certification, cast_json, videos_json, images_json, seasons_json, detail_fetched_at)
- **series_watched** — User's watched entries (trakt_slug + season_number UNIQUE, year_watched, platform, status_viewed)

### Services

- `src/services/gamesService.ts` — D1 CRUD for games + dates_played (uses prepared statements)
- `src/services/steamSync.ts` — Fetches Steam API → store details → HLTB times → upserts steam_cache
- `src/services/nextGamesSync.ts` — Queries IGDB for upcoming games with community interest → batch upserts
- `src/services/moviesService.ts` — D1 CRUD for movies_cache + on-demand detail fetch from Trakt (cast, videos, images)
- `src/services/moviesSync.ts` — Fetches Trakt user movie lists → upserts movies_cache (cron syncs current year only)
- `src/services/seriesService.ts` — D1 CRUD for series_watched + series_cache + on-demand detail fetch from Trakt (cast, seasons, episodes, videos)
- `src/services/seriesSync.ts` — Refreshes series_cache metadata from Trakt for current year / ongoing shows

### On-Demand Detail Fetch Pattern

Movies and series use a lazy-loading pattern for detailed data:
1. Sync scripts populate basic data (title, poster, thumb, rating, genres)
2. When a user visits a detail page (`/movies/[id]` or `/series/[slug]`), the service checks `detail_fetched_at`
3. If null, it fetches from Trakt API: full metadata, cast (`/people?extended=full`), seasons+episodes, and videos
4. Stores everything in JSON columns (`cast_json`, `videos_json`, `images_json`, `seasons_json`) and sets `detail_fetched_at`
5. Subsequent visits use cached data from D1

### External APIs

- **Trakt API** — Movies and series data, cast, seasons/episodes. All images come from Trakt (poster, fanart, thumb, headshots). Uses `?extended=full` for images.
- **Steam API** — Steam library and game details
- **IGDB (via Twitch OAuth)** — Upcoming games with community interest metrics
- **RAWG API** — Game ratings
- **TMDB API** — Only used for YouTube video trailers (not for images)

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
- Cron trigger: `0 1 * * *` (daily 1 AM UTC — runs Steam + IGDB + Movies + Series sync)
- Observability: enabled

### Environment Variables

Required in `.env` locally and as Cloudflare secrets for the worker:

- `STEAM_API_KEY` — Steam Web API key
- `STEAM_ID` — Steam user ID to sync
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` — For IGDB API access (via Twitch OAuth)
- `RAWG_API_KEY` — RAWG API key (for ratings)
- `TRAKT_CLIENT_ID` — Trakt API key (for movies and series)
- `TMDB_API_KEY` — TMDB API key (for video trailers only)
- `CRON_SECRET` — Authenticates cron/sync requests
- `STEAM_SYNC_URL` / `NEXT_GAMES_SYNC_URL` — Remote worker sync endpoint URLs

### DB Sync Scripts (Windows Shell Notes)

The `db/sync-*.js` and `db/seed-*.js` scripts use `wrangler d1 execute` via `execSync`. Known issues:
- Multi-line SQL with `datetime('now')` fails on Windows shell due to quote escaping — tables must be created manually via single-line commands (see `comandos.txt`)
- The `--remote` flag syncs against Cloudflare D1; without it, syncs locally
- Errors in `d1()` helper are logged to console

## Conventions

- **Language**: Spanish throughout — UI text, field names (`estado`, `horasTotal`, `logros_obt`, `fecha_inicio`), status enums (`Jugando`, `Completado`, `Abandonado`, `Pausado`)
- **Node.js** >=22.12.0 required
- **ESM** (`"type": "module"` in package.json)
- **Components** always go in their respective subfolder (`Astro/`, `Vue/`, `Icons/`), never directly in `src/components/`
- **Vue components** use `client:load` directive for hydration
- **Date format**: DD/MM/YYYY (Spanish convention)
- **SQL**: Prepared statements with `.bind()` for all D1 queries (SQL injection prevention)
- **Caching**: 5-minute `Cache-Control` on read-only sync endpoints; no cache on CRUD endpoints
- **Images**: All images (posters, fanart, thumbs, headshots) come from Trakt API. TMDB is only used for YouTube video data.
- **Astro Transitions**: Uses `ClientRouter` and `view-transition-name` for smooth navigation
- **Accessibility**: Skip link, semantic HTML, ARIA labels, focus outlines, reduced motion support
