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
  rating_personal INTEGER,
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
  rating_tmdb INTEGER,       -- vote_average * 10 (0-100)
  rating_imdb INTEGER,       -- imdbRating * 10 (0-100), vía OMDb
  rating_tmdb_manual INTEGER DEFAULT 0,   -- 1 = cargado a mano, el refresco no lo pisa
  rating_imdb_manual INTEGER DEFAULT 0,
  ratings_fetched_at TEXT,
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

-- Score personal de una película, una fila por película (no por año visto): un
-- rewatch en otro año muestra el mismo score. Separada de movies_cache, que es
-- solo metadata, para que sobreviva a cualquier rebuild del caché.
CREATE TABLE IF NOT EXISTS movies_personal (
  tmdb_id INTEGER PRIMARY KEY,
  rating_personal INTEGER NOT NULL,          -- 0-100
  updated_at TEXT DEFAULT (datetime('now'))
);

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
  rating_tmdb INTEGER,       -- vote_average * 10 (0-100)
  rating_imdb INTEGER,       -- imdbRating * 10 (0-100), vía OMDb
  rating_tmdb_manual INTEGER DEFAULT 0,   -- 1 = cargado a mano, el refresco no lo pisa
  rating_imdb_manual INTEGER DEFAULT 0,
  ratings_fetched_at TEXT,
  detail_fetched_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Score personal de una serie, una fila por serie (no por temporada): las
-- distintas temporadas de un mismo show comparten el mismo score. Keyed por
-- trakt_slug, la PK de series_cache, a diferencia de movies_personal que usa
-- tmdb_id porque el trakt_id de una película cargada a mano es provisional.
CREATE TABLE IF NOT EXISTS series_personal (
  trakt_slug TEXT PRIMARY KEY,
  rating_personal INTEGER NOT NULL,          -- 0-100
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

CREATE TABLE IF NOT EXISTS todo_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'green',
  is_inbox INTEGER NOT NULL DEFAULT 0,
  sort_order REAL NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS todo_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES todo_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todo_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  section_id INTEGER,
  parent_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 4,
  sort_order REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  due_time TEXT,
  recurrence TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES todo_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES todo_sections(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES todo_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todo_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'green'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_labels_name ON todo_labels(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS todo_task_labels (
  task_id INTEGER NOT NULL,
  label_id INTEGER NOT NULL,
  PRIMARY KEY (task_id, label_id),
  FOREIGN KEY (task_id) REFERENCES todo_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES todo_labels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todo_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES todo_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todo_tasks_project_completed ON todo_tasks(project_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date ON todo_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_parent ON todo_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_todo_sections_project ON todo_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_todo_completions_task ON todo_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_completions_completed_at ON todo_completions(completed_at);
