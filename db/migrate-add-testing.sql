-- Migration: Add is_testing column to games table (Probando / primeras impresiones)
-- Existing games default to 0 (no mark)

ALTER TABLE games ADD COLUMN is_testing INTEGER DEFAULT 0;
