-- Migration: Add data_source to movies_cache
-- Marca de qué API vinieron los datos: 'trakt' (primaria) o 'tmdb' (fallback temporal).
-- Cuando vuelva a estar disponible la API de Trakt, para re-fetchear desde Trakt:
--   UPDATE movies_cache SET detail_fetched_at = NULL WHERE data_source = 'tmdb';
-- Aplicar en local Y en remoto:
--   npx wrangler d1 execute neon-burst-db --local  --file db/migrate-add-movies-data-source.sql
--   npx wrangler d1 execute neon-burst-db --remote --file db/migrate-add-movies-data-source.sql
ALTER TABLE movies_cache ADD COLUMN data_source TEXT DEFAULT 'trakt';
