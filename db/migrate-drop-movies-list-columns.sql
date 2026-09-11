-- Saca de movies_cache las columnas de pertenencia a lista.
--
-- Esos datos viven ahora en movies_watched: `list_slug` decía en qué año viste la
-- película (una sola, no permitía dos años) y `listed_at` cuándo la agregaste a
-- la lista de Trakt. Ambos se backfillearon en migrate-add-movies-watched.sql y
-- desde entonces la lista se lee por JOIN contra esa tabla.
--
-- movies_cache queda como lo que su nombre dice: caché de metadata.
--
-- IRREVERSIBLE. El respaldo de lo que se borra está en
-- db/backup-movies-list-slug.json (trakt_id, tmdb_id, title, list_slug,
-- list_order, listed_at de las 481 filas).
--
-- movies_lists no se toca: sigue siendo la metadata de las listas de Trakt.

DROP INDEX IF EXISTS idx_movies_cache_list;

ALTER TABLE movies_cache DROP COLUMN list_slug;
ALTER TABLE movies_cache DROP COLUMN list_order;
ALTER TABLE movies_cache DROP COLUMN listed_at;
