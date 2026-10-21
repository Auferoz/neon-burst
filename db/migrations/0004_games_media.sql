-- Galería de IGDB por juego (artworks, screenshots y videos), cargada on-demand al
-- visitar la ficha. `media_json` es un GameMedia serializado (src/utils/igdbMedia.ts);
-- `media_fetched_at` solo se llena cuando IGDB respondió, así un fallo reintenta.
ALTER TABLE games ADD COLUMN media_json TEXT;
ALTER TABLE games ADD COLUMN media_fetched_at TEXT;
