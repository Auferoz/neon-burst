-- Tres scores 0-100 para series, igual que las películas: TMDB, IMDb (vía
-- OMDb) y personal. El personal es por serie (no por temporada) y va en su
-- propia tabla, keyed por trakt_slug: a diferencia de tmdb_id en movies_cache,
-- trakt_slug siempre existe en series_cache (es su PRIMARY KEY), así que no
-- necesita el mismo cuidado de reconciliación que tuvo movies_personal.
ALTER TABLE series_cache ADD COLUMN rating_tmdb INTEGER;       -- vote_average * 10
ALTER TABLE series_cache ADD COLUMN rating_imdb INTEGER;       -- imdbRating * 10
ALTER TABLE series_cache ADD COLUMN ratings_fetched_at TEXT;

CREATE TABLE IF NOT EXISTS series_personal (
  trakt_slug TEXT PRIMARY KEY,
  rating_personal INTEGER NOT NULL,          -- 0-100
  updated_at TEXT DEFAULT (datetime('now'))
);
