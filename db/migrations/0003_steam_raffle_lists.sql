-- Named lists for the Steam raffle ("Sortear"): the user narrows the raffle to a list of
-- library games. Items reference steam_cache.appid; no FK on it because steam_cache is a
-- sync cache that gets rewritten, and a list must survive that.
CREATE TABLE IF NOT EXISTS steam_raffle_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_steam_raffle_lists_name ON steam_raffle_lists(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS steam_raffle_list_items (
  list_id INTEGER NOT NULL REFERENCES steam_raffle_lists(id) ON DELETE CASCADE,
  appid INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (list_id, appid)
);
