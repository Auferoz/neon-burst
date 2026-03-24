-- Migration: Add thumb column to movies_cache and series_cache tables
-- Stores TMDB backdrop image URL for card background

ALTER TABLE movies_cache ADD COLUMN thumb TEXT;
ALTER TABLE series_cache ADD COLUMN thumb TEXT;
