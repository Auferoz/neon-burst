-- Migration: Add data_source to series_cache
-- Marca de qué API vinieron los datos: 'trakt' (primaria) o 'tmdb' (fallback temporal).
-- Cuando vuelva a estar disponible la API de Trakt, para re-fetchear desde Trakt:
--   UPDATE series_cache SET detail_fetched_at = NULL WHERE data_source = 'tmdb';
ALTER TABLE series_cache ADD COLUMN data_source TEXT DEFAULT 'trakt';
