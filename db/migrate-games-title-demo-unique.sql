-- A demo and the full game can share a title: the is_demo flag tells them apart.
-- Replaces the title-only unique index with (title, is_demo) and strips the
-- " - DEMO" / " DEMO" suffix that demos used to carry to dodge the old index.
-- The UPDATEs run before the new index is created so it cannot collide.
DROP INDEX IF EXISTS idx_games_title;
UPDATE games SET title = substr(title, 1, length(title) - 7) WHERE is_demo = 1 AND title LIKE '% - DEMO';
UPDATE games SET title = substr(title, 1, length(title) - 5) WHERE is_demo = 1 AND title LIKE '% DEMO';
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_title_demo ON games(title, is_demo);
