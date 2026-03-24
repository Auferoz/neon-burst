-- Migration: Add detail columns to movies_cache and series_cache
-- Stores comprehensive Trakt data for detail pages (fetched on-demand)

-- Movies detail columns
ALTER TABLE movies_cache ADD COLUMN tagline TEXT DEFAULT '';
ALTER TABLE movies_cache ADD COLUMN certification TEXT DEFAULT '';
ALTER TABLE movies_cache ADD COLUMN country TEXT DEFAULT '';
ALTER TABLE movies_cache ADD COLUMN language TEXT DEFAULT '';
ALTER TABLE movies_cache ADD COLUMN trailer TEXT DEFAULT '';
ALTER TABLE movies_cache ADD COLUMN homepage TEXT DEFAULT '';
ALTER TABLE movies_cache ADD COLUMN fanart TEXT DEFAULT '';
ALTER TABLE movies_cache ADD COLUMN logo TEXT DEFAULT '';
ALTER TABLE movies_cache ADD COLUMN cast_json TEXT DEFAULT '[]';
ALTER TABLE movies_cache ADD COLUMN videos_json TEXT DEFAULT '[]';
ALTER TABLE movies_cache ADD COLUMN images_json TEXT DEFAULT '{}';
ALTER TABLE movies_cache ADD COLUMN after_credits INTEGER DEFAULT 0;
ALTER TABLE movies_cache ADD COLUMN during_credits INTEGER DEFAULT 0;
ALTER TABLE movies_cache ADD COLUMN votes INTEGER DEFAULT 0;
ALTER TABLE movies_cache ADD COLUMN detail_fetched_at TEXT;

-- Series detail columns
ALTER TABLE series_cache ADD COLUMN tagline TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN certification TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN country TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN language TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN trailer TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN fanart TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN logo TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN airs_day TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN airs_time TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN airs_timezone TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN first_aired TEXT DEFAULT '';
ALTER TABLE series_cache ADD COLUMN aired_episodes INTEGER DEFAULT 0;
ALTER TABLE series_cache ADD COLUMN cast_json TEXT DEFAULT '[]';
ALTER TABLE series_cache ADD COLUMN videos_json TEXT DEFAULT '[]';
ALTER TABLE series_cache ADD COLUMN images_json TEXT DEFAULT '{}';
ALTER TABLE series_cache ADD COLUMN seasons_json TEXT DEFAULT '[]';
ALTER TABLE series_cache ADD COLUMN votes INTEGER DEFAULT 0;
ALTER TABLE series_cache ADD COLUMN detail_fetched_at TEXT;
