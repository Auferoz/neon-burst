-- Migration: Add season_posters_json to series_cache
-- Stores a JSON map of season number -> poster URL (e.g. {"1":"url","2":"url"})
ALTER TABLE series_cache ADD COLUMN season_posters_json TEXT DEFAULT '{}';
