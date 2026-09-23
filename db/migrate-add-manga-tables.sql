-- Migration: Add manga_cache and manga_read tables

CREATE TABLE IF NOT EXISTS manga_cache (
  anilist_id INTEGER PRIMARY KEY,
  id_mal INTEGER,
  title_romaji TEXT NOT NULL,
  title_english TEXT DEFAULT '',
  title_native TEXT DEFAULT '',
  synonyms_json TEXT DEFAULT '[]',
  type TEXT NOT NULL DEFAULT 'Manga',
  format TEXT DEFAULT '',
  country TEXT DEFAULT '',
  status TEXT DEFAULT '',
  description TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  cover_color TEXT DEFAULT '',
  banner TEXT DEFAULT '',
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  chapters INTEGER,
  volumes INTEGER,
  average_score INTEGER,
  mean_score INTEGER,
  popularity INTEGER,
  favourites INTEGER,
  source TEXT DEFAULT '',
  genres_json TEXT DEFAULT '[]',
  is_adult INTEGER DEFAULT 0,
  site_url TEXT DEFAULT '',
  tags_json TEXT DEFAULT '[]',
  staff_json TEXT DEFAULT '[]',
  characters_json TEXT DEFAULT '[]',
  relations_json TEXT DEFAULT '[]',
  recommendations_json TEXT DEFAULT '[]',
  external_links_json TEXT DEFAULT '[]',
  detail_fetched_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS manga_read (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anilist_id INTEGER NOT NULL UNIQUE,
  estado TEXT NOT NULL DEFAULT 'Leyendo',
  capitulo_actual INTEGER DEFAULT 0,
  platform TEXT,
  fecha_inicio TEXT,
  fecha_final TEXT,
  rating_personal INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_manga_read_estado ON manga_read(estado);
CREATE INDEX IF NOT EXISTS idx_manga_cache_type ON manga_cache(type);
