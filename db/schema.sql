-- Neon Burst - D1 Database Schema

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  released TEXT,
  companie TEXT,
  poster TEXT,
  trailer TEXT,
  artworks TEXT,
  genre TEXT,
  estado TEXT NOT NULL DEFAULT 'Jugando',
  logros_obt INTEGER DEFAULT 0,
  logros_total INTEGER DEFAULT 0,
  console_pc TEXT,
  igdb_id INTEGER,
  first_year_played INTEGER,
  description TEXT,
  rating_metacritic INTEGER,
  rating_opencritic REAL,
  is_demo INTEGER DEFAULT 0,
  is_early_access INTEGER DEFAULT 0,
  is_testing INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dates_played (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  fecha_inicio TEXT,
  fecha_final TEXT,
  horas REAL DEFAULT 0,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_games_title ON games(title);
CREATE INDEX IF NOT EXISTS idx_games_estado ON games(estado);
CREATE INDEX IF NOT EXISTS idx_games_console ON games(console_pc);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dates_unique ON dates_played(game_id, year, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_dates_played_game ON dates_played(game_id);
CREATE INDEX IF NOT EXISTS idx_dates_played_year ON dates_played(year);

CREATE TABLE IF NOT EXISTS steam_cache (
  appid INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  developer TEXT,
  publisher TEXT,
  genres TEXT,
  released TEXT,
  poster TEXT,
  playtime INTEGER DEFAULT 0,
  last_played INTEGER DEFAULT 0,
  hltb_main REAL,
  hltb_extra REAL,
  hltb_completionist REAL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_steam_cache_name ON steam_cache(name);

CREATE TABLE IF NOT EXISTS next_games_cache (
  igdb_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  developer TEXT,
  publisher TEXT,
  genres TEXT,
  cover TEXT,
  bg_image TEXT,
  release_date INTEGER DEFAULT 0,
  platforms TEXT,
  steam_url TEXT,
  hypes INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_next_games_cache_date ON next_games_cache(release_date);

CREATE TABLE IF NOT EXISTS next_games_featured (
  igdb_id INTEGER PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now'))
);

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
  thumb TEXT,
  tagline TEXT DEFAULT '',
  certification TEXT DEFAULT '',
  country TEXT DEFAULT '',
  language TEXT DEFAULT '',
  trailer TEXT DEFAULT '',
  homepage TEXT DEFAULT '',
  fanart TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  cast_json TEXT DEFAULT '[]',
  videos_json TEXT DEFAULT '[]',
  images_json TEXT DEFAULT '{}',
  after_credits INTEGER DEFAULT 0,
  during_credits INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,
  detail_fetched_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_movies_cache_year ON movies_cache(year);
CREATE INDEX IF NOT EXISTS idx_movies_cache_title ON movies_cache(title);
-- Único: es la clave con la que movies_watched se une al caché, y la que permite
-- reconciliar una película cargada a mano con la que devuelve Trakt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_cache_tmdb ON movies_cache(tmdb_id);

-- Las películas vistas. Separada de movies_cache (que es solo metadata) para que
-- una película pueda estar vista en más de un año y para poder cargarlas a mano
-- mientras la API de Trakt no esté disponible.
CREATE TABLE IF NOT EXISTS movies_watched (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id INTEGER NOT NULL,
  trakt_id INTEGER,
  trakt_slug TEXT,
  year_watched INTEGER NOT NULL,
  platform TEXT,
  source TEXT NOT NULL DEFAULT 'trakt' CHECK (source IN ('trakt', 'manual')),
  listed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (tmdb_id, year_watched)
);

CREATE INDEX IF NOT EXISTS idx_movies_watched_year ON movies_watched(year_watched);
CREATE INDEX IF NOT EXISTS idx_movies_watched_tmdb ON movies_watched(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_watched_source ON movies_watched(source);

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
  thumb TEXT,
  tagline TEXT DEFAULT '',
  certification TEXT DEFAULT '',
  country TEXT DEFAULT '',
  language TEXT DEFAULT '',
  trailer TEXT DEFAULT '',
  fanart TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  airs_day TEXT DEFAULT '',
  airs_time TEXT DEFAULT '',
  airs_timezone TEXT DEFAULT '',
  first_aired TEXT DEFAULT '',
  aired_episodes INTEGER DEFAULT 0,
  cast_json TEXT DEFAULT '[]',
  videos_json TEXT DEFAULT '[]',
  images_json TEXT DEFAULT '{}',
  seasons_json TEXT DEFAULT '[]',
  votes INTEGER DEFAULT 0,
  detail_fetched_at TEXT,
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


CREATE TABLE IF NOT EXISTS library_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  store TEXT NOT NULL,
  igdb_id INTEGER,
  poster TEXT,
  artworks TEXT,
  released TEXT,
  companie TEXT,
  genre TEXT,
  description TEXT,
  trailer TEXT,
  store_url TEXT,
  owned_via TEXT DEFAULT 'Compra',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Lets bulk import re-run safely: INSERT OR IGNORE absorbs the duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_store_title
  ON library_games (store, title COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_library_store ON library_games (store);
