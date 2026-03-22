-- Migration: Add movies_lists and movies_cache tables

CREATE TABLE IF NOT EXISTS movies_lists (
  slug TEXT PRIMARY KEY,
  description TEXT,
  item_count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS movies_cache (
  trakt_id INTEGER PRIMARY KEY,
  tmdb_id INTEGER,
  imdb_id TEXT,
  title TEXT NOT NULL,
  year INTEGER,
  released TEXT,
  runtime INTEGER DEFAULT 0,
  genres TEXT,
  overview TEXT,
  rating REAL DEFAULT 0,
  poster TEXT,
  list_slug TEXT,
  list_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_movies_cache_year ON movies_cache(year);
CREATE INDEX IF NOT EXISTS idx_movies_cache_list ON movies_cache(list_slug);
CREATE INDEX IF NOT EXISTS idx_movies_cache_title ON movies_cache(title);
