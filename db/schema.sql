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
  rating_rawg REAL,
  is_demo INTEGER DEFAULT 0,
  is_early_access INTEGER DEFAULT 0,
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
