-- Replace the RAWG user score with the OpenCritic top critic score.
--
-- No data is copied on purpose: RAWG ratings are 0-5 user scores while
-- OpenCritic topCriticScore is a 0-100 critic aggregate. The new column starts
-- empty and is repopulated by db/fetch-ratings.js.
ALTER TABLE games ADD COLUMN rating_opencritic REAL;
ALTER TABLE games DROP COLUMN rating_rawg;
