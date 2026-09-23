-- Tres scores 0-100 para películas: TMDB, IMDb (vía OMDb) y personal.
-- El personal va en su propia tabla, keyed por tmdb_id: movies_cache es solo
-- metadata por diseño, y tmdb_id es la clave que ya une cache con watched, así
-- que el score sobrevive a cualquier rebuild del caché o la reconciliación del
-- trakt_id provisional.
ALTER TABLE movies_cache ADD COLUMN rating_tmdb INTEGER;       -- vote_average * 10
ALTER TABLE movies_cache ADD COLUMN rating_imdb INTEGER;       -- imdbRating * 10
ALTER TABLE movies_cache ADD COLUMN ratings_fetched_at TEXT;

CREATE TABLE IF NOT EXISTS movies_personal (
  tmdb_id INTEGER PRIMARY KEY,
  rating_personal INTEGER NOT NULL,          -- 0-100
  updated_at TEXT DEFAULT (datetime('now'))
);
