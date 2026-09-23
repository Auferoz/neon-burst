-- Permite cargar rating_tmdb / rating_imdb a mano cuando TMDB/OMDb no
-- devuelven nada (ej. OMDb responde N/A). Un flag *_manual = 1 marca que el
-- valor lo cargó el usuario, no un fetch automático.
--
-- El refresco de 30 días (moviesService.ts / seriesService.ts) y los scripts
-- de backfill (db/fetch-movie-scores.js, db/fetch-series-scores.js) respetan
-- este flag: nunca pisan un campo marcado como manual, aunque sí pueden
-- seguir refrescando el otro campo.
--
-- Sin comentarios al final de línea: este archivo se aplana a una sola línea
-- para el --command remoto, y un -- de fin de línea comenta todo lo que sigue.
ALTER TABLE movies_cache ADD COLUMN rating_tmdb_manual INTEGER DEFAULT 0;
ALTER TABLE movies_cache ADD COLUMN rating_imdb_manual INTEGER DEFAULT 0;
ALTER TABLE series_cache ADD COLUMN rating_tmdb_manual INTEGER DEFAULT 0;
ALTER TABLE series_cache ADD COLUMN rating_imdb_manual INTEGER DEFAULT 0;
