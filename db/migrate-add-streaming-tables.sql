-- Migration: streaming accounts + PIN brute-force throttling
--
-- streaming_accounts reemplaza a src/data/SSAccounts.js: las contraseñas
-- dejan de vivir en el repo y sólo salen de D1 tras validar el PIN.
--
-- streaming_attempts frena la fuerza bruta contra /api/streaming/unlock,
-- que es la única defensa real de un PIN numérico.

CREATE TABLE IF NOT EXISTS streaming_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT,
  logo TEXT,
  email TEXT,
  password TEXT,
  plan TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_streaming_accounts_name ON streaming_accounts(name);

CREATE TABLE IF NOT EXISTS streaming_attempts (
  ip TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
