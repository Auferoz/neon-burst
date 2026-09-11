# Plan: `movies_watched` + alta manual de películas

Estado: **✅ COMPLETADO — las 6 fases** · Última actualización: 2026-09-11

## Por qué

La API de Trakt pasó a ser de pago y responde `403` a todo, así que
`moviesSync.ts` devuelve 0 y no entran películas nuevas. La pertenencia a listas
(qué película está en `movies-2026`) solo la sabe Trakt, y no hay forma de
recuperarla desde TMDB.

El objetivo es poder cargar a mano cada película vista mientras Trakt esté caído,
**sin desactivar el sync**, y que cuando Trakt vuelva las dos fuentes converjan en
vez de duplicarse. Las películas que se cargan a mano también se van agregando a
la lista de Trakt, así que la misma película va a llegar por los dos caminos.

## El problema de fondo

Series y películas están modeladas distinto, y esa es la razón de que una funcione
sin Trakt y la otra no:

| | series | películas |
|---|---|---|
| tabla de datos propios | `series_watched` | **no existe** |
| tabla de metadata | `series_cache` | `movies_cache` |
| clave de identidad | `trakt_slug` (está en la URL) | `trakt_id` (solo lo da la API) |

`movies_cache` es la lista *y* la metadata a la vez. Su PK es `trakt_id`, un número
interno que sin la API no se puede conocer. Además `list_slug` es **una sola
columna**, así que una película no puede figurar en dos años: el upsert la pisa.
Ese dato hoy se pierde en silencio.

## Decisiones tomadas

1. **La clave de unión es `tmdb_id`, no `trakt_slug`.** Es la única disponible en
   las dos puntas: las 481 filas existentes ya lo tienen (verificado: 481/481, cero
   colisiones), y ninguna tiene slug porque el sync nunca lo guardó. Unir por slug
   dejaría el catálogo histórico sin poder engancharse a nada.
2. **`trakt_slug` se guarda igual**, porque es lo que se escribe en el alta, sirve
   para linkear a Trakt desde la ficha y para verificar la película cuando Trakt
   vuelva. Simplemente no es la clave que une las tablas.
3. **El alta manual se hace escribiendo el slug de Trakt** (`dune-part-two-2024`),
   que se resuelve contra TMDB reusando el patrón de `slugToQuery()` +
   `lookupTmdbTvId()` que ya existe en `tmdbSeries.ts`.
4. **Un solo campo acepta slug de Trakt, URL de Trakt, o id/URL de TMDB**, igual
   que el lookup de IGDB en el modal de juegos. El id es la salida de emergencia
   para los casos que la búsqueda por texto no puede resolver.
5. **El sync no se toca hasta la fase 4**, y `movies_cache.list_slug` se conserva
   como red de seguridad hasta la fase 5.

## Evidencia medida (2026-09-11)

Prueba de precisión sobre el catálogo completo: se armó el slug estilo Trakt desde
`title` + `year` de cada fila de `movies_cache`, se resolvió por
`/search/movie`, y se comparó contra el `tmdb_id` ya guardado (verdad de
referencia).

| | resultado |
|---|---|
| con `&year=` (lo que usa hoy `tmdbSeries.ts`) | 471/481 — **97.9%** |
| con `&primary_release_year=` | 476/481 — **99.0%** |

→ **Usar `primary_release_year`**, que es el filtro estricto.

Los 10 fallos con `year` eran todos remakes o títulos repetidos (Robin Hood 2018 vs
2010, Tomb Raider 2018 vs 2001, All Quiet on the Western Front 2022 vs 1930). El
filtro estricto corrige 5. Los 5 restantes son colisiones de mismo título y mismo
año que **ninguna búsqueda por texto puede resolver**:

```
all-quiet-on-the-western-front-2022    bubble-2022
miracle-in-cell-no-7-2019              the-climb-2017
the-hater-2020
```

Para esos se pega el id de TMDB. Y el modal debe **mostrar la película resuelta
(póster, título, año) antes de guardar**: esa confirmación visual es la red real,
más que cualquier porcentaje.

### Estado real del bloqueo de Trakt (medido 2026-09-11)

| destino | resultado |
|---|---|
| `api.trakt.tv/movies/<slug>` **con `trakt-api-key`** | `403` |
| `api.trakt.tv/shows/<slug>` **con `trakt-api-key`** | `403` |
| `api.trakt.tv/movies/ruta-inventada-9999` | `403` |
| `api.trakt.tv/...` con User-Agent de navegador | `403` |
| `app.trakt.tv/movies/<slug>` con User-Agent de navegador | **`200`** |

La API está detrás del paywall y no distingue rutas: corta por auth antes de
resolver, así que **no se puede verificar si acepta slug en `/movies/<slug>`**
hasta tener acceso.

La web sí responde, pero solo si el User-Agent parece un navegador — sin eso
también da `403`. Y el HTML no sirve: 29 KB de cascarón de SPA, `og:title` es el
genérico del sitio (`"Trakt Web: Track Your Shows & Movies"`), sin JSON-LD y sin
una sola referencia a TMDB o IMDb. Los datos entran por JavaScript. Scrapear
sigue sin ser viable.

→ TMDB es el único camino para resolver el slug mientras esto siga así.

---

## Fase 1 — `movies_watched` (aditiva, no rompe nada) ✅ COMPLETADA

- [x] **1.1** `db/migrate-add-movies-watched.sql`: tabla `movies_watched` con
      `id` PK, `tmdb_id` NOT NULL, `trakt_id` nullable, `trakt_slug`,
      `year_watched` NOT NULL, `platform`, `source` (`'trakt' | 'manual'`),
      `listed_at`, y `UNIQUE(tmdb_id, year_watched)` — eso habilita el rewatch.
- [x] **1.2** Índice `UNIQUE` en `movies_cache(tmdb_id)`. Verificado: 0 colisiones.
- [x] **1.3** Backfill sin pérdida desde el caché actual:
      `INSERT OR IGNORE INTO movies_watched (tmdb_id, trakt_id, year_watched, listed_at, source)
      SELECT tmdb_id, trakt_id, CAST(substr(list_slug, 8) AS INTEGER), listed_at, 'trakt'
      FROM movies_cache WHERE tmdb_id IS NOT NULL AND list_slug LIKE 'movies-____';`
- [x] **1.4** Aplicada en **local y remoto**.

Verificación (ambas bases): `movies_cache` 481 = `movies_watched` 481, 9 años,
0 filas con año inválido, **0 huérfanas** en el JOIN por `tmdb_id`, y el conteo por
año coincide exacto contra `list_slug` en los 9 años.

> Nota aparte, preexistente: `movies_lists.item_count` suma 513 contra las 481 de
> `movies_cache`. Resuelto más abajo, en "Las 32 entradas faltantes": son
> rewatches que el modelo viejo no podía representar, no películas perdidas.

## Fase 2 — Leer desde la tabla nueva ✅ COMPLETADA

- [x] **2.1** `moviesService.ts`: `getAllMovies()` + interfaz `MovieListItem`, con
      JOIN `movies_watched` ↔ `movies_cache` por `tmdb_id`, ordenado por
      `year_watched DESC, listed_at DESC`.
- [x] **2.2** `GET /api/movies` pasa a usarla (antes hacía `SELECT * FROM
      movies_cache` directo en el endpoint).
- [x] **2.3** `MoviesMain.vue`: `allYears` y el filtro leen `year_watched`; se quitó
      `list_slug` de la interfaz.
- [x] **2.4** Checkpoint pasado.

Verificación: se comparó la respuesta vieja contra la nueva, fila por fila.
**481 = 481, 0 años distintos, 0 filas nuevas o faltantes**, y el conteo por año
idéntico en los 9 años. `npm run build` limpio y `/ListMovies` responde 200.

Cambio adicional: el `:key` de la grilla pasó de `trakt_id` a `watched_id`. Con
`movies_watched` la misma película puede aparecer en dos años, y además lo manual
no va a tener `trakt_id` — la key vieja se rompía en los dos casos.

`platform` está en `null` en las 481 filas, como se esperaba: Trakt nunca dio ese
dato, la columna es para las altas manuales.

## Fase 3 — Alta manual ✅ COMPLETADA

- [x] **3.1** `slugToQuery()` extraída a `src/utils/mediaQuery.ts`, junto con
      `parseMediaQuery()`. `tmdbSeries.ts` la importa de ahí.
- [x] **3.2** `tmdbMovies.ts`: `lookupTmdbMovieId()` contra `/search/movie` con
      **`primary_release_year`**, con reintento sin año.
- [x] **3.3** `moviesService.ts`: `createMovieEntry()`, `getMovieEntry()`,
      `deleteMovieEntry()` y `CreateMovieFailure` con motivos tipados.
- [x] **3.4** `POST /api/movies`, `DELETE /api/movies/[id]` y
      `GET /api/movies/lookup` (previsualización sin guardar).
- [x] **3.5** `MoviesFormModal.vue` con previsualización: póster, título, año,
      `tmdb_id`, sinopsis y **en qué años ya está registrada**. El botón Agregar
      está deshabilitado hasta que haya una previsualización confirmada.
- [x] **3.6** Botón "Agregar" en `MoviesMain.vue`, con las plataformas ya usadas
      como sugerencias del campo.
- [x] **3.7** La ruta de detalle pasó a `tmdb_id`. `getMovieById()` busca primero
      por `tmdb_id` y cae a `trakt_id` para no romper links viejos.

### Decisiones de implementación

**`trakt_id` provisional negativo.** `movies_cache.trakt_id` es
`INTEGER PRIMARY KEY`, o sea alias del rowid: insertar `NULL` haría que SQLite
asigne `max+1`, un id positivo que puede chocar con el `trakt_id` real de otra
película cuando vuelva el sync. Los ids de Trakt son siempre positivos, así que
un alta manual guarda `-tmdb_id`. La fase 4 lo reemplaza por el real.

**Título en inglés.** `tmdbFetch` pide todo en `es-ES`, así que la primera prueba
guardó "Dune: Parte dos" al lado de "No Time to Die". Se agregó
`fetchTmdbEnglishTitle()`: el título va en inglés como las 481 de Trakt, la
sinopsis se queda en español.

**El link a Trakt se oculta** en el detalle cuando el `trakt_id` es provisional:
`trakt.tv/movies/-693134` no existe.

### Verificación

`POST /api/movies`, los 7 casos: slug válido `201`, duplicado `409`, **misma
película en otro año `201`** (el rewatch que el modelo viejo no podía guardar),
query basura `400`, inexistente `404`, id de TMDB `201`, falta `year_watched`
`400`. `DELETE`: `200` / `404` / `400` con id inválido.

`GET /api/movies/lookup`: slug `200`, id de TMDB `200`, URL de Trakt `200`,
inexistente `404`, basura `400`. Devuelve `watched_years` correctamente.

Detalle: manual por `tmdb_id` `200` **sin** link a Trakt; de Trakt por `tmdb_id`
`200` **con** link; por `trakt_id` viejo `200` (compatibilidad); inexistente
redirige.

`npm run build` limpio. Los datos de prueba se borraron: la base quedó en 481/481
con 0 manuales.

> Ojo con `DELETE` desde `curl`: Astro lo rechaza con
> `Cross-site DELETE form submissions are forbidden` si no va el header `Origin`.
> Desde el navegador no pasa, `fetch` lo manda solo.

## Fase 4 — Reconciliación cuando Trakt vuelva ✅ COMPLETADA

- [x] **4.1** `promoteProvisionalRows()` en `moviesSync.ts`, **antes** del upsert:
      empareja por `tmdb_id` y reemplaza el `trakt_id` provisional por el real.
- [x] **4.2** `upsertWatched()` con `ON CONFLICT(tmdb_id, year_watched)`: la fila
      manual pasa a `source = 'trakt'` con su `trakt_id`, en vez de duplicarse.
      El `platform` y el `trakt_slug` cargados a mano se conservan.
- [x] **4.3** Probado con sync simulado (Trakt sigue en 403, así que se ejecutó el
      mismo SQL con datos con forma de respuesta de Trakt).

### El sync también escribe en `movies_watched`

No estaba en el plan original y es imprescindible: desde la fase 2 la lista se lee
por JOIN contra `movies_watched`, así que un sync que solo escribiera
`movies_cache` sería **mudo** — las películas nuevas de Trakt entrarían al caché y
no aparecerían nunca en la página. `upsertWatched()` lo resuelve, y de paso cierra
la reconciliación del punto 4.2 con el mismo `ON CONFLICT`.

También se agregó el `CREATE TABLE IF NOT EXISTS movies_watched` y el índice único
al bloque de bootstrap del sync, para que una base creada desde cero funcione.

### Verificación

Alta manual de Dune: Part Two (2026, plataforma "Cine") → `movies_cache.trakt_id`
= `-693134`, `movies_watched.source` = `manual`. Después del sync simulado con el
`trakt_id` real `501024`:

| | resultado |
|---|---|
| filas en `movies_cache` para esa película | **1** |
| filas en `movies_watched` | **1** |
| `trakt_id` en ambas | `501024` (promovido) |
| `source` | `trakt` (confirmado) |
| `platform` | `Cine` — **el dato del usuario sobrevive** |
| `trakt_slug` | `dune-part-two-2024` — conservado |

**Experimento de control:** corriendo el mismo sync **sin** el paso de promoción,
el resultado no es un duplicado sino un error:
`UNIQUE constraint failed: movies_cache.tmdb_id`. El índice único de la fase 1 lo
impide. Pero el modo de falla es peor de lo que parece: eso ocurre dentro de
`db.batch(ops)`, que el sync captura como `errors += batch.length`, así que **una
sola película manual haría fallar el lote entero de 50, en silencio**. La
promoción no es una optimización, es lo que hace que el sync funcione.

> Caso no cubierto, a propósito: si una película se cargó a mano en 2026 y Trakt
> la lista en 2025, quedan dos filas en `movies_watched` (2026 manual y 2025
> trakt). No es un duplicado —es "vista en dos años", que es justamente lo que la
> tabla permite—, pero conviene saber que puede pasar y se corrige borrando la
> que sobre.

## Fase 5 — Limpieza ✅ COMPLETADA

- [x] **5.1** `db/migrate-drop-movies-list-columns.sql`: se eliminaron `list_slug`,
      `list_order` y `listed_at` de `movies_cache`, más el índice
      `idx_movies_cache_list`. Aplicada en local y remoto.
- [x] **5.2** `movies_lists` intacta: sigue siendo metadata de las listas de Trakt.
- [x] Código actualizado: `moviesSync.ts` (upsert y bootstrap), `moviesService.ts`
      (interfaz `MovieDetail` y `rowToMovieDetail`), `db/schema.sql`.

### `db/sync-movies.js` tenía el mismo problema

No estaba en el plan. Es el script local (`npm run sync-movies`), que hace lo
mismo que el worker por fuera de él y **tampoco escribía `movies_watched`**:
habría quedado mudo igual, y sin el paso de promoción habría chocado contra el
`UNIQUE` de `tmdb_id`. Se le agregaron las dos cosas.

`db/schema.sql` ahora incluye `movies_watched` y el índice único de `tmdb_id`, así
que una base creada desde cero ya nace correcta.

### Verificación

Antes de dropear se respaldaron las 481 filas con sus columnas en
`db/backup-movies-list-slug.json` (`trakt_id`, `tmdb_id`, `title`, `list_slug`,
`list_order`, `listed_at`).

Después, contra local: **481 filas, 0 años distintos** respecto de la respuesta de
la fase 2, conteo por año idéntico en los 9 años, `/ListMovies` `200`, detalle
`200`, y un alta manual de prueba devolvió `201` con su `trakt_id` provisional.
En remoto: columnas eliminadas, 481/481, 9 años.

`rg` sobre `src/` y `db/` no deja ninguna referencia a las columnas eliminadas.
`npm run build` limpio.

## Fase 6 — Documentación y cierre ✅ COMPLETADA

- [x] **6.1** `CLAUDE.md`: tabla de endpoints corregida (el doc drift se resolvió
      solo, porque ahora `POST` y `DELETE` **sí** existen — `PUT` no, y se quitó),
      `movies_watched` en el esquema con la explicación del `trakt_id` provisional,
      sección nueva "Alta manual de películas" con la tabla de precisión medida,
      servicios y componentes actualizados, migraciones agregadas a la lista.
- [x] **6.2** `README.md`: fila de Películas y fuente de datos.
- [x] **6.3** `npm run build` limpio. Rutas verificadas en dev: `/ListMovies`,
      `/api/movies`, `/api/movies/lookup`, `/movies/[id]`, `/ListSeries` y
      `/playedGames` todas `200`. Lista en 481 con el conteo por año intacto.

### Aviso agregado a `CLAUDE.md`

La lógica de sync está **duplicada**: existe en el worker (`src/services/*Sync.ts`)
y como script local (`db/sync-*.js`), sin compartir código. En esta tanda mordió
dos veces —`moviesSync.ts` y `db/sync-movies.js` necesitaron los mismos dos
arreglos por separado—, así que quedó documentado.

---

## Las 32 entradas "faltantes": resueltas

`movies_lists.item_count` suma 513 contra las 481 filas de `movies_cache`. La
diferencia por año:

| lista | en Trakt | teníamos | faltan |
|---|---|---|---|
| movies-2018 | 51 | 41 | **10** |
| movies-2019 | 63 | 57 | 6 |
| movies-2020 | 41 | 39 | 2 |
| movies-2021 | 29 | 29 | 0 |
| movies-2022 | 66 | 62 | 4 |
| movies-2023 | 91 | 88 | 3 |
| movies-2024 | 57 | 52 | 5 |
| movies-2025 | 53 | 51 | 2 |
| movies-2026 | 62 | 62 | 0 |

**No son películas perdidas: son rewatches aplastados.** `movies_cache` tenía PK
`trakt_id` y una sola columna `list_slug`, así que una película vista en 2018 y de
nuevo en 2022 existía una única vez y el upsert le dejaba el `list_slug` del
último año procesado. El año más viejo es el que más pierde (2018, diez) y el
actual no pierde ninguna, que es exactamente el patrón que produce ese mecanismo.
La aritmética cierra: 513 entradas de lista − 32 repetidas = 481 películas únicas.

Es la misma limitación que motivó este plan, y ya está arreglada:
`UNIQUE(tmdb_id, year_watched)` puede representarlas.

**Recuperación cuando Trakt vuelva:** `npm run sync-movies:remote`.
`db/sync-movies.js` recorre **todas** las listas (no solo el año actual) y escribe
`movies_watched` con el año de cada slug, así que las 32 entran solas. El cron del
worker sigue sincronizando únicamente el año en curso, que es lo correcto para una
tarea diaria.

> Es inferencia, no prueba: sin acceso a Trakt no se puede listar cuáles son. Para
> confirmarlo a ojo, abrir la lista `movies-2018` en el navegador —`app.trakt.tv`
> responde con sesión iniciada— y ver si diez de esas 51 aparecen también en algún
> año posterior.

> **Corrección.** Una versión anterior de este documento decía que
> `tmdbSeries.ts` usaba el filtro flojo `&year=` y arrastraba el mismo bug que se
> corrigió en películas. **Es falso**: ya usa `&first_air_date_year=`, que es el
> filtro estricto de `/search/tv` (el flojo ahí es `year`). Series nunca tuvo el
> problema; era exclusivo del código nuevo de películas.

---

## Registro de avance

| Fecha | Fase | Nota |
|---|---|---|
| 2026-09-11 | — | Plan creado. Medida la precisión slug→TMDB (99% con `primary_release_year`). |
| 2026-09-11 | 1 | `movies_watched` creada y backfilleada en local y remoto: 481 filas, 0 huérfanas, conteo por año idéntico al de `list_slug`. Nada de lectura cambió todavía. |
| 2026-09-11 | 2 | La lectura pasó al JOIN. Respuesta de `/api/movies` idéntica a la anterior (481 filas, 0 diferencias). El sync sigue sin tocarse y `list_slug` sigue intacto. |
| 2026-09-11 | 3 | Alta manual funcionando: `POST`/`DELETE`/`lookup`, modal con previsualización, ruta de detalle por `tmdb_id`. Probados los 7 casos del POST. El sync sigue sin tocarse. |
| 2026-09-11 | 4 | Reconciliación lista y probada con sync simulado. El sync ahora también escribe `movies_watched` — sin eso habría quedado mudo al volver Trakt. |
| 2026-09-11 | 5 | `list_slug`, `list_order` y `listed_at` eliminadas de `movies_cache` en local y remoto, con respaldo previo. `db/sync-movies.js` corregido con los mismos dos arreglos que el worker. |
| 2026-09-11 | 6 | Docs actualizados y plan cerrado. Build limpio y todas las rutas en 200. |
