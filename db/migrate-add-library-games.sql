-- Multi-store game library (owned games outside Steam).
-- Steam keeps its own dedicated page and cache table; this one is manual-entry,
-- because none of the other launchers expose a public library API.

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
