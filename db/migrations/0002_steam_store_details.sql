-- Store fields the Steam raffle filters on, filled by db/sync-steam.js from appdetails.
-- controller_support: 'full' | 'partial' | 'none' ('' = not fetched yet).
-- categories: comma-separated Steam category ids (2 = single-player, 1 = multi-player,
-- 9 = co-op, 28 = full controller support, 22 = achievements, ...).
ALTER TABLE steam_cache ADD COLUMN controller_support TEXT DEFAULT '';
ALTER TABLE steam_cache ADD COLUMN categories TEXT DEFAULT '';
ALTER TABLE steam_cache ADD COLUMN metacritic INTEGER;
