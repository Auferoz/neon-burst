-- Migration: Add is_demo and is_early_access columns to games table
-- Existing games default to 0 (no mark)

ALTER TABLE games ADD COLUMN is_demo INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN is_early_access INTEGER DEFAULT 0;
