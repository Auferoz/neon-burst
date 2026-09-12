# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neon Burst is a personal entertainment tracker/catalog built with Astro 6, Vue 3, and Tailwind CSS 4. It tracks played games, Steam library, upcoming games, movies watched by year, and TV series. The site is in Spanish. Visual style is neon/cyberpunk dark mode with a terminal aesthetic.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (outputs to `dist/`)
- `npm run preview` — Preview production build locally
- `npm run generate-types` — Generate Cloudflare Worker types via Wrangler
- `npm run sync-local` — Sobrescribe la D1 local con un export del remoto (dropea todas las tablas de usuario primero)
- `npm run fetch-ratings` — Fetch game ratings from external sources
- `npm run fetch-ratings:missing` — Idem, pero solo los ratings que siguen en NULL (ahorra cuota de OpenCritic)
- `npm run sync-steam` — Run Steam library sync locally
- `npm run sync-steam:remote` — Trigger Steam sync on remote worker
- `npm run sync-movies` — Sync movies from Trakt locally
- `npm run sync-movies:remote` — Sync movies from Trakt on remote D1
- `npm run seed-series` — Seed series watched data + sync cache locally
- `npm run seed-series:remote` — Seed series on remote D1
- `npm run seed-streaming` — Seed streaming_accounts desde `src/data/SSAccounts.js` (local)
- `npm run seed-streaming:remote` — Idem contra D1 remoto
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
| `PlayedGamesCard.vue` | Individual game card. Muestra `rating_personal` como badge circular sobre la esquina del poster (solo si está cargado) |
| `PlayedGamesFilter.vue` | Filter controls |
| `PlayedGamesEditButton.vue` | Edit button |
| `PlayedGamesFormModal.vue` | Create/edit game modal (con autocompletado desde IGDB) |
| `SteamLibraryMain.vue` | Steam games display |
| `NextGamesMain.vue` | Upcoming games container |
| `NextGamesCard.vue` | Individual upcoming game card |
| `MoviesMain.vue` | Movies container with year tabs + botón Agregar |
| `MoviesCard.vue` | Individual movie card (linkea a `/movies/{tmdb_id}`) |
| `MoviesFormModal.vue` | Alta manual de película, con previsualización antes de guardar |
| `SeriesMain.vue` | Series container with year tabs |
| `SeriesCard.vue` | Individual series card |
| `SeriesFormModal.vue` | Create/edit series entry modal |
| `SeriesSeasons.vue` | Expandable seasons/episodes accordion |
| `SyncButton.vue` | Botón de sync manual reutilizable (Movies/Series/Next Games) |

**`SyncButton.vue`** — llama a un endpoint `/api/*/sync` con `?secret=`. Pide el
`CRON_SECRET` por `window.prompt` y lo guarda en `localStorage` (clave `nb_sync_secret`);
si el endpoint devuelve 401 lo borra y vuelve a pedirlo. Props: `endpoint`, `accent`
(`indigo | emerald | pink | cyan | blue`), `label`; emite `synced` para que el contenedor
recargue con `cache: 'no-store'`. Las clases de acento están escritas completas en un
mapa estático para que Tailwind no las purgue.

### Autocompletado IGDB (modal de juegos)

`PlayedGamesFormModal.vue` tiene un bloque arriba del formulario donde se pega la URL de
IGDB, el slug o el ID del juego. El botón llama a `/api/igdb/lookup?q=` y rellena
**título, lanzamiento, compañía, plataforma, géneros, poster, artwork, trailer,
descripción e `igdb_id`**; el resto (estado, logros, horas, ratings, fechas) lo completa
el usuario. Solo sobrescribe los campos que IGDB devuelve con valor.

Formatos que produce el lookup, iguales a los que ya guarda la tabla `games`:

- `poster` / `artworks` → **image_id** de IGDB sin extensión (`co26z5`, `ar11k3`); las vistas
  arman la URL con `igdbImage()` (`t_cover_big`, `t_screenshot_big`, …)
- `trailer` → **ID de video de YouTube** (`s73I1DaHnqM`), se prefiere el video cuyo nombre
  contenga "trailer"
- `released` → `DD/MM/YYYY` desde `first_release_date` (unix UTC)
- `companie` → developer, y si no hay, publisher
- `console_pc` → abreviaturas de plataformas de IGDB (`PC, PS5, Series X|S`). Ojo: los datos
  existentes usan la tienda (`Steam`), así que este campo casi siempre se ajusta a mano

Resolución de la query: ID numérico → `where id =`; URL/slug → `where slug =`; si el slug no
existe, cae a `search "<slug con espacios>"`. Respuestas: 400 query vacía/URL no-IGDB,
404 no encontrado, 502 IGDB inaccesible.

### Alta manual de películas (`MoviesFormModal.vue`)

Mientras la API de Trakt no esté disponible, las películas se cargan a mano desde el
botón **Agregar** de `/ListMovies`. El campo acepta cuatro formas, en este orden:

1. URL de TMDB — `https://www.themoviedb.org/movie/693134-dune-part-two`
2. Id de TMDB pelado — `693134`
3. URL de Trakt — `https://app.trakt.tv/movies/dune-part-two-2024`
4. Slug de Trakt — `dune-part-two-2024`

El slug de Trakt se resuelve **contra TMDB**, no contra Trakt: `slugToQuery()` lo parte
en título + año y busca en `/search/movie`. Medido sobre las 481 películas del catálogo,
usando el `tmdb_id` guardado como verdad de referencia:

| filtro | aciertos |
|---|---|
| `&year=` | 471/481 — 97.9% |
| `&primary_release_year=` | **476/481 — 99.0%** |

**Usar siempre `primary_release_year`**: `year` matchea flojo y devuelve la película más
popular del título aunque sea de otro año (Robin Hood 2018 → devolvía la de 2010). El
equivalente estricto en `/search/tv` es `first_air_date_year`, que es el que ya usa
`lookupTmdbTvId()` en `tmdbSeries.ts`.

Los 5 fallos restantes son colisiones de mismo título **y** mismo año, que ninguna
búsqueda por texto resuelve: ahí se pega el id de TMDB. Por eso el modal previsualiza
(póster, título, año, `tmdb_id`, y en qué años ya está registrada) vía
`/api/movies/lookup`, y el botón Agregar está deshabilitado hasta confirmar.

El título se guarda en **inglés** (`fetchTmdbEnglishTitle()`) para no mezclar idiomas con
las 481 que vinieron de Trakt; la sinopsis se queda en español.

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
| `/api/movies` | GET, POST | Lista de películas vistas (JOIN `movies_watched` ↔ `movies_cache`) / alta manual |
| `/api/movies/[id]` | GET, DELETE | GET: detalle por `tmdb_id` (acepta `trakt_id` por compatibilidad). DELETE: borra una entrada de `movies_watched` por su `watched_id` |
| `/api/movies/lookup` | GET | `?q=<slug\|url de Trakt\|id de TMDB>` → previsualización sin guardar, con `watched_years` |
| `/api/movies/sync` | GET | Trigger Trakt movies sync (requires auth) |
| `/api/movies/lists` | GET | Movie lists metadata |
| `/api/series` | GET, POST | List all series / Create series entry |
| `/api/series/[id]` | GET, PUT, DELETE | Series entry CRUD by ID |
| `/api/series/sync` | GET | Trigger Trakt series sync (requires auth) |
| `/api/streaming/unlock` | POST | `{ pin }` → valida el PIN y emite la cookie de sesión |
| `/api/streaming/lock` | POST | Borra la cookie de sesión de streaming |
| `/api/series/detail/[slug]` | GET | Series full detail (on-demand fetch) |
| `/api/igdb/lookup` | GET | `?q=<url\|slug\|id>` → datos de un juego de IGDB para autocompletar el modal |

### Database Schema (Cloudflare D1)

**Games tables** (defined in `db/schema.sql`):
- **games** — Main game tracking (title, estado, poster, trailer, artworks, genre, ratings, achievements, etc.) + flags booleanos `is_demo`, `is_early_access`, `is_testing` (0/1), que se muestran como badges en `PlayedGamesCard.vue` y el detalle
  - **Tres ratings, los tres en escala 0-100**: `rating_metacritic` (INTEGER, vía RAWG),
    `rating_opencritic` (REAL, `topCriticScore`) y `rating_personal` (INTEGER, **puntuación
    propia, se carga a mano desde el modal**). Los tres nacen en NULL y el detalle no
    renderiza el bloque de un rating mientras esté vacío
- **dates_played** — Play sessions per year (game_id FK, year, fecha_inicio, fecha_final, horas)

**Steam/IGDB cache tables**:
- **steam_cache** — Cached Steam library (appid PK, playtime, HLTB times, metadata)
- **next_games_cache** — Cached upcoming IGDB games (igdb_id PK, cover, platforms, hypes/follows)
- **next_games_featured** — Featured game toggles (igdb_id PK)

**Movies tables**:
- **movies_cache** — **Solo metadata** (trakt_id PK, `tmdb_id` UNIQUE, poster, thumb, genres, rating, más columnas de detalle: tagline, certification, cast_json, videos_json, images_json, `data_source` (`'trakt' | 'tmdb'`), detail_fetched_at). Ya **no** tiene `list_slug` / `list_order` / `listed_at`: eso vive en `movies_watched`
- **movies_watched** — Las películas vistas (`tmdb_id` + `year_watched` UNIQUE, `trakt_id` nullable, `trakt_slug`, `platform`, `source` `'trakt' | 'manual'`, `listed_at`). Es el equivalente de `series_watched`, y lo que permite que una película figure en más de un año
- **movies_lists** — Movie list metadata (slug PK, description, item_count)

**La clave de unión entre las dos es `tmdb_id`, no `trakt_id`.** Es el único
identificador que existe tanto en lo que devuelve Trakt como en lo que se puede
conocer sin su API. Una película cargada a mano guarda un `trakt_id` **provisional
negativo** (`-tmdb_id`), porque `movies_cache.trakt_id` es `INTEGER PRIMARY KEY`
—alias del rowid— y un `NULL` haría que SQLite asigne `max+1`, un id positivo que
puede chocar con el real. `moviesSync.ts` lo promueve al verdadero antes del
upsert; sin ese paso el sync falla con `UNIQUE constraint failed: movies_cache.tmdb_id`
y se pierde el lote entero de 50.

**Series tables**:
- **series_cache** — Cached series data (trakt_slug PK, poster, thumb, genres, rating, plus detail columns: tagline, certification, cast_json, videos_json, images_json, seasons_json, `season_posters_json` (mapa `{"1":"url"}`), `data_source` (`'trakt' | 'tmdb'`), detail_fetched_at)
- **series_watched** — User's watched entries (trakt_slug + season_number UNIQUE, year_watched, platform, status_viewed)

**Streaming tables**:
- **streaming_accounts** — Cuentas de servicios de streaming (name UNIQUE, url, logo, email, password, plan, sort_order). Sustituye a `src/data/SSAccounts.js`, que está en `.gitignore`
- **streaming_attempts** — Freno de fuerza bruta del PIN (ip PK, fails, locked_until)

**Migraciones** (`db/migrate-*.sql`, se aplican con `wrangler d1 execute`): `add-movies-tables`,
`add-series-tables`, `add-detail-columns`, `add-thumb`, `add-season-posters`, `add-testing`,
`add-demo-early-access`, `add-data-source`, `add-movies-data-source`, `add-streaming-tables`,
`rename-rawg-opencritic`, `add-movies-watched`, `drop-movies-list-columns`,
`add-personal-rating`.
`drop-movies-list-columns` es **irreversible**: el respaldo de lo que borró
(`list_slug`, `list_order`, `listed_at` de las 481 filas) es
`db/backup-movies-list-slug.json`, y es lo único que queda de esos datos.
Ojo: `db/schema.sql`
**no** incluye todavía `season_posters_json` ni las columnas `data_source` — una base creada
solo desde `schema.sql` necesita correr esas migraciones aparte.

**Aplícalas siempre en local Y en remoto.** Un `ALTER TABLE` que solo se corrió en local
provoca en producción `D1_ERROR: table X has no column named Y`:
```
npx wrangler d1 execute neon-burst-db --local  --file db/<migracion>.sql
npx wrangler d1 execute neon-burst-db --remote --file db/<migracion>.sql
```

### Services

- `src/services/gamesService.ts` — D1 CRUD for games + dates_played (uses prepared statements)
- `src/services/steamSync.ts` — Fetches Steam API → store details → HLTB times → upserts steam_cache
- `src/services/nextGamesSync.ts` — Queries IGDB for upcoming games with community interest → batch upserts
- `src/services/igdbGame.ts` — Lookup de **un** juego en IGDB por URL / slug / ID, mapeado a los campos de `games`. Exporta `getIgdbToken()` (compartido con `nextGamesSync.ts`), `parseIgdbQuery()` y `lookupIgdbGame()`. Usado por `/api/igdb/lookup` para el autocompletado del modal
- `src/services/moviesService.ts` — D1 CRUD de `movies_watched` + `movies_cache` y detalle on-demand. `getAllMovies()` hace el JOIN; `createMovieEntry()` es el alta manual; `deleteMovieEntry()` borra una entrada
- `src/services/tmdbMovies.ts` — Proveedor TMDB de películas (fallback temporal, ver abajo): detalle completo desde `/movie/{id}` con `credits`, `images`, `release_dates`, `videos` y `external_ids`. Además `lookupTmdbMovieId()` (slug → id), `fetchTmdbMoviePreview()` (liviano, para el modal) y `fetchTmdbEnglishTitle()`
- `src/services/moviesSync.ts` — Fetches Trakt user movie lists → upserts `movies_cache` **y `movies_watched`** (cron syncs current year only). **Devuelve 0 mientras Trakt esté caído**: las listas no tienen equivalente en TMDB
- `src/utils/mediaQuery.ts` — `parseMediaQuery()` (acepta slug de Trakt, URL de Trakt, id o URL de TMDB) y `slugToQuery()` (slug → término + año), compartida con `tmdbSeries.ts`
- `src/services/streamingAuth.ts` — PIN + cookie de sesión firmada (HMAC-SHA256 vía Web Crypto) + rate limiting por IP en `streaming_attempts`
- `src/services/streamingService.ts` — Lectura de `streaming_accounts`; `getStreamingAccountsPublic()` omite email y contraseña
- `src/services/seriesService.ts` — D1 CRUD for series_watched + series_cache + on-demand detail fetch from Trakt (cast, seasons, episodes, videos)
- `src/services/seriesSync.ts` — Refreshes series_cache metadata from Trakt for current year / ongoing shows; `syncSingleShow` cae a TMDB y lanza `TraktRequestError` (→ HTTP 502) si ambas APIs fallan
- `src/services/tmdbSeries.ts` — Proveedor TMDB de series (fallback temporal, ver abajo): resuelve el slug de Trakt a un id de TMDB por búsqueda y devuelve los datos con la misma forma que las funciones de Trakt

### Streaming (puerta de PIN)

`/streaming` no es prerenderizable (`export const prerender = false`): decide qué
renderizar según la cookie de sesión, **antes** de tocar D1.

1. `GET /streaming` verifica la cookie `nb_streaming` con `isValidSessionToken()`
2. Sin sesión → renderiza `StreamingPinGate.astro`. Ese HTML no contiene ninguna cuenta:
   las contraseñas ni siquiera se consultan a D1
3. El gate hace `POST /api/streaming/unlock` con el PIN. El servidor lo compara en tiempo
   constante contra el secret `STREAMING_PIN` y responde con `Set-Cookie` HttpOnly
4. La cookie es `<expiraEnSegundos>.<HMAC-SHA256 del payload>`, firmada con
   `STREAMING_SESSION_SECRET`. Dura 8 h y el cliente no puede alargarla: cambiar el `exp`
   invalida la firma
5. Con sesión válida → tarjetas con las contraseñas ya dentro del HTML. El ojo y el botón de
   copiar son cosméticos (evitar miradas ajenas), no un candado
6. El botón "Bloquear" llama a `POST /api/streaming/lock`, que borra la cookie

**Logos: sprite único.** `public/Logos_Streaming.png` lleva los 7 logos en una fila sobre
fondo negro. `src/data/streamingLogos.ts` guarda la caja en píxeles de cada uno (medidas
sobre los píxeles del PNG, no a ojo) y `getLogoSprite()` calcula el `background-size` y
`background-position` en tiempo de render. El elemento se dimensiona **exactamente** al
recorte escalado: si ocupara toda la caja disponible, el background dejaría ver los logos
contiguos. El contenedor va en `bg-black` para que el recorte no marque bordes. Un servicio
que no esté en el mapa cae a la URL de `streaming_accounts.logo`.

**El rate limiting es la defensa real**, no la longitud del PIN: `streaming_attempts` cuenta
fallos por IP (`CF-Connecting-IP`) y bloquea 15 min tras 8 fallos consecutivos. Con la IP
bloqueada, ni siquiera un PIN correcto pasa. Un acierto borra la fila.

**Ojo con el 401 en POST:** el dev server de Astro con el adaptador de Cloudflare convierte
cualquier respuesta 401 a un POST en un `500 fetch failed` al reenviarla por el proxy de
vite (GET 401 y POST 403/429 funcionan bien). Por eso `unlock` devuelve **403** para el PIN
incorrecto y 429 para el bloqueo. No lo cambies a 401.

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
- **RAWG API** — Internal source for the Metacritic score only (its own user rating is not stored)
- **OpenCritic (via RapidAPI)** — `topCriticScore` (0-100) shown next to Metacritic
- **TMDB API** — YouTube video trailers, y **fallback temporal de series y películas** (ver abajo)

### Fallback temporal a TMDB (series y películas)

La API de Trakt pasó a ser de pago y actualmente responde `403 Forbidden` a **todas** las
peticiones (verificado con la key del `.env`, incluso en endpoints públicos como
`/movies/popular`). Trakt sigue siendo la fuente primaria en el código; cuando falla, se
cae a TMDB vía `src/services/tmdbSeries.ts` y `src/services/tmdbMovies.ts`.

**Series:**
- **Alta de serie nueva** (`syncSingleShow` en `seriesSync.ts`) → datos básicos desde TMDB
- **Página de detalle** (`fetchSeriesDetail` en `seriesService.ts`) → cast (`/aggregate_credits`),
  temporadas + episodios, videos e imágenes desde TMDB

**Películas:**
- **Página de detalle** (`fetchMovieDetail` en `moviesService.ts`) → cast (`/credits`),
  videos, imágenes, tagline, certificación y homepage desde TMDB
- Los campos básicos (poster, thumb, overview, géneros, runtime, rating, released) solo se
  rellenan **si están vacíos**: lo que ya vino de Trakt se respeta (`CASE WHEN ... = '' THEN`)
- `after_credits` / `during_credits` se quedan como estén: TMDB no expone ese dato
- Los textos (`tagline`, `overview`) se piden en `es-ES` y, si TMDB no los tiene traducidos,
  se completan desde `en-US`
- **La pertenencia a listas no se puede recuperar automáticamente**: qué películas están en
  `movies-2026` solo lo sabe Trakt, así que el sync sigue devolviendo 0 y no se añaden
  películas nuevas solas. **Para eso está el alta manual** (ver arriba): se cargan a mano y
  se reconcilian cuando Trakt vuelva
- **Cuando Trakt vuelva, correr una vez `npm run sync-movies:remote`**. `movies_lists`
  suma 513 entradas contra 481 películas en el caché: esas 32 son rewatches que el modelo
  viejo aplastaba (`movies_cache` tenía una sola columna `list_slug`, así que una película
  vista en 2018 y en 2022 se quedaba solo con el último año). `movies_watched` ya puede
  representarlas, y ese script recorre **todas** las listas —el cron del worker solo hace
  el año en curso—, así que las recupera de una
- Scrapear `app.trakt.tv` no es viable: es una SPA que sirve el `<body>` vacío y no expone
  ningún endpoint JSON público (`.json` devuelve el shell HTML). Medido: `api.trakt.tv`
  devuelve `403` **incluso con la key y para rutas inventadas** (corta por auth antes de
  resolver la ruta), y `app.trakt.tv` devuelve `200` solo si el User-Agent parece un
  navegador — pero sirve 29 KB de cascarón, con el `og:title` genérico del sitio, sin
  JSON-LD y sin una sola referencia a TMDB o IMDb

**Común a ambos:**
- El **cron diario sigue siendo solo Trakt** a propósito: si falla, deja el caché intacto
  en lugar de sobrescribir datos buenos de Trakt con datos de TMDB
- `series_cache.data_source` / `movies_cache.data_source` marcan el origen (`'trakt'` | `'tmdb'`).
  Al recuperar Trakt, esto fuerza el re-fetch desde Trakt en la siguiente visita al detalle:
  ```sql
  UPDATE series_cache SET detail_fetched_at = NULL WHERE data_source = 'tmdb';
  UPDATE movies_cache SET detail_fetched_at = NULL WHERE data_source = 'tmdb';
  ```

### Design System

- **Accent colors**: neon-blue `#1e90ff` (primary), neon-cyan `#00e5ff`, neon-pink `#ff2d95`, neon-purple `#b026ff`, neon-orange `#ff7b00`, neon-yellow `#e5ff00`, neon-green `#39ff14`, neon-emerald `#34d399`, neon-indigo `#818cf8` (blue/cyan/pink también tienen variante `-dim` con alpha `66`)
- **Surfaces**: surface-0 `#06060a` through surface-4 `#222236`
- **Texto**: text-primary `#e8e8f0`, text-secondary `#9898b0`, text-muted `#5c5c78`
- **Bordes**: border-default `#1e1e30`, border-hover `#2a2a42`
- **Font**: Fira Code (monospace, Google Fonts) — terminal aesthetic
- **Neon glow classes**: `neon-glow-blue`, `neon-glow-cyan`, `neon-glow-pink` (defined in global.css)
- **Neon border classes**: `neon-border-blue`, `neon-border-cyan`, etc.
- **CRT scanline overlay**: subtle 2px repeating gradient
- **Per-section accent colors**: blue (played games), cyan (Steam), pink (next games), emerald (movies), indigo (series)
- **Estado colors**: green (Completado), pink (Abandonado), blue (Jugando), yellow (Pausado), purple (Recurrente)
- **Badges de flags**: indigo (Demo), emerald (Early Access), cyan (Review/`is_testing`). Van en la **misma fila** que el badge de estado, así que **ningún flag puede repetir un color de estado**: Demo era purple como `Recurrente` y Early Access era yellow como `Pausado`, y se confundían. Regla al agregar un flag nuevo: los estados conservan su color documentado, el flag toma uno libre
- **Colores de rating**: cada uno usa **la escala de quien lo emite**, no una común. Definidos en `ratingColor` en `src/pages/playedGames/[id].astro`:

  | rating | bandas |
  |---|---|
  | Metacritic | green `>= 75`, yellow `>= 50`, pink debajo (cortes fijos y oficiales) |
  | OpenCritic | green `>= 84` (Mighty), emerald `>= 75` (Strong), yellow `>= 65` (Fair), pink debajo (Weak) |
  | Mi score | blue `>= 90`, green `>= 70`, yellow `>= 55`, orange `>= 45`, pink debajo |

  **Los tiers de OpenCritic son percentiles, no cortes fijos** (Mighty = 10% superior, Strong = 30% siguiente, Fair = del 30 al 60, Weak = 30% inferior). 84/75/65 es la traducción práctica y puede moverse con el tiempo.
- **`rating_personal` en la lista**: va en la fila de datos de `PlayedGamesCard.vue`, después de las horas, con una estrella y el número en el color de su banda. Si es NULL no se renderiza **ni el separador `·`**, así que la fila no queda coja — con 58 de 66 juegos sin puntuar, la ausencia tiene que verse deliberada
- Las clases de color de rating viven en los mapas `badgeClass` / `textClass` de `[id].astro`, escritas literales: Tailwind escanea el código como texto y purga cualquier clase que se arme por interpolación
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
- `RAWG_API_KEY` — RAWG API key (solo para leer el score de Metacritic)
- `OPENCRITIC_API_KEY` — Key de RapidAPI para la API de OpenCritic (solo la usa `npm run fetch-ratings` en local, no es secret del worker)
- `TRAKT_CLIENT_ID` — Trakt API key (for movies and series)
- `TMDB_API_KEY` — TMDB API key (trailers + fallback temporal de series)
- `CRON_SECRET` — Authenticates cron/sync requests
- `STREAMING_PIN` — PIN de 6 dígitos que abre `/streaming`
- `STREAMING_SESSION_SECRET` — Clave HMAC que firma la cookie de sesión de streaming
- `STEAM_SYNC_URL` / `NEXT_GAMES_SYNC_URL` / `MOVIES_SYNC_URL` / `SERIES_SYNC_URL` — Remote worker sync endpoint URLs (las cuatro se leen en build time por `integrations/cloudflare-cron.ts` y quedan inlineadas en el handler `scheduled`; si faltan al buildear, el cron apunta a URLs vacías)

### DB Sync Scripts (Windows Shell Notes)

The `db/sync-*.js` and `db/seed-*.js` scripts use `wrangler d1 execute` via `execSync`. Known issues:
- Multi-line SQL with `datetime('now')` fails on Windows shell due to quote escaping — tables must be created manually via single-line commands (see `comandos.txt`)
- The `--remote` flag syncs against Cloudflare D1; without it, syncs locally
- Errors in `d1()` helper are logged to console

**La lógica de sync está duplicada.** Cada sync existe dos veces: en el worker
(`src/services/*Sync.ts`, que corre por cron y por `/api/*/sync`) y como script local
(`db/sync-*.js`, que corre por `npm run sync-*` usando `wrangler d1 execute`). No
comparten código. Todo cambio en el esquema o en la lógica de upsert hay que aplicarlo
**en las dos**, o el script local queda escribiendo contra columnas que ya no existen.

**Los ids de `games` NO son estables entre local y remoto.** Un script que lee de la
base local y genera SQL con `WHERE id = ...` le escribe a la fila equivocada al
aplicarlo con `--remote`. Pasó de verdad: el `id 59` era *Uncharted 4* en local y
*Breath of the Wild* en remoto. Por eso `db/fetch-ratings.js` genera sus `UPDATE`
con `WHERE title = '...'` (escapando las comillas simples). Cualquier script nuevo
que genere SQL portable entre las dos bases tiene que hacer lo mismo.

Para evitar la divergencia de raíz, correr `npm run sync-local` antes de trabajar
contra la base local. Es **sobrescritura en un solo sentido**: dropea todas las
tablas de usuario locales y las reemplaza por el export del remoto, así que lo que
solo exista en local se pierde.

## Conventions

- **Language**: Spanish throughout — UI text, field names (`estado`, `horasTotal`, `logros_obt`, `fecha_inicio`), status enums (`Jugando`, `Completado`, `Abandonado`, `Pausado`)
- **Node.js** >=22.12.0 required
- **ESM** (`"type": "module"` in package.json)
- **Components** always go in their respective subfolder (`Astro/`, `Vue/`, `Icons/`), never directly in `src/components/`
- **Vue components** use `client:load` directive for hydration
- **Date format**: DD/MM/YYYY (Spanish convention)
- **SQL**: Prepared statements with `.bind()` for all D1 queries (SQL injection prevention)
- **Caching**: 5-minute `Cache-Control` en endpoints de lectura (`/api/steam`, `/api/next-games`, `/api/movies`, `/api/movies/lists`, `/api/series`); sin caché en endpoints CRUD. Tras un sync manual, los contenedores Vue refetchean con `cache: 'no-store'` para saltarse ese caché de 5 min
- **Images**: Posters, fanart, thumbs y headshots vienen de Trakt cuando está disponible. En series, si Trakt falla, las imágenes vienen de TMDB (`https://image.tmdb.org/t/p/...`) vía `tmdbSeries.ts`. TMDB también aporta los videos de YouTube.
- **Astro Transitions**: Uses `ClientRouter` and `view-transition-name` for smooth navigation
- **Accessibility**: Skip link, semantic HTML, ARIA labels, focus outlines, reduced motion support
