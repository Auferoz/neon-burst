-- "Por comprar" list in /nextGames. Featured next games are copied here when they are
-- featured (source 'featured', removed when unfeatured); manual entries come from a Steam
-- URL/appid (source 'manual'). Its own table, not a view over next_games_cache, because the
-- IGDB sync wipes that cache on every run and the list must survive it.
-- steam_appid is nullable: a featured game may not be linked to Steam (yet). SQLite allows
-- several NULLs under UNIQUE.
CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (source IN ('featured', 'manual')),
  igdb_id INTEGER UNIQUE,
  steam_appid INTEGER UNIQUE,
  name TEXT NOT NULL,
  cover TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  release_date INTEGER NOT NULL DEFAULT 0,
  release_label TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Steam appid of each upcoming game, from IGDB external_games (source 1). The sync fills it.
ALTER TABLE next_games_cache ADD COLUMN steam_appid INTEGER;

-- Existing featured games join the list; their appid arrives with the next IGDB sync.
INSERT OR IGNORE INTO wishlist (source, igdb_id, name, cover, release_date, created_at)
SELECT 'featured', c.igdb_id, c.name, COALESCE(c.cover, ''), COALESCE(c.release_date, 0), f.created_at
FROM next_games_featured f
JOIN next_games_cache c ON c.igdb_id = f.igdb_id;
