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
- `npm run fetch-movie-scores` — Fetch TMDB + IMDb (OMDb) scores para películas y actualiza D1 local
- `npm run fetch-movie-scores:remote` — Idem contra D1 remoto (usa `--command`, ver Migraciones)
- `npm run fetch-series-scores` — Fetch TMDB + IMDb (OMDb) scores para series y actualiza D1 local
- `npm run fetch-series-scores:remote` — Idem contra D1 remoto (usa `--command`, ver Migraciones)
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

`npm test` runs Vitest (`vitest run`) — scoped to pure functions only (currently
`src/services/anilist.ts`: `parseAnilistQuery`, `countryToType`, the AniList → `manga_cache`
row mapper; and `src/services/omdb.ts`, `src/services/movieScores.ts`, `src/utils/ratingBands.ts`
for the movie/series scores, shared by both — plus `db/scoreBackfillUtils.js`, the plain-JS
helpers used by `db/fetch-movie-scores.js` and `db/fetch-series-scores.js`), so it can run in
plain Node without the Astro/Cloudflare toolchain. Its config (`vitest.config.ts`) is
independent of `astro.config.mjs` on purpose.

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
│   ├── ListManga.astro — Manga list page
│   ├── manga/[id].astro — Manga detail (AniList id: characters, staff, relations, recs)
│   └── api/         — REST endpoints (games/, steam/, next-games/, movies/, series/, manga/)
├── services/        — Business logic (see Services section)
├── layouts/         — Layout.astro (base HTML, nav, transitions)
└── styles/          — global.css (Tailwind theme + neon tokens + @font-face)
db/                  — SQL schema, seed scripts, sync scripts, migrations
integrations/        — cloudflare-cron.ts (injects scheduled handler post-build)
brand/               — Archivos maestros del logo. **Fuera de `public/` a propósito**:
                       son los originales de los que se derivan los assets, no se
                       sirven, y en `public/` se deployarían sin que nadie los use
public/
└── assets/          — Todo lo que el sitio referencia por URL: logo, favicons,
                       sprite de streaming y la fuente. `public/` se copia tal cual
                       al build, sin optimizar ni descartar nada
```

> No hay `src/assets/`. Esa carpeta es la que Astro usa para imágenes que pasan por
> su pipeline de optimización (`astro:assets` con `<Image />`), y este proyecto no
> lo usa: todo se sirve por URL desde `public/`. Si algún día se adopta
> `astro:assets`, ahí sí corresponde crearla.

### Vue Components

| Component | Purpose |
|---|---|
| `PlayedGamesMain.vue` | Played games container with filters and dashboard |
| `PlayedGamesDashboard.vue` | Stats/dashboard display |
| `PlayedGamesCard.vue` | Individual game card. Muestra `rating_personal` como badge circular sobre la esquina del poster (solo si está cargado) |
| `PlayedGamesFilter.vue` | Filtros: año, estado, plataforma y **marca** (Demo / Early Access / Review). Las opciones de año, estado y plataforma se derivan de los datos; las de marca vienen del array `MARCAS` de `PlayedGamesMain.vue`, cuyo `value` es el nombre de la columna de la flag |
| `EditButton.vue` | Botón "Editar" presentacional compartido (lápiz + texto), usado en las cuatro fichas de detalle. Prop `accent` (`blue \| indigo \| emerald \| orange`, uno por sección) con clases literales para que Tailwind no las purgue; emite `click`, no sabe nada del modal que abre |
| `PlayedGamesEditButton.vue` | Envuelve `EditButton` (accent `blue`) + `PlayedGamesFormModal`; recarga la página al guardar |
| `PlayedGamesFormModal.vue` | Create/edit game modal (con autocompletado desde IGDB) |
| `SteamLibraryMain.vue` | Steam games display |
| `NextGamesMain.vue` | Upcoming games container |
| `NextGamesCard.vue` | Individual upcoming game card |
| `MoviesMain.vue` | Movies container with year tabs + botón Agregar (alta únicamente: editar vive en la ficha) |
| `MoviesCard.vue` | Individual movie card (linkea a `/movies/{tmdb_id}`). Muestra un único badge de **promedio** (`averageScore()` de `rating_tmdb`/`rating_imdb`/`rating_personal`, los que existan), coloreado con `tmdbImdbBand` de `src/utils/ratingBands.ts` |
| `MoviesFormModal.vue` | Alta manual de película, con previsualización antes de guardar. Incluye un campo opcional "Mi score (0-100)" |
| `MoviesEditButton.vue` | Envuelve `EditButton` (accent `emerald`) + `MoviesEntriesModal`, en la ficha de película |
| `MoviesEntriesModal.vue` | Modal de edición de la ficha: "Mi score" + overrides manuales de "TMDB"/"IMDb" (`PUT /api/movies/score/[tmdbId]`, solo manda los campos que cambiaron) + lista de visionados (`movies_watched`, uno por rewatch en otro año), cada uno editable y borrable (`PUT`/`DELETE /api/movies/[id]` por `watched_id`). Recarga al guardar; si se borra el último visionado, redirige a `/ListMovies` sin tocar los scores |
| `SeriesMain.vue` | Series container with year tabs + botón Agregar (alta únicamente: editar vive en la ficha) |
| `SeriesCard.vue` | Individual series card (sin botón de editar: eso vive en la ficha de la serie) |
| `SeriesFormModal.vue` | Create/edit series entry modal. Las opciones de estado salen de `src/utils/seriesFormOptions.ts`, compartidas con `SeriesEntriesModal.vue` |
| `SeriesSeasons.vue` | Expandable seasons/episodes accordion |
| `SeriesEditButton.vue` | Envuelve `EditButton` (accent `indigo`) + `SeriesEntriesModal`, en la ficha de la serie |
| `SeriesEntriesModal.vue` | Modal de edición de la ficha: "Mi score" (uno por serie) + overrides manuales de "TMDB"/"IMDb" (`PUT /api/series/score/[slug]`, solo manda los campos que cambiaron) + una fila por temporada registrada en `series_watched`, cada una editable y borrable (`PUT`/`DELETE /api/series/[id]`). Recarga al guardar; si se borra la última temporada, redirige a `/ListSeries` |
| `SyncButton.vue` | Botón de sync manual reutilizable (Movies/Series/Next Games) |
| `MangaMain.vue` | Manga container: filtros (tipo, estado, formato, género, búsqueda), stats, botón Agregar (alta únicamente: editar vive en la ficha) |
| `MangaCard.vue` | Tarjeta de manga: portada, badge de tipo (Manga/Manhwa/Manhua), estado, progreso `cap/total`, score personal (sin botón de editar: eso vive en la ficha) |
| `MangaFormModal.vue` | Alta/edición de manga. Lookup a AniList (URL o id) → previsualización → confirmar, mismo flujo que `MoviesFormModal.vue`, pero acá el `fetch` a AniList lo hace el propio navegador (`fetchAnilistPreview`/`fetchAnilistMedia` de `anilist.ts`): el servidor solo confirma con `/api/manga/lookup?id=` si ya está agregado. En modo edición suma un botón "Eliminar" con confirmación dentro del propio modal (no `window.confirm`); emite `deleted` |
| `MangaEditButton.vue` | Envuelve `EditButton` (accent `orange`) + `MangaFormModal` en modo edición, en la ficha del manga; redirige a `/ListManga` si se elimina |
| `MangaRefresher.vue` | Isla `client:idle` en `manga/[id].astro`, montada solo si `getMangaDetail()` marcó `needs_refresh`. Trae el detalle de AniList del lado del navegador y lo sube por `PUT /api/manga/cache/[anilistId]`; si funciona, recarga la página una vez (con guard en `sessionStorage` contra loops); si falla, no hay nada visible que romper — el caché queda como estaba |
| `Todo/TodoApp.vue` | Container de `/myTodoist`: crea el store (`useTodoStore.ts`, provisto por `provide`/`inject`), carga `GET /api/todo/bootstrap`, enruta las vistas vía `?view=` (`inbox`, `today`, `upcoming`, `project:ID`, `label:ID`, `completed`, `dashboard`, `search`) con `history.replaceState`, y registra los atajos de teclado |
| `Todo/useTodoStore.ts` | Composable (no componente): estado reactivo compartido + updates optimistas con rollback y toast de error; ofrece "Deshacer" (5 s) al completar/borrar |
| `Todo/TodoSidebar.vue` / `TodoSidebarNav.vue` | Columna fija en desktop, drawer en mobile (mismo contenido, `TodoSidebarNav`): vistas, proyectos (alta/borrado inline) y etiquetas |
| `Todo/TodoQuickAdd.vue` | Alta rápida con preview en vivo de los chips que devuelve `parseQuickAdd`. Abierta con `q` o el botón flotante "+" (mobile), ambos solo hacen `focus()` sobre el input |
| `Todo/TodoTaskList.vue` | Lista con toolbar (buscar/filtrar/ordenar) y arrastre (SortableJS) entre secciones de un mismo proyecto cuando el orden es "Manual" y no hay búsqueda/filtro activo |
| `Todo/TodoTaskItem.vue` | Fila de tarea: checkbox real con `aria-label`, chip de fecha (rojo si vencida, verde si es hoy), ícono de recurrencia, etiquetas, progreso de subtareas |
| `Todo/TodoTaskDetail.vue` | Panel lateral en desktop / modal de pantalla completa en mobile (mismo patrón a11y que `SeriesEntriesModal.vue`): edita todos los campos, subtareas y el selector de recurrencia con preview de `describeRecurrence` |
| `Todo/TodoDashboard.vue` | Tiles de stats + barras de 28 días como SVG inline (cada barra con `title`/`aria-label` de fecha y cantidad) + desglose por proyecto y prioridad |
| `Todo/TodoUpcoming.vue` | Próximos 7 días agrupados, con vencidas arriba |
| `Todo/TodoCompleted.vue` | Vista "Completadas": historial paginado vía `GET /api/todo/completed` |
| `Todo/TodoShortcutsModal.vue` | Modal de ayuda de atajos (`?`) |
| `Todo/TodoToasts.vue` | Toast de error + toast de "Deshacer", flotantes sobre el menú (`z-[60]`) |

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
| `/api/movies/[id]` | GET, PUT, DELETE | GET: detalle por `tmdb_id` (acepta `trakt_id` por compatibilidad). PUT: edita `year_watched`/`platform` de una entrada de `movies_watched` por su `watched_id` (409 si choca con `UNIQUE(tmdb_id, year_watched)`). DELETE: borra una entrada de `movies_watched` por su `watched_id` |
| `/api/movies/lookup` | GET | `?q=<slug\|url de Trakt\|id de TMDB>` → previsualización sin guardar, con `watched_years` |
| `/api/movies/sync` | GET | Trigger Trakt movies sync (requires auth) |
| `/api/movies/lists` | GET | Movie lists metadata |
| `/api/movies/score/[tmdbId]` | PUT | `{ rating_personal?, rating_tmdb?, rating_imdb? }` (cada uno `number\|null`, opcional e independiente): clave ausente no toca ese campo; `null` lo borra (y para `rating_tmdb`/`rating_imdb` apaga su flag `*_manual` y resetea `ratings_fetched_at`, así el próximo visit a la ficha lo vuelve a pedir solo); un entero 0-100 lo guarda (y para `rating_tmdb`/`rating_imdb` prende `*_manual`) |
| `/api/series` | GET, POST | List all series / Create series entry |
| `/api/series/[id]` | GET, PUT, DELETE | Series entry CRUD by ID |
| `/api/series/sync` | GET | Trigger Trakt series sync (requires auth) |
| `/api/series/score/[slug]` | PUT | Mismo body y semántica que `/api/movies/score/[tmdbId]`, keyed por `trakt_slug` (`rating_personal` es una fila por serie, no por temporada) |
| `/api/streaming/unlock` | POST | `{ pin }` → valida el PIN y emite la cookie de sesión |
| `/api/streaming/lock` | POST | Borra la cookie de sesión de streaming |
| `/api/series/detail/[slug]` | GET | Series full detail (on-demand fetch) |
| `/api/igdb/lookup` | GET | `?q=<url\|slug\|id>` → datos de un juego de IGDB para autocompletar el modal |
| `/api/manga` | GET, POST | Lista de manga leído (JOIN `manga_read` ↔ `manga_cache`) / alta. El navegador ya resolvió y trajo el `media` de AniList; el POST manda `{ anilist_id, media, ...tracking }` y el servidor solo valida y guarda |
| `/api/manga/[id]` | PUT, DELETE | CRUD de una entrada de `manga_read` por su `id` |
| `/api/manga/lookup` | GET | Solo D1: `?id=<anilist_id>` → `{ already_added }`. La previsualización de AniList la trae el navegador directo, no este endpoint |
| `/api/manga/cache/[anilistId]` | PUT | Refresco client-driven de `manga_cache`: recibe `{ media }` ya traído de AniList por el navegador, valida y persiste. Lo llama `MangaRefresher.vue` |
| `/api/todo/bootstrap` | GET | `{ projects, sections, labels, tasks, completions }` en un solo round-trip: `tasks` = abiertas + completadas en los últimos 30 días, `completions` = últimos 90 días (para el dashboard) |
| `/api/todo/tasks` | POST | Crea una tarea. `labels: string[]` crea las etiquetas que falten |
| `/api/todo/tasks/[id]` | PATCH, DELETE | PATCH parcial (columnas permitidas; `labels` reemplaza el set completo) |
| `/api/todo/tasks/[id]/complete` | POST | `{ done, today? }` — `today` obligatorio si `done: true` (lo manda el cliente, en su hora local). Si la tarea es recurrente no la marca terminada: registra la finalización y mueve `due_date` a la próxima ocurrencia |
| `/api/todo/tasks/reorder` | POST | `{ id, project_id, section_id, sort_order }`. `sort_order` se calcula en el cliente con `between()` (orden fraccionario) |
| `/api/todo/projects`, `/[id]` | POST, PATCH, DELETE | La Bandeja de entrada no se puede renombrar/archivar/borrar; borrar un proyecto mueve sus tareas a la Bandeja |
| `/api/todo/sections`, `/[id]` | POST, PATCH, DELETE | Borrar una sección deja sus tareas sin sección (`ON DELETE SET NULL`) |
| `/api/todo/labels`, `/[id]` | POST, PATCH, DELETE | Nombre único, case-insensitive |
| `/api/todo/completed` | GET | `?before=&limit=` (máx 200) — historial paginado para la vista Completadas |

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
- **movies_cache** — **Solo metadata** (trakt_id PK, `tmdb_id` UNIQUE, poster, thumb, genres, rating, más columnas de detalle: tagline, certification, cast_json, videos_json, images_json, `data_source` (`'trakt' | 'tmdb'`), detail_fetched_at). Ya **no** tiene `list_slug` / `list_order` / `listed_at`: eso vive en `movies_watched`. `rating_tmdb` / `rating_imdb` (0-100, `vote_average * 10` / `imdbRating * 10` vía OMDb) y `ratings_fetched_at` se refrescan solos si tienen más de 30 días al visitar la ficha (`getMovieById`), aparte del `detail_fetched_at` de Trakt/TMDB
- **movies_watched** — Las películas vistas (`tmdb_id` + `year_watched` UNIQUE, `trakt_id` nullable, `trakt_slug`, `platform`, `source` `'trakt' | 'manual'`, `listed_at`). Es el equivalente de `series_watched`, y lo que permite que una película figure en más de un año
- **movies_lists** — Movie list metadata (slug PK, description, item_count)
- **movies_personal** — Score personal 0-100 (`tmdb_id` PK, `rating_personal` NOT NULL). Una fila por película, no por año visto: un rewatch en otro año muestra el mismo score. Se edita desde `MovieScoreEditor.vue` (`PUT /api/movies/score/[tmdbId]`) o desde `MoviesFormModal.vue` al dar de alta. El viejo `movies_cache.rating` (0-10, de Trakt/TMDB) sigue en la base pero **ya no se muestra**: la UI usa `rating_tmdb`/`rating_imdb`/`rating_personal`

**La clave de unión entre las dos es `tmdb_id`, no `trakt_id`.** Es el único
identificador que existe tanto en lo que devuelve Trakt como en lo que se puede
conocer sin su API. Una película cargada a mano guarda un `trakt_id` **provisional
negativo** (`-tmdb_id`), porque `movies_cache.trakt_id` es `INTEGER PRIMARY KEY`
—alias del rowid— y un `NULL` haría que SQLite asigne `max+1`, un id positivo que
puede chocar con el real. `moviesSync.ts` lo promueve al verdadero antes del
upsert; sin ese paso el sync falla con `UNIQUE constraint failed: movies_cache.tmdb_id`
y se pierde el lote entero de 50.

**Series tables**:
- **series_cache** — Cached series data (trakt_slug PK, poster, thumb, genres, `rating` de Trakt/TMDB 0-10 — se guarda pero **ya no se muestra**, plus detail columns: tagline, certification, cast_json, videos_json, images_json, seasons_json, `season_posters_json` (mapa `{"1":"url"}`), `data_source` (`'trakt' | 'tmdb'`), detail_fetched_at). `rating_tmdb` / `rating_imdb` (0-100, `vote_average * 10` / `imdbRating * 10` vía OMDb) y `ratings_fetched_at` se rellenan al dar de alta la serie (`syncSingleShow`, best-effort, no bloquea el alta) y se refrescan solos si tienen más de 30 días al visitar la ficha (`getSeriesDetail`); ese mismo refresh completa `tmdb_id`/`imdb_id` si faltaban
- **series_watched** — User's watched entries (trakt_slug + season_number UNIQUE, year_watched, platform, status_viewed)
- **series_personal** — Score personal 0-100 (`trakt_slug` PK, `rating_personal` NOT NULL). Una fila por serie, no por temporada: todas las temporadas de un mismo show comparten el mismo score. Se edita desde `SeriesEntriesModal.vue` (`PUT /api/series/score/[slug]`)

**Manga tables**:
- **manga_cache** — Metadata de AniList (`anilist_id` PK). Campos base (`title_romaji`,
  `title_english`, `title_native`, `type` derivado de `countryOfOrigin` — Manga/Manhwa/Manhua,
  `format`, `status`, `cover`, `chapters`, `volumes`, `average_score`, `genres_json`, etc.) más
  campos de detalle cargados on-demand (`tags_json`, `staff_json`, `characters_json`,
  `relations_json`, `recommendations_json`, `external_links_json`, `detail_fetched_at`)
- **manga_read** — Seguimiento personal (`anilist_id` UNIQUE, `estado`
  `Leyendo | Completado | Pausado | Abandonado | Pendiente`, `capitulo_actual`, `platform`,
  `fecha_inicio`/`fecha_final` en `DD/MM/YYYY`, `rating_personal` 0-100, mismas convenciones
  que `dates_played` y `rating_personal` de `games`)

**Streaming tables**:
- **streaming_accounts** — Cuentas de servicios de streaming (name UNIQUE, url, logo, email, password, plan, sort_order). Sustituye a `src/data/SSAccounts.js`, que está en `.gitignore`
- **streaming_attempts** — Freno de fuerza bruta del PIN (ip PK, fails, locked_until)

**Migraciones** (`db/migrate-*.sql`, se aplican con `wrangler d1 execute`): `add-movies-tables`,
`add-series-tables`, `add-detail-columns`, `add-thumb`, `add-season-posters`, `add-testing`,
`add-demo-early-access`, `add-data-source`, `add-movies-data-source`, `add-streaming-tables`,
`rename-rawg-opencritic`, `add-movies-watched`, `drop-movies-list-columns`,
`add-personal-rating`, `add-terminado-estado`, `add-manga-tables`, `add-movie-scores`,
`add-series-scores`, `add-manual-score-flags`, `add-todo-tables`.
`add-todo-tables` está aplicada solo en local; el remoto queda pendiente de un `OK`
explícito del usuario (ver "Todo" más abajo).
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

**Excepción: `--file` contra `--remote` puede fallar con `Auth error [code: 10000]`.**
Le pasó a `add-movie-scores`. Cuando eso pase, aplicar el contenido de la migración con
`--command` en su lugar (una o varias sentencias separadas por `;` dentro del mismo string):
```
npx wrangler d1 execute neon-burst-db --remote --command "ALTER TABLE ...; CREATE TABLE ...;"
```
`db/fetch-movie-scores.js` ya asume esto: nunca usa `--file`, solo `--command`.

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
- `src/services/seriesService.ts` — D1 CRUD for series_watched + series_cache + on-demand detail fetch from Trakt (cast, seasons, episodes, videos). `getAllSeries()`/`getSeriesDetail()` hacen LEFT JOIN con `series_personal`; `setPersonalRating()` es el alta/edición/borrado del score personal. `getSeriesDetail()` refresca `rating_tmdb`/`rating_imdb` (y completa `tmdb_id`/`imdb_id` si faltaban) si pasaron más de 30 días, igual que `getMovieById()` en `moviesService.ts`
- `src/services/seriesSync.ts` — Refreshes series_cache metadata from Trakt for current year / ongoing shows; `syncSingleShow` cae a TMDB y lanza `TraktRequestError` (→ HTTP 502) si ambas APIs fallan. También intenta `rating_tmdb`/`rating_imdb` al dar de alta (best-effort, no bloquea si TMDB/OMDb fallan)
- `src/services/tmdbSeries.ts` — Proveedor TMDB de series (fallback temporal, ver abajo): resuelve el slug de Trakt a un id de TMDB por búsqueda y devuelve los datos con la misma forma que las funciones de Trakt. `fetchTmdbTvScore()` y `fetchTmdbTvImdbId()` son los equivalentes de `tmdbMovies.ts#fetchTmdbScore` para el refresh de scores
- `src/services/anilist.ts` — Proveedor AniList (GraphQL público, sin auth). **AniList bloquea
  las IPs de salida de Cloudflare Workers con un 403** (confirmado en su foro; un `User-Agent`
  propio no lo arregló — ver CHANGELOG 1.11.1), así que `fetchAnilistPreview` y
  `fetchAnilistMedia` están pensadas para correr en el navegador (se importan desde
  `MangaFormModal.vue` y `MangaRefresher.vue`), nunca desde el servidor. Funciones puras
  (`parseAnilistQuery`, `countryToType`, `mapAnilistToCacheRow`, `validateAnilistMediaPayload`)
  no tienen import de `cloudflare:workers`, así que Vitest las testea directo y el Worker las usa
  para validar lo que sube el navegador. Errores de red/HTTP/429 se tipan como `AnilistRequestError`
  (mensajes en español), igual que `TraktRequestError` en `seriesSync.ts`
- `src/services/mangaService.ts` — D1 CRUD de `manga_read` + `manga_cache`. **Nunca llama a
  AniList** (ver arriba): `createMangaEntry()` recibe el `media` que ya trajo el navegador,
  lo valida el endpoint (`validateAnilistMediaPayload`) y acá solo se mapea y persiste.
  `getMangaDetail()` lee de D1 y devuelve `needs_refresh: true` cuando nunca se cargó el
  detalle, o cuando el manga sigue `RELEASING` y el caché tiene más de 7 días — la página de
  detalle decide ahí si monta `MangaRefresher.vue`. `refreshMangaCache()` es lo que ese
  refresco client-driven llama para persistir el nuevo `media`

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

**Sesión compartida con Todo.** El mismo PIN y la misma cookie `nb_streaming` desbloquean
`/streaming` y `/myTodoist`: no hay un PIN separado para Todo. `src/middleware.ts` exige
`isValidSessionToken()` para **todo** `/api/todo/*` (`isTodoApiPath()` en
`src/utils/todo/routeMatch.ts`), devolviendo **403** (no 401, mismo motivo que el punto
siguiente) con `{ "error": "Sesión requerida" }`. Para desarrollar Todo en local hace
falta `STREAMING_PIN` y `STREAMING_SESSION_SECRET` en `.dev.vars` o `.env` (ver
"Environment Variables"); sin esas dos variables, `/myTodoist` se queda en el gate del PIN
para siempre, incluso con el PIN correcto.

**Ojo con el 401 en POST:** el dev server de Astro con el adaptador de Cloudflare convierte
cualquier respuesta 401 a un POST en un `500 fetch failed` al reenviarla por el proxy de
vite (GET 401 y POST 403/429 funcionan bien). Por eso `unlock` devuelve **403** para el PIN
incorrecto y 429 para el bloqueo. No lo cambies a 401.

### Todo (gestor de tareas, `/myTodoist`)

Gestor de tareas personal, privado (misma puerta de PIN que Streaming, ver arriba).
Fase 1 + Fase 2 del plan original: sin kanban, calendario ni push, a propósito.

**Navegación**: se entra solo desde su `NavCard` del home (verde), como Streaming — ninguna de
las dos secciones privadas está en los links de `FloatingNav.astro`. A diferencia de
`/streaming` (única página aislada, con `hideMenu`), `/myTodoist` **sí muestra** el menú
flotante; sus elementos fijos (botón "+", toasts, drawer) ya reservan `--spacing-nav-clearance`.

**Modelo** (`db/migrate-add-todo-tables.sql`): `todo_projects` (una fila `is_inbox=1`,
la Bandeja de entrada, seedeada, no se puede borrar/renombrar/archivar), `todo_sections`
(por proyecto), `todo_tasks` (`priority` 1-4, 1 = más urgente; `due_date`/`due_time` como
texto plano sin timezone; `recurrence`; un solo nivel de subtareas vía `parent_id`),
`todo_labels` (nombre único case-insensitive), `todo_task_labels` (N:M) y
`todo_completions` (una fila por finalización, incluidas las recurrentes — así el
dashboard cuenta bien las tareas que se repiten). `sort_order` es `REAL` con indexado
fraccionario (`src/utils/todo/fractionalOrder.ts`: `between(a, b)`), así un reorder es un
solo `UPDATE` en vez de renumerar la lista entera.

**"Hoy" se calcula siempre en el cliente**, en hora local (`localToday()` en
`src/components/Vue/Todo/clientDate.ts`), nunca en el servidor: así una tarea con
vencimiento hoy no pasa a "vencida" a las 21h por un desfasaje UTC. Se manda al servidor
donde hace falta (completar una tarea recurrente: `POST /api/todo/tasks/[id]/complete`
exige `today` cuando `done: true`).

**Sintaxis de alta rápida** (`parseQuickAdd()` en `src/utils/todo/quickAdd.ts`, usada por
`TodoQuickAdd.vue`): `p1`-`p4` (prioridad), `#proyecto` (si no existe, warning + Bandeja
de entrada), `@etiqueta` (repetible, crea la etiqueta si no existe), fechas (`hoy`,
`mañana`, `pasado mañana`, nombre de día `lunes`/`el viernes` → próxima ocurrencia,
`25/12`, `25/12/2026`, `en 3 días`, `en 2 semanas`, `próxima semana`), hora (`a las 18`,
`18:30`, `6pm`) y recurrencia (`todos los días`/`cada día`, `cada semana`, `cada lunes`,
`cada mes`, `cada 15` → mensual día 15, `cada 3 días`). Los tokens reconocidos se sacan
del título; uno inválido (`31/02`) se queda en el título tal cual.

**Reglas de recurrencia**, guardadas como texto plano en `todo_tasks.recurrence`
(`src/utils/todo/recurrence.ts`): `daily`, `every:N:days`, `weekly:1,4` (ISO, 1 = lunes),
`monthly:15` (clampeado a fin de mes: `monthly:31` en febrero da 28 o 29).
`nextOccurrence(rule, fromDate)` calcula la próxima fecha; `describeRecurrence(rule)` da
la etiqueta en español que usa el preview de la alta rápida y el selector del detalle.
**Completar una tarea recurrente no la marca terminada**: registra una fila en
`todo_completions` y mueve `due_date` a la próxima ocurrencia; deshacerlo borra esa fila
pero no restaura la fecha anterior (limitación conocida, la recurrencia es de ida).

**UI** (`src/components/Vue/Todo/*`, patrón container-presentational): `TodoApp.vue` es
el container — crea el store (`useTodoStore.ts`) y lo provee por `provide`/`inject` a
todo el árbol, en vez de pasarlo por props. Ver la tabla de componentes más arriba para
el resto. Acento neon-green para toda la sección; colores de prioridad en un mapa
literal (`src/utils/todo/priorityStyles.ts`: P1 pink, P2 orange, P3 blue, P4 muted),
mismo patrón que los mapas de acento de `EditButton.vue`/`SyncButton.vue`.

### On-Demand Detail Fetch Pattern

Movies and series use a lazy-loading pattern for detailed data:
1. Sync scripts populate basic data (title, poster, thumb, rating, genres)
2. When a user visits a detail page (`/movies/[id]` or `/series/[slug]`), the service checks `detail_fetched_at`
3. If null, it fetches from Trakt API: full metadata, cast (`/people?extended=full`), seasons+episodes, and videos
4. Stores everything in JSON columns (`cast_json`, `videos_json`, `images_json`, `seasons_json`) and sets `detail_fetched_at`
5. Subsequent visits use cached data from D1

**Manga es la excepción: el refresco es client-driven, no server-side.** El servidor no
puede llamar a AniList (bloquea las IPs de Cloudflare Workers, ver `anilist.ts`), así que
`getMangaDetail()` solo lee D1 y devuelve `needs_refresh`; si es `true`, `manga/[id].astro`
monta `MangaRefresher.vue` (`client:idle`), que hace el fetch a AniList desde el navegador y
sube el resultado por `PUT /api/manga/cache/[anilistId]`.

### External APIs

- **Trakt API** — Movies and series data, cast, seasons/episodes. All images come from Trakt (poster, fanart, thumb, headshots). Uses `?extended=full` for images.
- **Steam API** — Steam library and game details
- **IGDB (via Twitch OAuth)** — Upcoming games with community interest metrics
- **RAWG API** — Internal source for the Metacritic score only (its own user rating is not stored)
- **OpenCritic (via RapidAPI)** — `topCriticScore` (0-100) shown next to Metacritic
- **TMDB API** — YouTube video trailers, `rating_tmdb` (`vote_average * 10`), y **fallback temporal de series y películas** (ver abajo)
- **OMDb API** — Fuente de `rating_imdb`, buscando por `imdb_id` (`movies_cache.imdb_id`). Free tier: 1000 requests/día. `src/services/omdb.ts`
- **AniList API** — Metadata de manga/manhwa/manhua vía GraphQL público (`https://graphql.anilist.co`).
  **No requiere autenticación** para lecturas: el Client ID/Secret no se usan. Neon Burst es la
  única fuente de verdad para lo leído — no hay sync con la lista de AniList del usuario ni OAuth.
  **Se consulta solo desde el navegador**: AniList bloquea las IPs de salida de Cloudflare Workers
  con un 403 (confirmado en su foro), así que el servidor nunca la llama — ver `anilist.ts` arriba

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

- **Accent colors**: neon-blue `#1e90ff` (primary), neon-cyan `#00e5ff`, neon-pink `#ff2d95`, neon-purple `#b026ff`, neon-orange `#ff7b00`, neon-gold `#ffd700`, neon-yellow `#e5ff00`, neon-green `#39ff14`, neon-emerald `#34d399`, neon-indigo `#818cf8` (blue/cyan/pink también tienen variante `-dim` con alpha `66`)
- **Surfaces**: surface-0 `#06060a` through surface-4 `#222236`
- **Texto**: text-primary `#e8e8f0`, text-secondary `#9898b0`, text-muted `#5c5c78`
- **Bordes**: border-default `#1e1e30`, border-hover `#2a2a42`
- **Font**: Fira Code (monospace, Google Fonts) — terminal aesthetic
- **Neon glow classes**: `neon-glow-blue`, `neon-glow-cyan`, `neon-glow-pink` (defined in global.css)
- **Neon border classes**: `neon-border-blue`, `neon-border-cyan`, etc.
- **CRT scanline overlay**: subtle 2px repeating gradient
- **Per-section accent colors**: blue (played games), cyan (Steam), pink (next games), emerald (movies), indigo (series), orange (manga), green (Todo)
- **Editar solo desde la ficha**: juegos, películas, series y manga se editan únicamente desde un botón "Editar" en su página de detalle — nunca desde la tarjeta del listado, que solo agrega. El botón es siempre `EditButton.vue` con el acento de la sección (blue/indigo/emerald/orange); en juegos y manga abre el mismo form modal en modo edición, en series y películas abre un modal con la lista de entradas (una por temporada vista o por año visto), porque puede haber más de una
- **Estado colors**: green (Terminado), gold (Completado), pink (Abandonado), blue (Jugando), yellow (Pausado), purple (Recurrente)
- **`Terminado` vs `Completado`**: `Terminado` es haber terminado la campaña o historia; `Completado` es tener el **100% de los logros**, y por eso lleva trofeo y color dorado en el dashboard en vez del check. Antes `Completado` significaba las dos cosas, y `migrate-add-terminado-estado.sql` separó los 51 juegos que había: 45 quedaron en Terminado y 6 en Completado por tener `logros_obt >= logros_total`
- **Badges de flags**: indigo (Demo), emerald (Early Access), cyan (Review/`is_testing`). Regla al agregar un flag nuevo: los estados conservan su color documentado, el flag toma uno libre
- **El listado y la ficha muestran cosas distintas a propósito**:
  - En `PlayedGamesCard.vue`, si el juego tiene **alguna** marca (`is_demo`, `is_early_access`, `is_testing`), la marca **reemplaza** al badge de estado — ver `hasFlag`. En una demo o un Early Access, "esto no es el juego final" pesa más que en qué punto se dejó, y la fila de badges deja de amontonarse
  - En `playedGames/[id].astro` se muestran **todas** juntas, marcas y estado: es donde hay lugar para el detalle completo
  - El estado sigue en el `aria-label` de la card aunque no se vea, así que un lector de pantalla no lo pierde
- **Colores de rating**: cada uno usa **la escala de quien lo emite**, no una común. Metacritic/OpenCritic están definidos en `ratingColor` de `src/pages/playedGames/[id].astro`; el score personal (juegos, películas y series) y los scores TMDB/IMDb viven en el módulo compartido `src/utils/ratingBands.ts`:

  | rating | bandas |
  |---|---|
  | Metacritic | green `>= 75`, yellow `>= 50`, pink debajo (cortes fijos y oficiales) |
  | OpenCritic | green `>= 84` (Mighty), emerald `>= 75` (Strong), yellow `>= 65` (Fair), pink debajo (Weak) |
  | Mi score (juegos, películas y series) | blue `>= 90`, green `>= 70`, yellow `>= 55`, orange `>= 45`, pink debajo — `ratingBands.personal` |
  | TMDB / IMDb | green `>= 70`, yellow `>= 50`, pink debajo — `ratingBands.tmdb` / `ratingBands.imdb`, el corte 7/5 de Trakt sobre 10 movido a 0-100 |

- **Series: TMDB / IMDb / Mi score reemplazan el rating de Trakt.** Igual que en películas
  (ver `movies_personal` arriba), `series_cache.rating` (Trakt/TMDB, 0-10) se sigue guardando
  pero ya no se muestra en ningún lado. `SeriesCard.vue` muestra un único badge con el
  promedio de los scores disponibles (`averageScore` + `tmdbImdbBand`, igual que
  `MoviesCard.vue`); `series/[slug].astro` muestra los tres badges por separado
  (`rating_tmdb` / `rating_imdb` / `rating_personal`), cada uno solo si no es `null`. A
  diferencia del score personal de películas (por `tmdb_id`, una fila por película), el de
  series es **por serie completa**, no por temporada: se edita en `SeriesEntriesModal.vue`
  vía `PUT /api/series/score/[slug]`, keyed por `trakt_slug`.
- **Override manual de `rating_tmdb` / `rating_imdb`.** A veces TMDB/OMDb no tienen el dato
  (OMDb devuelve `N/A`) o no cargan; `movies_cache`/`series_cache` tienen
  `rating_tmdb_manual` / `rating_imdb_manual` (0/1, `db/migrate-add-manual-score-flags.sql`)
  para cargarlo a mano desde `MoviesEntriesModal.vue`/`SeriesEntriesModal.vue` (inputs "TMDB"
  e "IMDb" junto a "Mi score", vacío = automático). **Manual gana sobre el refresco**: tanto
  el refresco de 30 días (`refreshMovieScoresIfStale`/`refreshSeriesScoresIfStale`) como los
  backfills (`db/fetch-movie-scores.js`/`db/fetch-series-scores.js`) leen el flag y, si está
  prendido, ni siquiera piden ese campo a la API — la decisión de qué valor persistir vive en
  la función pura `mergeFetchedScores` (`src/services/movieScores.ts`), compartida por ambos
  servicios. Borrar el valor a mano (mandar `null`) apaga el flag y resetea
  `ratings_fetched_at`, así el próximo visit a la ficha lo vuelve a pedir solo. El detalle
  (`movies/[id].astro`/`series/[slug].astro`) muestra un discreto "(manual)" junto al badge
  cuando el flag está prendido.

  **Los tiers de OpenCritic son percentiles, no cortes fijos** (Mighty = 10% superior, Strong = 30% siguiente, Fair = del 30 al 60, Weak = 30% inferior). 84/75/65 es la traducción práctica y puede moverse con el tiempo.
- **`rating_personal` en la lista**: va en la fila de datos de `PlayedGamesCard.vue`/`MoviesCard.vue`, con una estrella y el número en el color de su banda. Si es NULL no se renderiza **ni el separador `·`**, así que la fila no queda coja — con 58 de 66 juegos sin puntuar, la ausencia tiene que verse deliberada
- Las clases de color de rating viven en los mapas `badgeClass` / `textClass` de `src/utils/ratingBands.ts`, escritas literales: Tailwind escanea el código como texto y purga cualquier clase que se arme por interpolación. `playedGames/[id].astro`, `PlayedGamesCard.vue`, `movies/[id].astro` y `MoviesCard.vue` los importan de ahí en vez de duplicarlos
- Floating bottom nav: icon-only on mobile, icons+labels on desktop
- **Contrato único de spacing de página** (`src/layouts/Layout.astro` + tokens en
  `src/styles/global.css` `@theme`): gutter horizontal `--spacing-gutter` (1rem, `px-gutter`,
  mobile y desktop); top `pt-4 sm:pt-8`; ancho `max-w-7xl mx-auto`; cierre inferior
  `--spacing-nav-clearance` (4.5rem + `env(safe-area-inset-bottom)`, `pb-nav-clearance`) para
  reservar el alto real de `FloatingNav.astro` en toda página con nav, o
  `--spacing-page-bottom` (2rem + safe-area, `pb-page-bottom`) en las que la ocultan
  (`hideMenu`). `FloatingNav.astro` empuja su propia píldora con el mismo `safe-area-inset-bottom`
  para no quedar bajo el home indicator de iOS. **Ninguna página ni container Vue define su
  propio padding/margin exterior**: heredan el único `<main>` de `Layout.astro`. Todo
  overlay fijo que pueda coincidir con la barra (modales, el toast de `streaming.astro`) usa
  `z-[60]`, por encima del `z-50` de `FloatingNav.astro`
- Reduced motion support via `prefers-reduced-motion`

### Versionado (SemVer)

El sitio sigue `MAJOR.MINOR.PATCH`. **Única fuente de verdad: `"version"` en
`package.json`**; `src/pages/index.astro` la importa y la muestra bajo el hero (`$ v1.11.0`).
No escribas el número a mano en ningún otro archivo de código.

**Todo cambio que se vaya a pushear sube la versión en el mismo commit**, junto con una
entrada nueva arriba de todo en `CHANGELOG.md` (fecha `YYYY-MM-DD` + viñetas en español
de lo que cambió para el usuario, no de archivos). Qué número subir:

| Sube | Cuándo | Ejemplos |
|---|---|---|
| **MAJOR** (`x.0.0`) | Rediseño completo, o se elimina/rompe una sección o una URL pública | Cambiar toda la estética; sacar `/streaming`; renombrar `/ListMovies` |
| **MINOR** (`1.x.0`) | Funcionalidad o sección nueva visible, o columna/tabla nueva que la habilita | Sección Manga; scores TMDB/IMDb; botón Editar homologado |
| **PATCH** (`1.11.x`) | Fix, ajuste visual, texto, refactor o docs sin comportamiento nuevo | Padding; título de página; bug en un filtro |

- Al subir MINOR el PATCH vuelve a 0; al subir MAJOR, MINOR y PATCH vuelven a 0
- Varios cambios en el mismo push: se sube **una** vez, por el cambio de mayor rango
- Cambios que solo tocan tooling interno (scripts de `db/`, tests, CLAUDE.md) sin efecto en
  el sitio: PATCH, o ninguna subida si no se deployan junto con otra cosa
- Las versiones ≤ 1.10.0 se reconstruyeron del historial de git (1.0.0 = sitio completo en
  producción, 06/04/2026); ver `CHANGELOG.md`

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
- `TMDB_API_KEY` — TMDB API key (trailers + fallback temporal de series + `rating_tmdb`)
- `OMDB_API_KEY` — OMDb API key, para `rating_imdb` (en `.env` local **y** `wrangler secret put OMDB_API_KEY` para el worker; sin ella, `rating_imdb` se deja en `NULL` sin bloquear nada)
- `CRON_SECRET` — Authenticates cron/sync requests
- `STREAMING_PIN` — PIN de 6 dígitos que abre `/streaming` **y** `/myTodoist` (misma
  sesión). En local, sin esta variable (en `.dev.vars` o `.env`) ninguna de las dos
  páginas se puede desbloquear
- `STREAMING_SESSION_SECRET` — Clave HMAC que firma la cookie de sesión compartida de
  Streaming/Todo. Igual que la de arriba, hace falta en local para desarrollar Todo
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

- **Language**: Spanish throughout — UI text, field names (`estado`, `horasTotal`, `logros_obt`, `fecha_inicio`), status enums (`Jugando`, `Recurrente`, `Pausado`, `Terminado`, `Completado`, `Abandonado`)
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
