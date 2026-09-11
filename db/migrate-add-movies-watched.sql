-- movies_watched: las películas vistas, separadas de su metadata.
--
-- Hasta ahora movies_cache era la lista Y la metadata a la vez: su columna
-- list_slug decía en qué año la viste, así que una película no podía figurar en
-- dos años (el upsert del sync le pisaba el valor). Esta tabla arregla eso y
-- permite cargar películas a mano mientras la API de Trakt no esté disponible.
--
-- La clave de unión con movies_cache es tmdb_id, no trakt_id: el tmdb_id es el
-- único identificador que se puede obtener sin la API de Trakt y que además
-- Trakt devuelve en cada película, así que lo manual y lo sincronizado convergen.

CREATE TABLE IF NOT EXISTS movies_watched (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id INTEGER NOT NULL,
  trakt_id INTEGER,
  trakt_slug TEXT,
  year_watched INTEGER NOT NULL,
  platform TEXT,
  source TEXT NOT NULL DEFAULT 'trakt' CHECK (source IN ('trakt', 'manual')),
  listed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (tmdb_id, year_watched)
);

CREATE INDEX IF NOT EXISTS idx_movies_watched_year ON movies_watched(year_watched);
CREATE INDEX IF NOT EXISTS idx_movies_watched_tmdb ON movies_watched(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_watched_source ON movies_watched(source);

-- Necesario para el JOIN y para que la reconciliación con Trakt (fase 4) pueda
-- buscar una fila existente por tmdb_id antes de insertar una nueva.
CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_cache_tmdb ON movies_cache(tmdb_id);

-- Backfill desde el caché actual. list_slug tiene el formato 'movies-YYYY', y
-- 'movies-' son 7 caracteres, así que substr(list_slug, 8) devuelve el año.
INSERT OR IGNORE INTO movies_watched (tmdb_id, trakt_id, year_watched, listed_at, source)
SELECT tmdb_id, trakt_id, CAST(substr(list_slug, 8) AS INTEGER), listed_at, 'trakt'
FROM movies_cache
WHERE tmdb_id IS NOT NULL AND list_slug LIKE 'movies-____';
