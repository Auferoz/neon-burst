# Neon Burst

Tracker personal de entretenimiento con estética neon/cyberpunk dark mode y terminal retro.

Seguimiento de juegos jugados, biblioteca de Steam, juegos por salir, películas vistas por año y series de TV.

## Stack

- **Astro 6** — Framework web con SSR en Cloudflare Workers
- **Vue 3** — Componentes interactivos con hidratación `client:load`
- **Tailwind CSS 4** — Estilos utility-first con tema neon personalizado
- **Cloudflare Workers/Pages** — Hosting con deploy automático desde GitHub
- **Cloudflare D1** — Base de datos SQLite en el edge
- **TypeScript** — Tipado estricto

## Secciones

| Sección | Descripción | Fuente de datos |
|---------|-------------|-----------------|
| Juegos Jugados | Catálogo personal de juegos completados, en progreso o abandonados | Manual + RAWG (ratings) |
| Mi Biblioteca Steam | Librería de Steam sincronizada con tiempos de HLTB | Steam API + HowLongToBeat |
| Próximos Juegos | Juegos por salir con interés de la comunidad | IGDB (via Twitch) |
| Películas | Películas vistas organizadas por año con listas de Trakt | Trakt API |
| Series | Series vistas con temporadas, episodios y cast | Trakt API |

## Desarrollo

```bash
npm install
npm run dev
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build |
| `npm run generate-types` | Generar tipos de Cloudflare Workers |
| `npm run sync-local` | Sincronizar base de datos local |
| `npm run fetch-ratings` | Obtener ratings de juegos desde APIs externas |
| `npm run sync-steam` | Sincronizar librería Steam (local) |
| `npm run sync-steam:remote` | Sincronizar librería Steam (remoto) |
| `npm run sync-movies` | Sincronizar películas desde Trakt (local) |
| `npm run sync-movies:remote` | Sincronizar películas desde Trakt (remoto) |
| `npm run seed-series` | Seed inicial de series + sync cache (local) |
| `npm run seed-series:remote` | Seed inicial de series (remoto) |
| `npm run sync-series` | Refrescar cache de series desde Trakt (local) |
| `npm run sync-series:remote` | Refrescar cache de series (remoto) |

## Estructura

```
src/
├── components/
│   ├── Astro/        # PageHeader, EmptyState, FloatingNav, NavCard
│   ├── Vue/          # Componentes interactivos (Games, Steam, Movies, Series)
│   └── Icons/        # Iconos SVG (Lucide-style)
├── pages/
│   ├── playedGames/  # Lista y detalle de juegos jugados
│   ├── movies/       # Detalle de película (cast, trailer, fanart)
│   ├── series/       # Detalle de serie (cast, temporadas, episodios)
│   └── api/          # Endpoints REST (games, steam, next-games, movies, series)
├── services/         # Lógica de negocio y sync con APIs externas
├── layouts/          # Layout base con navegación
└── styles/           # Tema Tailwind con tokens neon
db/                   # Schema SQL, seeds, scripts de sync, migraciones
integrations/         # Cloudflare Cron (sync diario a la 1 AM UTC)
```

## APIs Externas

- **Trakt** — Películas y series (metadata, cast, temporadas, episodios, imágenes)
- **Steam** — Librería de juegos y detalles
- **IGDB** — Juegos próximos a salir (via Twitch OAuth)
- **RAWG** — Ratings de juegos
- **TMDB** — Trailers de YouTube

## Diseño

- Tema oscuro neon/cyberpunk con fuente monospace (Fira Code)
- Colores de acento por sección: azul (juegos), cyan (Steam), rosa (próximos), esmeralda (películas), índigo (series)
- Efecto CRT scanline sutil
- Clases de glow neon (`neon-glow-blue`, `neon-glow-cyan`, `neon-glow-pink`)
- Navegación flotante inferior adaptable a móvil/desktop
- Soporte para `prefers-reduced-motion`

## Deploy

Push a GitHub despliega automáticamente en Cloudflare Workers/Pages. Cron diario a la 1 AM UTC sincroniza Steam, IGDB, películas y series.

## Variables de Entorno

| Variable | Uso |
|----------|-----|
| `STEAM_API_KEY` | API de Steam |
| `STEAM_ID` | ID de usuario Steam |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | Acceso a IGDB |
| `RAWG_API_KEY` | Ratings de juegos |
| `TRAKT_CLIENT_ID` | API de Trakt (películas y series) |
| `TMDB_API_KEY` | Trailers de YouTube |
| `CRON_SECRET` | Autenticación de endpoints de sync |

## Requisitos

- Node.js >= 22.12.0
