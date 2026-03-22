-- Migration: Add series_cache and series_watched tables

CREATE TABLE IF NOT EXISTS series_cache (
  trakt_slug TEXT PRIMARY KEY,
  trakt_id INTEGER,
  tmdb_id INTEGER,
  imdb_id TEXT,
  title TEXT NOT NULL,
  year INTEGER,
  overview TEXT,
  rating REAL DEFAULT 0,
  genres TEXT,
  network TEXT,
  status TEXT,
  runtime INTEGER DEFAULT 0,
  poster TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS series_watched (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trakt_slug TEXT NOT NULL,
  season_number INTEGER NOT NULL,
  year_watched INTEGER NOT NULL,
  platform TEXT,
  status_viewed TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(trakt_slug, season_number)
);

CREATE INDEX IF NOT EXISTS idx_series_watched_slug ON series_watched(trakt_slug);
CREATE INDEX IF NOT EXISTS idx_series_watched_year ON series_watched(year_watched);
